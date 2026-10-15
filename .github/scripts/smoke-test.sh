#!/usr/bin/env bash
# Checks that the live site works after a deploy. Exits non-zero (failing the workflow, which
# emails whoever merged) when anything is broken.
#
#   SITE_URL        site to check, e.g. https://lemon.dontbeone.co.za (no trailing slash)
#   CHECK_FILES=1   also check the live index.html, js/ and css/ match this checkout (right after a deploy)
#   SMOKE_LOGIN, SMOKE_PASSWORD   a dedicated test account: sign in, save, load and sign out.
#                   Skipped when they aren't set. The account's saved game is overwritten.
set -uo pipefail

SITE_URL="${SITE_URL%/}"
WORK="$(mktemp -d)"
FAILED=0
trap 'rm -rf "$WORK"' EXIT

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; echo "::error::$1"; FAILED=1; }

# get URL OUTFILE → prints the HTTP status (000 when the site can't be reached)
get() {
    : >"$2"
    curl -sS -o "$2" -w '%{http_code}' --max-time 30 "$1" 2>"$WORK/curl.err" || true
}

echo "Checking $SITE_URL"

code=$(get "$SITE_URL/?smoke=$(date +%s)" "$WORK/index.html")
if [ "$code" = 200 ] && grep -q 'js/main.js' "$WORK/index.html"; then
    pass "home page loads"
else
    if [ -s "$WORK/index.html" ]; then detail=$(head -c 200 "$WORK/index.html"); else detail=$(cat "$WORK/curl.err"); fi
    fail "home page returned HTTP $code: $detail"
    exit 1   # nothing else can work
fi

for asset in $(grep -oE '(src|href)="(js|css)/[^"?]+' "$WORK/index.html" | sed -E 's/^[a-z]+="//'); do
    code=$(get "$SITE_URL/$asset" "$WORK/asset")
    [ "$code" = 200 ] && [ -s "$WORK/asset" ] && pass "$asset loads" || fail "$asset returned HTTP $code"
done

# Accounts: api.php should answer JSON (503 "offline" until config.php is on the server). Only
# a warning when it doesn't, since the game works without it, but the PHP source must never show.
code=$(get "$SITE_URL/api.php?action=me" "$WORK/api")
if grep -q '<?php' "$WORK/api"; then
    fail "api.php is served as source code: PHP isn't running on the site"
elif grep -q '"user"' "$WORK/api"; then
    pass "accounts API answers"
    code=$(get "$SITE_URL/api.php?action=leaders" "$WORK/leaders")
    [ "$code" = 200 ] && jq -e '.boards | has("et") and has("rt") and has("streak") and has("cash")' "$WORK/leaders" >/dev/null \
        && pass "leaderboards answer" || fail "leaderboards returned HTTP $code: $(head -c 200 "$WORK/leaders")"
elif grep -q '"offline"' "$WORK/api"; then
    echo "WARN  accounts API is up but config.php isn't on the server yet"
    echo "::warning::accounts API has no config.php on the server yet"
else
    echo "WARN  accounts API returned HTTP $code (is PHP enabled for the site?)"
    echo "::warning::accounts API returned HTTP $code (is PHP enabled for the site?)"
fi

# Accounts end to end, with the test account: sign in, save a game, load it back, sign out
if [ -n "${SMOKE_LOGIN:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ] && grep -q '"user"' "$WORK/api"; then
    JAR="$WORK/cookies"
    # api ACTION OUTFILE [JSON] → prints the HTTP status; a JSON body makes it a POST
    api() {
        : >"$2"
        local args=(-sS -o "$2" -w '%{http_code}' --max-time 30 -b "$JAR" -c "$JAR")
        [ $# -ge 3 ] && args+=(-H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' --data "$3")
        curl "${args[@]}" "$SITE_URL/api.php?action=$1" 2>"$WORK/curl.err" || true
    }
    login=$(jq -nc --arg u "$SMOKE_LOGIN" --arg p "$SMOKE_PASSWORD" '{username: $u, password: $p}')
    code=$(api login "$WORK/login" "$login")
    if [ "$code" = 200 ] && [ "$(jq -r '.user.username // empty' "$WORK/login")" != "" ]; then
        pass "test account signs in"
        stamp=$(date +%s)
        game=$(jq -nc --argjson s "$stamp" '{game: {week: 1, cash: $s, savedAt: ($s * 1000), cars: [], smokeTest: true}}')
        code=$(api save "$WORK/save" "$game")
        [ "$code" = 200 ] && jq -e '.ok' "$WORK/save" >/dev/null && pass "a game saves" || fail "save returned HTTP $code: $(head -c 200 "$WORK/save")"
        code=$(api load "$WORK/load")
        [ "$code" = 200 ] && [ "$(jq -r '.game.cash // empty' "$WORK/load")" = "$stamp" ] && pass "the saved game loads back" \
            || fail "load returned HTTP $code without the game just saved: $(head -c 200 "$WORK/load")"
        code=$(api logout "$WORK/logout" '{}')
        code2=$(api load "$WORK/after")
        [ "$code" = 200 ] && [ "$code2" = 401 ] && pass "signing out ends the session" || fail "sign-out returned HTTP $code, then load returned HTTP $code2"
    else
        fail "test account can't sign in: HTTP $code $(head -c 200 "$WORK/login")"
    fi
elif [ -z "${SMOKE_LOGIN:-}" ]; then
    echo "SKIP  account sign-in check (no SMOKE_LOGIN / SMOKE_PASSWORD secrets)"
fi

if [ "${CHECK_FILES:-}" = 1 ]; then
    # Right after a deploy the live files must be the ones just uploaded. Retry a little, in case
    # the server is still serving a cached copy.
    for f in index.html $(git ls-files 'js/*.js' 'css/*.css'); do
        ok=""
        for attempt in 1 2 3; do
            get "$SITE_URL/$f?smoke=$(date +%s%N)" "$WORK/live" >/dev/null
            if cmp -s "$f" "$WORK/live"; then ok=1; break; fi
            sleep 10
        done
        [ -n "$ok" ] && pass "live $f matches this commit" || fail "live $f differs from this commit (deploy didn't land?)"
    done
fi

if [ "$FAILED" = 1 ]; then
    echo "The live site has problems (see FAIL lines above)."
    exit 1
fi
echo "All checks passed."

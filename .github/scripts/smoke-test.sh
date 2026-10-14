#!/usr/bin/env bash
# Checks that the live site works after a deploy. Exits non-zero (failing the workflow, which
# emails whoever merged) when anything is broken.
#
#   SITE_URL        site to check, e.g. https://lemon.dontbeone.co.za (no trailing slash)
#   CHECK_FILES=1   also check the live index.html, js/ and css/ match this checkout (right after a deploy)
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

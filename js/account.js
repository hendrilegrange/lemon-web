// Player accounts: a signed-in player's game is saved on the server as well, so it follows
// them to any browser. The game always saves to localStorage first; the server copy follows
// a moment later. Without api.php (or offline) the account options just don't show.
(function (L) {
    'use strict';

    var API = 'api.php';
    var PUSH_DELAY = 1500;       // ms after the last save before sending it to the server
    var A = L.account = {
        available: false,        // api.php answered, so accounts work on this server
        user: null,              // { username } while signed in
        remote: null,            // the server save's { savedAt, week, cash }, or null
        google: '',              // the Google sign-in client ID, when the server has one
        error: null              // the last sync problem, shown on the title screen
    };
    var pending = null, timer = null;

    // fetch wrapper: resolves { ok, status, data } and never rejects
    function call(action, body, keepalive) {
        var opts = { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: {} };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.headers['X-Requested-With'] = 'XMLHttpRequest';
            opts.body = JSON.stringify(body);
        }
        if (keepalive) opts.keepalive = true;
        var abort = null;
        if (window.AbortController && !keepalive) {
            var ac = new AbortController();
            opts.signal = ac.signal;
            abort = setTimeout(function () { ac.abort(); }, 8000);
        }
        return fetch(API + '?action=' + action, opts).then(function (r) {
            return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d || {} }; },
                function () { return { ok: false, status: r.status, data: {} }; });
        }, function () {
            return { ok: false, status: 0, data: { error: 'Couldn\'t reach the server.' } };
        }).then(function (res) { clearTimeout(abort); return res; });
    }

    // Every save goes to the browser at once and, when signed in, to the server shortly after
    var saveLocal = L.save;
    L.save = function (g) {
        g.savedAt = Date.now();
        saveLocal(g);
        if (!A.user) return;
        pending = g;
        clearTimeout(timer);
        timer = setTimeout(push, PUSH_DELAY);
    };

    function push(keepalive) {
        clearTimeout(timer);
        if (!pending || !A.user) return Promise.resolve(true);
        var g = pending;
        pending = null;
        if (!g.savedAt) { g.savedAt = Date.now(); saveLocal(g); }    // a save from before accounts
        return call('save', { game: g }, keepalive).then(function (res) {
            if (res.ok) { A.remote = res.data.save; A.error = null; return true; }
            if (res.status === 401) A.user = null;
            A.error = res.data.error || 'Couldn\'t save to your account.';
            return false;
        });
    }

    // Leaving the page: send any save still waiting
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && pending) push(true);
    });

    function pull() {
        return call('load').then(function (res) {
            if (res.ok && res.data.game) { saveLocal(res.data.game); A.error = null; return true; }
            A.error = res.data.error || 'Couldn\'t load your account\'s game.';
            return false;
        });
    }

    function summary(g) { return g ? { savedAt: g.savedAt || 0, week: g.week, cash: g.cash } : null; }

    // Brings the browser and the server to the same game. The newer one wins unless ask is
    // set and both have a different game, when it resolves { conflict: { local, remote } }
    // and choose() settles it.
    function sync(ask) {
        var local = L.load();
        var remote = A.remote;
        if (!remote && !local) return Promise.resolve({});
        if (!remote) { pending = local; return push().then(function () { return {}; }); }
        if (!local) return pull().then(function () { return {}; });
        if ((local.savedAt || 0) === remote.savedAt) return Promise.resolve({});
        if (ask) return Promise.resolve({ conflict: { local: summary(local), remote: remote } });
        if ((local.savedAt || 0) > remote.savedAt) { pending = local; return push().then(function () { return {}; }); }
        return pull().then(function () { return {}; });
    }

    // At boot: is the API there, is anyone signed in, and is their game here?
    A.check = function () {
        return call('me').then(function (res) {
            A.available = res.ok && 'user' in res.data;
            if (!A.available) return {};
            A.user = res.data.user;
            A.remote = res.data.save;
            A.google = res.data.google || '';
            return A.user ? sync(false) : {};
        });
    };

    // Any way in: 'login' { username, password }, 'register' { username, email, password },
    // 'google' { credential } or 'reset' { token, password }. Resolves { error }, { conflict } or {}.
    A.signIn = function (action, fields) {
        return call(action, fields).then(function (res) {
            if (!res.ok) return { error: res.data.error || 'Couldn\'t reach the server.' };
            A.user = res.data.user;
            A.remote = res.data.save;
            return sync(true);
        });
    };

    // Emails a reset link. Resolves { message } or { error }.
    A.forgot = function (email) {
        return call('forgot', { email: email }).then(function (res) {
            return res.ok ? { message: res.data.message } : { error: res.data.error || 'Couldn\'t reach the server.' };
        });
    };

    // Google's sign-in button, drawn into el once Google's script has loaded. onCredential gets
    // the ID token to pass to signIn('google', ...).
    var gisLoading = null;
    A.googleButton = function (el, onCredential) {
        if (!A.google || !el) return;
        if (!gisLoading) {
            gisLoading = new Promise(function (resolve, reject) {
                var s = document.createElement('script');
                s.src = 'https://accounts.google.com/gsi/client';
                s.async = true;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        gisLoading.then(function () {
            if (!document.body.contains(el)) return;      // the player moved on
            window.google.accounts.id.initialize({
                client_id: A.google,
                callback: function (r) { if (r.credential) onCredential(r.credential); }
            });
            window.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular',
                width: Math.min(360, el.clientWidth || 360) });
        }, function () {
            gisLoading = null;
            el.textContent = 'Google sign-in didn\'t load. Check your connection.';
        });
    };

    // The leaderboards: the top 10 on each, or one board's top 100 ('et', 'rt', 'streak',
    // 'cash', or 'k0' to 'k5' for the Kings). Resolves { boards: { key: [{ name, value }] } } or { error }.
    A.leaders = function (board) {
        return call('leaders' + (board ? '&board=' + encodeURIComponent(board) : '')).then(function (res) {
            return res.ok && res.data.boards ? { boards: res.data.boards } : { error: res.data.error || 'Couldn\'t reach the server.' };
        });
    };

    // The kids' garage's top ten, no account needed. kids() resolves { top: [{ name, car, t }] }
    // or { error }; kidTime({ name, car, t }) sends a time and resolves { rank } (1-10 when it's
    // on the board, else null) or { error }.
    A.kids = function () {
        return call('kids').then(function (res) {
            return res.ok && Array.isArray(res.data.top) ? { top: res.data.top } : { error: res.data.error || 'Couldn\'t reach the server.' };
        });
    };
    A.kidTime = function (entry) {
        if (!A.available) return Promise.resolve({ error: 'offline' });
        return call('kid_time', entry).then(function (res) {
            return res.ok ? { rank: res.data.rank || null } : { error: res.data.error || 'Couldn\'t reach the server.' };
        });
    };

    // After a conflict: keep 'local' (this browser's game goes to the account) or 'remote'
    A.choose = function (which) {
        if (which === 'local') { pending = L.load(); return push(); }
        return pull();
    };

    // Signs out. The browser's copy is cleared once it's safely on the server, so the next
    // person on this computer doesn't carry on your game.
    A.signOut = function () {
        return push().then(function (pushed) {
            var local = L.load();
            var safe = pushed && (!local || (A.remote && (local.savedAt || 0) === A.remote.savedAt));
            return call('logout', {}).then(function () {
                A.user = null;
                A.remote = null;
                if (safe) L.clearSave();
                return { cleared: safe };
            });
        });
    };
})(window.Lemon = window.Lemon || {});

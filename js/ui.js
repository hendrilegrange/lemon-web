// Menu screens: the hub, classifieds, parts catalog, garage and the burger stand.
// Each screen is plain HTML built into #app; the race takes over the canvas.
(function (L) {
    'use strict';

    var app, g;
    var keepScroll = false;   // true while a screen redraws itself after an action

    function money(n) { return '$' + n.toLocaleString('en-US'); }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function el(html) {
        var t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content;
    }

    // Wires every [data-act] button in the screen to a handler by name. Menus play the
    // jukebox; the race and the workbench pick their own sound after rendering.
    function render(html, actions) {
        app.innerHTML = '';
        app.appendChild(el(html));
        L.sound.scene('menu');
        app.querySelectorAll('[data-act]').forEach(function (b) {
            b.addEventListener('click', function () {
                L.sound.begin();
                L.sound.click();
                var fn = actions[b.getAttribute('data-act')];
                if (fn) fn(b.getAttribute('data-arg'));
            });
        });
        var top = app.querySelector('.navbar'), here = top && top.querySelector('.here');
        app.querySelectorAll('[data-nav]').forEach(function (b) {
            b.addEventListener('click', function () {
                L.sound.begin();
                L.sound.click();
                var key = b.getAttribute('data-nav'), from = here && BACK_TO[here.getAttribute('data-nav')];
                if (key === 'dealer' && !L.beatAKing(g)) return toast('The dealership only sells to the King of the strip. Beat The King first.');
                GO[key](from ? GO[from] : null);
            });
        });
        var focus = app.querySelector('button:not([disabled]):not([data-nav])');
        if (focus) focus.focus({ preventScroll: true });
        // A new screen starts at the top. One that redraws after a Buy or an Install stays
        // where you were, and if its message is scrolled out of sight it pops up as a toast.
        if (!keepScroll) window.scrollTo(0, 0);
        else {
            var f = app.querySelector('.flash'), bar = app.querySelector('.top');
            var hidden = bar ? bar.getBoundingClientRect().bottom : 0;
            if (f && f.getBoundingClientRect().bottom <= hidden + 4) toast(f.textContent);
        }
        keepScroll = false;
        // Away from the title, the browser's Back button is the screen's own way back
        if (!app.querySelector('.title-menu')) guardBack();
    }

    // The browser's Back button. Every screen but the title keeps one extra history entry
    // in front of the page, so Back lands here instead of leaving the site, and does what
    // the screen's own Back (or Cancel, or Leave it) button does. A screen with no way back,
    // like a race under way, keeps you where you are. On the title, Back leaves as usual.
    var guarded = false;
    function guardBack() {
        if (guarded) return;
        history.pushState({ lemon: 'back' }, '');
        guarded = true;
    }
    function wayBack() {
        return app.querySelector('.backbar button, [data-act="back"], [data-act="no"], [data-act="cancel"], [data-act="quit"]');
    }
    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.lemon) { guarded = true; return; }   // Forward onto our own entry
        guarded = false;
        if (!app || !app.firstChild) return;
        if (app.querySelector('.title-menu')) return history.back();
        var way = wayBack();
        if (way) way.click();   // the screen it goes to sets its own entry
        else guardBack();       // nowhere to go back to: stay put
    });

    var toastTimer;
    function toast(text) {
        var t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toast';
            t.className = 'toast';
            t.setAttribute('role', 'status');
            document.body.appendChild(t);
        }
        t.textContent = text;
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
    }

    // The way back, which stays at the bottom of the screen on a phone however long the page
    // more: other places to jump to from here, as [label, act] pairs beside the way back
    function backBar(label, act, more) {
        return '<div class="backbar"><button data-act="' + (act || 'back') + '">' + label + '</button>' +
            (more || []).map(function (m) { return '<button data-act="' + m[1] + '" class="minor">' + m[0] + '</button>'; }).join('') + '</div>';
    }

    // The gauges across the top of every screen, and under them a row of links to the main
    // screens (here: the one showing, lit up). Both stay at the top on a phone.
    function status(here) {
        function gauge(label, value, cls) {
            return '<div class="gauge' + (cls ? ' ' + cls : '') + '"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
        }
        return '<header class="top"><div class="status">' +
            gauge('Cash', money(g.cash), 'cash') +
            gauge(L.eraOf(g) ? 'Week, ' + L.ERAS[L.eraOf(g)].year : 'Week', g.week) +
            (g.friday ? gauge('Tonight', 'Racing', 'friday') : gauge('Hours', g.hours + ' h')) +
            gauge('Record', g.wins + '–' + g.losses) +
            '</div>' + navbar(here) + '</header>';
    }

    var NAV = [['hub', 'home', 'Home'], ['ads', 'ads', 'Ads'], ['parts', 'parts', 'Shop'], ['garage', 'garage', 'Garage'],
               ['paint', 'paint', 'Paint'], ['dealer', 'dealer', 'Dealer'], ['stand', 'stand', 'Race']];
    function navbar(here) {
        return '<nav class="navbar" aria-label="Main">' + NAV.map(function (n) {
            var locked = n[0] === 'dealer' && !L.beatAKing(g);
            var hot = n[0] === 'stand' && g.friday;
            return '<button data-nav="' + n[0] + '" class="minor' + (n[0] === here ? ' here' : '') + (hot ? ' hot' : '') + (locked ? ' locked' : '') + '"' +
                (n[0] === here ? ' aria-current="page"' : '') + (locked ? ' title="Beat The King to open"' : '') + '>' +
                icon(n[1]) + '<span>' + n[2] + '</span></button>';
        }).join('') + '</nav>';
    }

    // Where each main screen is, for the hub's tiles and the navbar. from: the screen to come
    // back to if the player changes their mind about heading out to race.
    var GO = {
        hub: function () { L.showHub(); },
        ads: function () { L.showAds(); },
        parts: function () { L.showParts(); },
        garage: function () { L.showGarage(); },
        paint: function () { L.showPaint(); },
        dealer: function () { if (!L.beatAKing(g)) return L.showHub('The dealership only sells to the King of the strip. Beat The King first.'); L.showDealer(); },
        stand: function (from) {
            if (g.friday || g.hours === 0) { L.goFriday(g); L.save(g); return L.showStand(); }
            ask('Head out to the burger stand? It\'s Friday night, so the garage is closed till next week. You still have ' +
                g.hours + ' hours left.', 'Go racing', function () { L.goFriday(g); L.save(g); L.showStand(); }, from || L.showHub);
        }
    };
    var BACK_TO = { ads: 'ads', parts: 'parts', garage: 'garage', paint: 'paint', dealer: 'dealer' };

    // Ask before something that can't be undone. Shows the question in place of the screen;
    // Cancel goes back to the screen it came from. extra is HTML shown above the question.
    function ask(question, yesLabel, onYes, back, extra) {
        render(
            status() + '<div class="panel ask"><h2><span class="ask-mark" aria-hidden="true">!</span>Are you sure?</h2>' + (extra || '') +
            '<p class="ask-q">' + esc(question) + '</p><div class="ask-btns">' +
            '<button data-act="yes" class="danger">' + esc(yesLabel) + '</button>' +
            '<button data-act="no" class="minor">Cancel</button></div></div>',
            { yes: onYes, no: function () { back(); } }
        );
    }

    function flash(msg) {
        if (!msg) return '';
        return '<p class="flash">' + esc(msg) + '</p>';
    }

    // Do something, save, and redraw the screen with its result or error
    function act(screen, fn) {
        return function (arg) {
            var cash = g.cash;
            var err = fn(arg);
            if (g.cash !== cash) L.sound.cash();
            L.save(g);
            keepScroll = true;
            screen(err || null);
        };
    }

    function carStats(car) {
        var s = L.spec(car);
        var pp = L.peakPower(s);
        var est = L.estimate(s);
        return { hp: Math.round(pp.hp), hpRpm: pp.rpm, et: est.et, trap: est.trapMph, zeroSixty: est.zeroSixty, redline: s.redline };
    }

    // A part's name in its class's colour, the same as the speed shop's class badges
    function partName(id) {
        var p = L.PARTS[id];
        return '<span class="tier t' + p.cls + '" title="' + (L.CLASSES[p.cls] || '') + '">' + esc(p.name) + '</span>';
    }

    function bar(value, label) {
        var cls = value < 35 ? 'bad' : value < 70 ? 'ok' : 'good';
        return '<span class="meter ' + cls + '" title="' + label + '"><span style="width:' + value + '%"></span></span> ' + value + '%';
    }

    // ── Title ─────────────────────────────────────────────────────────────

    L.showTitle = function (msg) {
        var saved = L.load();
        render(
            flash(msg) +
            '<div class="title-menu">' +
            '<p class="tag">Buy a junker. Build a hot rod. Beat The King.</p>' +
            (saved ? '<button data-act="cont">Continue (week ' + saved.week + ', ' + money(saved.cash) + ')</button>' : '') +
            '<button data-act="new">New game</button>' +
            '<p class="hint">Summer, 1963. You have ' + money(L.START_CASH) + ' and a driver\'s license.</p>' +
            leadersBlock() +
            accountBlock() +
            '<p class="version" id="version">' + (version ? 'v' + esc(version) : '') + '</p>' +
            '</div>',
            {
                leaders: function () { L.showLeaders(); },
                login: function () { showAccount('login'); },
                register: function () { showAccount('register'); },
                signout: function () {
                    L.account.signOut().then(function (r) {
                        L.showTitle(r.cleared ? 'Signed out. Your game is safe in your account.' : 'Signed out. Your game is still saved in this browser.');
                    });
                },
                cont: function () {
                    g = saved;
                    var note = g.notice;          // what L.fixSave changed in an older save
                    if (note) { delete g.notice; L.save(g); }
                    L.showHub(note);
                },
                new: function () {
                    function start() {
                        g = L.newGame();
                        L.save(g);
                        L.showHub('Welcome to town. Check the classifieds for your first car.');
                    }
                    if (!saved) return start();
                    g = saved;   // so the question's status bar has something to show
                    ask('Start a new game? Your saved game (week ' + saved.week + ', ' + money(saved.cash) + ') will be lost.', 'Start over', start, L.showTitle);
                }
            }
        );
        L.titleScreen(true);
        fillLeaders();
        fillVersion();
    };

    // The game's version, v1.0 and the last merged pull request's number, from the
    // version.json the deploy writes (there's none when running from a checkout)
    var version = null;
    function fillVersion() {
        if (version !== null || !window.fetch) return;
        fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
            version = typeof d.version === 'string' ? d.version : '';
        }, function () { version = ''; }).then(function () {
            var el = document.getElementById('version');
            if (el && version) el.textContent = 'v' + version;
        });
    }

    // ── Leaderboards ──────────────────────────────────────────────────────
    // Kept on the server for signed-in players (api.php), so they only show when it answers

    var BOARDS = [
        { key: 'et', name: 'Fastest quarter mile', fmt: function (v) { return v.toFixed(2) + ' s'; } },
        { key: 'rt', name: 'Quickest reaction', fmt: function (v) { return v.toFixed(3) + ' s'; } },
        { key: 'streak', name: 'Longest win streak', fmt: function (v) { return v + (v === 1 ? ' win' : ' wins'); } },
        { key: 'cash', name: 'Most cash on hand', fmt: function (v) { return money(v); } }
    ].concat(L.KINGS.map(function (k, i) {
        // Fewest weeks from a new game to beating each era's King; the title shows the first's
        return { key: 'k' + i, name: 'Fewest weeks to ' + k.name, king: i, fmt: function (v) { return v + (v === 1 ? ' week' : ' weeks'); } };
    }));
    function titleBoards() { return BOARDS.filter(function (b) { return !b.king; }); }    // the first King's board has king 0
    function boardOf(key) { return BOARDS.filter(function (b) { return b.key === key; })[0]; }

    // The title's lines (the four boards and the first King's), each with the record holder; filled in once the server answers
    function leadersBlock() {
        if (!L.account || !L.account.available) return '';
        return '<div class="leaders-mini"><h3>Leaderboards</h3>' + titleBoards().map(function (b) {
            return '<button data-act="leaders" class="leader-line minor"><span class="what">' + b.name + '</span>' +
                '<span class="who" id="lead-' + b.key + '">...</span></button>';
        }).join('') + '</div>';
    }

    function fillLeaders() {
        if (!L.account || !L.account.available) return;
        L.account.leaders().then(function (res) {
            titleBoards().forEach(function (b) {
                var cell = document.getElementById('lead-' + b.key);
                if (!cell) return;       // the player moved on
                var top = res.boards && res.boards[b.key] && res.boards[b.key][0];
                cell.textContent = res.error ? '' : top ? b.fmt(top.value) + ' · ' + top.name : 'nobody yet';
            });
        });
    }

    function leaderRows(b, rows) {
        var me = L.account.user && L.account.user.username;
        if (!rows.length) return '<p class="sub">Nobody on this board yet. ' + (b.king !== undefined ? 'Beat this King and it\'s yours.' : 'Win some races and it\'s yours.') + '</p>';
        return '<ol class="board">' + rows.map(function (r, i) {
            return '<li' + (r.name === me ? ' class="you"' : '') + '><span class="rank">' + (i + 1) + '</span>' +
                '<span class="name">' + esc(r.name) + '</span><span class="val">' + b.fmt(r.value) + '</span></li>';
        }).join('') + '</ol>';
    }

    // The top 10 on every board, or (board set) one board's top 100
    var leadersShown = 0;
    L.showLeaders = function (board) {
        var shown = ++leadersShown;
        var b = board && boardOf(board);
        var back = b ? function () { L.showLeaders(); } : function () { L.showTitle(); };
        var bar = b ? backBar('Back', 'back', [['Title screen', 'title']]) : backBar('Back');
        var actions = { back: back, title: function () { L.showTitle(); }, board: function (key) { L.showLeaders(key); } };
        var heading = '<h2>' + (b ? b.name + ' <span class="sub">top 100</span>' : 'Leaderboards') + '</h2>';
        render('<div class="panel leaders">' + heading + '<p class="sub">Loading...</p></div>' + bar, actions);
        L.titleScreen(false);       // the boards are long: no title scene above them
        L.account.leaders(board).then(function (res) {
            if (shown !== leadersShown || !document.querySelector('.leaders')) return;    // the player moved on
            var note = L.account.user ? '' : '<p class="hint">Sign in on the title screen to get your name on the boards.</p>';
            var body = res.error ? '<p class="shot">' + esc(res.error) + '</p>'
                : b ? leaderRows(b, res.boards[b.key] || [])
                : '<p class="sub">Every signed-in player\'s best, from any game they\'ve played.</p><div class="boards">' + BOARDS.map(function (x) {
                    var rows = res.boards[x.key] || [];
                    return '<section><h3>' + x.name + '</h3>' + leaderRows(x, rows) +
                        (rows.length ? '<button data-act="board" data-arg="' + x.key + '" class="minor">Top 100</button>' : '') + '</section>';
                }).join('') + '</div>';
            render('<div class="panel leaders">' + heading + body + note + '</div>' + bar, actions);
        });
    };

    // ── Accounts ──────────────────────────────────────────────────────────

    function accountBlock() {
        var A = L.account;
        if (!A || !A.available) return '';
        if (A.user) {
            return '<p class="account">Signed in as <b>' + esc(A.user.username) + '</b>. Your game saves to your account.' +
                (A.error ? '<br><span class="shot">' + esc(A.error) + '</span>' : '') + '</p>' +
                '<button data-act="signout" class="minor">Sign out</button>';
        }
        return '<p class="account">Sign in to keep your game on any computer or phone.</p>' +
            '<div class="toggles"><button data-act="login" class="minor">Sign in</button>' +
            '<button data-act="register" class="minor">Create account</button></div>';
    }

    function savedOn(s) {
        return 'week ' + s.week + ', ' + money(s.cash) + (s.savedAt ? ', saved ' + new Date(s.savedAt).toLocaleString() : '');
    }

    // After any way of signing in: pick a game if the account and browser differ, then the title
    function signedIn(res, welcome, retry) {
        if (res.error) return retry(res.error);
        if (res.conflict) return showConflict(res.conflict);
        L.showTitle(welcome());
    }

    // Wires a form: on submit, disables its button with busy text and calls go(form)
    function onSubmit(id, busy, go) {
        var form = document.getElementById(id);
        form.querySelector('input').focus();
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = form.querySelector('button[type=submit]');
            btn.disabled = true;
            btn.textContent = busy;
            go(form);
        });
        return form;
    }

    function googleBlock() {
        return L.account.google ? '<div class="or"><span>or</span></div><div id="google-button" class="google-button"></div>' : '';
    }

    function wireGoogle(mode) {
        L.account.googleButton(document.getElementById('google-button'), function (credential) {
            L.account.signIn('google', { credential: credential }).then(function (res) {
                signedIn(res, function () { return 'Signed in with Google as ' + L.account.user.username + '.'; },
                    function (err) { showAccount(mode, err); });
            });
        });
    }

    // Sign in (mode 'login') or create an account ('register')
    function showAccount(mode, msg, name, email) {
        var reg = mode === 'register';
        render(
            flash(msg) +
            '<div class="panel account-form"><h2>' + (reg ? 'Create an account' : 'Sign in') + '</h2>' +
            '<form id="account-form">' +
            '<label>' + (reg ? 'Name' : 'Name or email') + ' <input name="username" autocomplete="username" maxlength="' + (reg ? 20 : 254) + '" required value="' + esc(name || '') + '"></label>' +
            (reg ? '<label>Email <input name="email" type="email" autocomplete="email" maxlength="254" required value="' + esc(email || '') + '"></label>' : '') +
            '<label>Password <input name="password" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '"' +
            (reg ? ' minlength="8"' : '') + ' maxlength="200" required></label>' +
            (reg ? '<p class="hint">A name of 3 to 20 letters, numbers or underscores, and a password of at least 8 characters. ' +
                'The email is only for resetting a forgotten password.</p>' : '') +
            '<button type="submit">' + (reg ? 'Create account' : 'Sign in') + '</button>' +
            '</form>' +
            (reg ? '' : '<p class="sub">Forgot your password? <button data-act="forgot" class="minor">Reset it</button></p>') +
            googleBlock() +
            '<p class="sub">' + (reg ? 'Already have an account?' : 'No account yet?') +
            ' <button data-act="other" class="minor">' + (reg ? 'Sign in' : 'Create one') + '</button></p></div>' +
            '<button data-act="back" class="minor">Back</button>',
            {
                other: function () { showAccount(reg ? 'login' : 'register'); },
                forgot: function () { showForgot(); },
                back: function () { L.showTitle(); }
            }
        );
        onSubmit('account-form', reg ? 'Creating...' : 'Signing in...', function (form) {
            var user = form.username.value.trim();
            var fields = { username: user, password: form.password.value };
            if (reg) fields.email = form.email.value.trim();
            L.account.signIn(mode, fields).then(function (res) {
                signedIn(res, function () {
                    return reg ? 'Account created. Your game now saves to it.' : 'Signed in. Welcome back, ' + L.account.user.username + '.';
                }, function (err) { showAccount(mode, err, user, fields.email); });
            });
        });
        wireGoogle(mode);
    }

    // Ask for a reset link by email
    function showForgot(msg) {
        render(
            flash(msg) +
            '<div class="panel account-form"><h2>Reset your password</h2>' +
            '<form id="forgot-form">' +
            '<label>Email on your account <input name="email" type="email" autocomplete="email" maxlength="254" required></label>' +
            '<button type="submit">Email me a reset link</button>' +
            '</form></div>' +
            '<button data-act="back" class="minor">Back</button>',
            { back: function () { showAccount('login'); } }
        );
        onSubmit('forgot-form', 'Sending...', function (form) {
            L.account.forgot(form.email.value.trim()).then(function (res) {
                if (res.error) return showForgot(res.error);
                showAccount('login', res.message);
            });
        });
    }

    // The link from the reset email lands here: choose a new password, which also signs in
    L.showReset = function (token, msg) {
        render(
            flash(msg) +
            '<div class="panel account-form"><h2>Choose a new password</h2>' +
            '<form id="reset-form">' +
            '<label>New password <input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="200" required></label>' +
            '<button type="submit">Save password and sign in</button>' +
            '</form></div>' +
            '<button data-act="back" class="minor">Never mind</button>',
            { back: function () { L.showTitle(); } }
        );
        onSubmit('reset-form', 'Saving...', function (form) {
            L.account.signIn('reset', { token: token, password: form.password.value }).then(function (res) {
                signedIn(res, function () { return 'New password saved. You\'re signed in as ' + L.account.user.username + '.'; },
                    function (err) { L.showReset(token, err); });
            });
        });
        L.titleScreen(true);
    };

    // The account and this browser hold different games: the player picks one to keep
    function showConflict(c) {
        render(
            '<div class="panel"><h2>Which game do you keep?</h2>' +
            '<p>Your account and this browser have different saved games. The one you don\'t pick is replaced.</p>' +
            '<nav class="menu"><button data-act="remote">Your account\'s game: ' + esc(savedOn(c.remote)) + '</button>' +
            '<button data-act="local" class="minor">This browser\'s game: ' + esc(savedOn(c.local)) + '</button></nav></div>',
            {
                remote: function () { L.account.choose('remote').then(function () { L.showTitle('Loaded your account\'s game.'); }); },
                local: function () { L.account.choose('local').then(function () { L.showTitle('This browser\'s game is now saved to your account.'); }); }
            }
        );
    }

    // ── Hub ───────────────────────────────────────────────────────────────

    // 12x12 pixel icons for the hub's tiles, one letter per pixel ('.' is see-through)
    var ICONS = {
        ads: { p: '#efe6cf', P: '#c9bc98', k: '#1d1a14', r: '#d7263d', rows: [
            '..pppppppp..', '..pkkkkkkP..', '..pppppppP..', '..pkkpkkkP..', '..pkkpppPP..', '..pppprrrP..',
            '..pkkprrrP..', '..pkkppppP..', '..pppkkkkP..', '..pkkppppP..', '..ppppppPP..', '...PPPPPP...'] },
        parts: { k: '#141414', t: '#3a3a3a', c: '#a0a8b8', h: '#e0e6f0', rows: [
            '...kkkkkk...', '.kkttttttkk.', '.kttkkkkttk.', 'kttkcccckttk', 'ktkcchhccktk', 'ktkchkkhcktk',
            'ktkchkkhcktk', 'ktkcchhccktk', 'kttkcccckttk', '.kttkkkkttk.', '.kkttttttkk.', '...kkkkkk...'] },
        garage: { o: '#3a3a44', w: '#8a3a26', d: '#5a2418', g: '#e0b040', G: '#8a6a30', rows: [
            '.oooooooooo.', 'oooooooooooo', '.wwwwwwwwww.', '.wddddddddw.', '.wdggggggdw.', '.wdGGGGGGdw.',
            '.wdggggggdw.', '.wdGGGGGGdw.', '.wdggggggdw.', '.wdGGGGGGdw.', '.wdggggggdw.', '.wwwwwwwwww.'] },
        stand: { b: '#e0a040', B: '#a86a20', s: '#fff3b0', l: '#3bb273', c: '#ffd23f', m: '#6a2a14', rows: [
            '............', '...bbbbbb...', '..bbsbbsbb..', '.bbbbbbbbbb.', '.BBBBBBBBBB.', '.llllllllll.',
            '.cccccccccc.', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.bbbbbbbbbb.', '..BBBBBBBB..', '............'] }
    };

    ICONS.paint = { k: '#1d1a14', c: '#a0a8b8', h: '#e0e6f0', r: '#d7263d', R: '#8a1424', s: '#ffd23f', rows: [
        '.........s..', '..kk...s.s..', '..cc..s.....', '..hc.....s..', '.rrrr.......', '.rRrr.......',
        '.rRrr.......', '.rRrr.......', '.rRrr.......', '.rRrr.......', '.rrrr.......', '.kkkk.......'] };

    ICONS.home = { r: '#d7263d', R: '#8a1424', w: '#f4e9c8', W: '#b8ad8c', d: '#5a2418', y: '#ffd23f', rows: [
        '.....rr.....', '....rrrr....', '...rrRRrr...', '..rrRRRRrr..', '.rrRRRRRRrr.', 'rrrrrrrrrrrr',
        '.wwwwwwwwww.', '.wyywwwddww.', '.wyywwwddww.', '.wwwwwwddww.', '.WWWWWWddWW.', '.WWWWWWddWW.'] };

    ICONS.dealer = { k: '#1d1a14', r: '#d7263d', R: '#8a1424', w: '#9ec8f0', s: '#ffd23f', t: '#3a3a3a', rows: [
        '.s.......s..', '...ssss.....', '..s....s....', '............', '...rrrrr....', '..rrwwwrr...',
        '.rrrrrrrrrr.', 'rRrrrrrrrrRr', 'rRRRRRRRRRRr', '.tt......tt.', '.kk......kk.', '............'] };

    function icon(name) {
        var ic = ICONS[name], out = '';
        ic.rows.forEach(function (row, y) {
            for (var x = 0; x < 12; x++) {
                var ch = row[x];
                if (ic[ch]) out += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + ic[ch] + '"/>';
            }
        });
        return '<svg class="icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">' + out + '</svg>';
    }

    function tile(act, name, title, sub, cls) {
        return '<button data-act="' + act + '" class="tile' + (cls ? ' ' + cls : '') + '">' + icon(name) +
            '<span><span class="tile-title">' + title + '</span><span class="tile-sub">' + sub + '</span></span></button>';
    }

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    L.showHub = function (msg) {
        L.titleScreen(false);
        var car = L.activeCar(g);
        var carHtml;
        if (car) {
            var st = carStats(car);
            var paint = L.carColor(car);
            carHtml = '<div class="card car-card"><h3><span class="swatch" style="background:' + paint + '"></span>' + esc(L.carName(car)) + '</h3>' +
                '<div class="chips"><span class="chip"><b>' + st.hp + '</b> hp</span>' +
                '<span class="chip"><b>' + st.et.toFixed(1) + '</b> s quarter mile</span>' +
                '<span class="chip"><b>' + Math.round(st.trap) + '</b> mph</span></div>' +
                '<div class="conds"><span>Engine ' + bar(car.engineCondition, 'Engine condition') + '</span>' +
                '<span>Body ' + bar(car.condition, 'Body condition') + '</span></div>' +
                (car.condition < L.MIN_BODY ? '<p class="shot">The body needs to be ' + L.MIN_BODY + '% to race.</p>' : '') + '</div>';
        } else {
            carHtml = '<div class="card car-card"><h3>No car yet</h3><p class="sub">The driveway is empty. Check the classifieds.</p></div>';
        }
        var stocked = L.catalogFor(g, car).filter(function (x) { return x.inStock && x.fits; }).length;
        render(
            status('hub') + flash(msg) +
            '<canvas class="scene" id="hub-scene" width="320" height="120" aria-hidden="true"></canvas>' +
            carHtml +
            '<nav class="menu tiles">' +
            tile('ads', 'ads', 'Classifieds', plural(g.ads.length, 'car') + ' for sale') +
            tile('parts', 'parts', 'Speed shop', stocked + (car ? ' parts for your car' : ' parts') + ' in stock') +
            tile('garage', 'garage', 'Garage', plural(g.cars.length, 'car') + ' · ' + plural(g.inventory.length, 'part') + ' on the shelf') +
            tile('paint', 'paint', 'Paint shop', car ? 'Colours, stripes and flames' : 'Bring a car') +
            tile('dealer', 'dealer', 'Dealership', L.beatAKing(g) ? 'Brand new cars, ' + L.dealerCars(g).length + ' on the lot' : '🔒 Beat The King to open', L.beatAKing(g) ? '' : 'locked') +
            tile('stand', 'stand', 'Burger stand',
                g.friday || g.hours === 0 ? 'Racing tonight' : 'Friday night: closes the garage', g.friday ? 'hot' : '') +
            '</nav>' +
            '<div class="hub-foot">' +
            '<button data-act="week">Next week</button>' +
            '<button data-act="quit" class="minor">Title screen</button>' +
            '<span class="toggles"><button data-act="sound" class="minor" id="sound">Sound: ' + (L.sound.on ? 'on' : 'off') + '</button>' +
            '<button data-act="music" class="minor" id="music">Music: ' + (L.sound.music ? 'on' : 'off') + '</button></span></div>',
            {
                sound: function () { document.getElementById('sound').textContent = 'Sound: ' + (L.sound.toggle() ? 'on' : 'off'); },
                music: function () { document.getElementById('music').textContent = 'Music: ' + (L.sound.toggleMusic() ? 'on' : 'off'); },
                ads: GO.ads,
                parts: GO.parts,
                garage: GO.garage,
                paint: GO.paint,
                dealer: GO.dealer,
                stand: function () { GO.stand(L.showHub); },
                week: function () {
                    L.newWeek(g);
                    var news = g.newEra ? L.ERAS[L.eraOf(g)].intro + ' Your garage grew too: room for ' + L.maxCars(g) + ' cars now.' : 'A new week. New ads, a restocked speed shop, new faces at the burger stand.';
                    delete g.newEra;
                    L.save(g);
                    L.showHub(news);
                },
                quit: function () { L.showTitle(); }
            }
        );
        var scene = document.getElementById('hub-scene');
        var sctx = scene.getContext('2d');
        L.drawHubScene(sctx, 320, 120, car ? L.carLook(car) : null, g.friday);
    };

    // ── Classifieds ───────────────────────────────────────────────────────

    // Phone extensions for the ads, so each reads like a real 1963 classified
    var EXCHANGES = ['ALpine', 'BUtterfield', 'CApitol', 'DIamond', 'EVergreen', 'FAirfax', 'GLadstone', 'HUdson'];

    L.showAds = function (msg) {
        var pots = g.ads.map(function (ad) { return L.potential(ad); });
        // Your pencil marks the best deal and the fastest build of the week
        var bestDeal = -1, fastest = -1;
        pots.forEach(function (p, i) {
            if (p.margin > 0 && (bestDeal < 0 || p.margin > pots[bestDeal].margin)) bestDeal = i;
        });
        // The fastest build, only when one car clearly beats the rest
        var ets = pots.map(function (p) { return p.builtEt; }).sort(function (a, b) { return a - b; });
        if (ets.length > 1 && ets[1] - ets[0] >= 0.1) {
            pots.forEach(function (p, i) { if (p.builtEt === ets[0]) fastest = i; });
        }
        var rows = g.ads.map(function (ad, i) {
            var p = pots[i], body = L.BODIES[ad.body];
            var marks = [];
            if (i === bestDeal) marks.push('Best deal!');
            if (i === fastest) marks.push('Fastest when built');
            var margin = p.margin >= 0
                ? '<b class="up">' + money(p.margin) + ' profit</b>'
                : '<b class="down">' + money(-p.margin) + ' loss</b>';
            var phone = EXCHANGES[(ad.price + i) % EXCHANGES.length] + ' ' + (5 + (ad.price % 4)) + '-' + ('000' + (ad.price * 7 + ad.condition * 13) % 10000).slice(-4);
            return '<article class="ad' + (marks.length ? ' circled' : '') + '">' +
                (marks.length ? '<span class="pencil">' + marks.join(' · ') + '</span>' : '') +
                '<canvas class="ad-car" width="96" height="48" data-ad="' + i + '" aria-hidden="true"></canvas>' +
                '<h3>' + esc(body.name.toUpperCase()) + '</h3>' +
                '<p class="copy">' + esc(ad.note) + ' ' + esc(p.family) + ', ' + body.kg + ' kg. Body ' + ad.condition + '%, engine ' + ad.engineCondition + '%. Call ' + phone + '.</p>' +
                '<p class="ad-price">' + money(ad.price) + '</p>' +
                '<div class="look"><h4>Mechanic\'s once-over</h4>' +
                '<dl>' +
                '<dt>Fix it all</dt><dd>' + (p.fixCost ? money(p.fixCost) + ' · ' + p.fixHours + ' h' : 'Nothing to fix') + '</dd>' +
                '<dt>Restored</dt><dd>sells for ' + money(p.restored) + ' (' + margin + ')</dd>' +
                '<dt>¼ mile</dt><dd><span class="et">' + p.asIs.toFixed(1) + ' s</span> as is · <span class="et">' + p.fixedEt.toFixed(1) + ' s</span> fixed · <span class="et best">' + p.builtEt.toFixed(2) + ' s</span> built</dd>' +
                '</dl>' +
                '<p class="build">Built: the Bestest ' + esc(p.family.toLowerCase()) + ' parts, about ' + money(p.buildCost) + ', ' + p.builtHp + ' hp.</p></div>' +
                '<button data-act="buy" data-arg="' + i + '" class="ink"' + (g.cash < ad.price ? ' disabled' : '') + '>' +
                (g.cash < ad.price ? 'Can\'t afford it' : 'Buy it for ' + money(ad.price)) + '</button></article>';
        }).join('');
        render(
            status('ads') + flash(msg) +
            '<div class="paper news">' +
            '<header class="masthead"><p class="dateline"><span>Week ' + g.week + ', summer ' + L.ERAS[L.eraOf(g)].year + '</span><span>Five cents</span></p>' +
            '<h2>The Lemon Gazette</h2>' +
            '<p class="section">Classified · Automobiles for sale</p></header>' +
            (rows ? '<div class="ads">' + rows + '</div>' : '<p class="empty">No autos this week. Try again next week.</p>') +
            '<p class="fineprint">"Restored" is the price with every part fixed and the body like new. "Built" is the car with every Bestest part for its engine, and an expert at the wheel.</p>' +
            '</div>' +
            backBar('Back'),
            {
                buy: act(L.showAds, function (i) { return L.buyAd(g, +i) || 'Sold! It\'s in your garage.'; }),
                back: function () { L.showHub(); }
            }
        );
        // Each ad's photo: the car in its paint, gone toward rust as the body gets worse
        app.querySelectorAll('canvas.ad-car').forEach(function (c) {
            var ad = g.ads[+c.getAttribute('data-ad')];
            var paint = L.art.mix(L.BODIES[ad.body].color, '#7a4a2a', (100 - ad.condition) / 100 * 0.7);
            L.drawCar(c.getContext('2d'), 4, 2, paint, { scale: 2, shape: L.BODIES[ad.body].shape });
        });
    };

    // ── Dealership ────────────────────────────────────────────────────────

    // Brand new cars from every era you've reached, open once you've beaten a King: stock,
    // in factory paint, at L.NEW_CAR_PRICE times what one fetches restored
    L.showDealer = function (msg) {
        if (!L.beatAKing(g)) return L.showHub('The dealership only sells to the King of the strip. Beat The King first.');
        var cars = L.dealerCars(g), lastEra = -1, html = '';
        cars.forEach(function (id) {
            var body = L.BODIES[id], era = body.era || 0;
            if (era !== lastEra) {
                html += (lastEra >= 0 ? '</div>' : '') + '<h3 class="lot-era">' + L.ERAS[era].year + ' models</h3><div class="lot">';
                lastEra = era;
            }
            var st = carStats(L.newCar(id)), price = L.newCarPrice(id);
            var err = L.canBuyNew(g, id);
            html += '<article class="lot-car">' +
                '<canvas class="lot-pic" width="96" height="48" data-body="' + id + '" aria-hidden="true"></canvas>' +
                '<h4>' + esc(body.name) + '</h4>' +
                '<p class="sub">' + st.hp + ' hp · ' + st.et.toFixed(2) + ' s · ' + body.kg + ' kg</p>' +
                '<p class="price">' + money(price) + '</p>' +
                '<button data-act="buy" data-arg="' + id + '"' + (err ? ' disabled' : '') + '>' +
                (err && g.cash < price ? "Can't afford it" : err && g.cars.length >= L.maxCars(g) ? 'Garage full' : 'Buy it new') + '</button></article>';
        });
        render(
            status('dealer') + flash(msg) +
            '<div class="panel dealer"><h2>Lemon Motors <span class="sub">new cars</span></h2>' +
            '<p class="sub">Every car from the years you\'ve raced in, straight from the factory: stock parts, 100% body and engine, and nothing to fix. ' +
            'It costs more than one restored, and it\'s worth what one restored is the moment you drive it off the lot.</p>' +
            html + (html ? '</div>' : '') + '</div>' + backBar('Back'),
            {
                buy: act(L.showDealer, function (id) { return L.buyNew(g, id) || 'She\'s yours. The ' + L.BODIES[id].name + ' is in your garage.'; }),
                back: function () { L.showHub(); }
            }
        );
        app.querySelectorAll('canvas.lot-pic').forEach(function (c) {
            var body = L.BODIES[c.getAttribute('data-body')];
            L.drawCar(c.getContext('2d'), 4, 2, body.color, { scale: 2, shape: body.shape });
        });
    };

    // ── Parts catalog ─────────────────────────────────────────────────────

    L.showParts = function (msg) {
        var car = L.activeCar(g);
        var catalog = L.catalogFor(g, car);
        function row(x) {
            var p = L.PARTS[x.id];
            var owned = g.inventory.filter(function (id) { return id === x.id; }).length;
            var fitted = car && car.parts[p.slot] === x.id;
            return '<div class="row' + (x.inStock ? '' : ' out') + '"><span><span class="cls cls' + p.cls + '">' + L.CLASSES[p.cls] + '</span> ' + esc(p.name) +
                (p.legend ? ' <em class="legend-note">· widens your green shift zone</em>' : '') +
                (fitted ? ' <em>· on your car</em>' : '') + (owned ? ' <em>· ' + owned + ' on your shelf</em>' : '') + '</span>' +
                '<span class="price">' + money(p.price) + '</span>' +
                (x.inStock
                    ? '<button data-act="buy" data-arg="' + x.id + '"' + (g.cash < p.price ? ' disabled' : '') + '>Buy</button>'
                    : '<span class="soldout">Sold out</span>') + '</div>';
        }
        // A group of parts, slot by slot, with a heading per slot
        function slots(items) {
            return L.SLOTS.map(function (slot) {
                var these = items.filter(function (x) { return L.PARTS[x.id].slot === slot; });
                return these.length ? '<h4>' + L.SLOT_NAMES[slot] + '</h4>' + these.map(row).join('') : '';
            }).join('');
        }
        function group(title, items, open) {
            var stocked = items.filter(function (x) { return x.inStock; }).length;
            return '<details class="shop-group"' + (open ? ' open' : '') + '><summary><h3>' + esc(title) + '</h3>' +
                '<span class="sub">' + stocked + ' of ' + items.length + ' in stock</span></summary>' + slots(items) + '</details>';
        }
        function family(fam) {
            var yours = fam === mine ? [] : g.cars.filter(function (c) { return L.PARTS[c.parts.engine].fam === fam; });
            return group((fam === mine ? 'For your ' : '') + L.FAMILIES[fam].name + ' engines and parts' +
                (yours.length ? ', for your ' + L.carName(yours[0]) + (yours.length > 1 ? ' and ' + (yours.length - 1) + ' more' : '') : ''),
                catalog.filter(function (x) { return L.PARTS[x.id].fam === fam; }), fam === mine || !car);
        }
        // Your engine's family, then what fits anything, then the other families folded away
        // for a swap
        var mine = car ? L.PARTS[car.parts.engine].fam : null;
        // Newest era first: its families and its parts that fit anything
        var eras = [];
        for (var e = L.eraOf(g); e >= 0; e--) eras.push(e);
        var others = [];
        eras.forEach(function (e) {
            Object.keys(L.FAMILIES).forEach(function (fam) { if (fam !== mine && L.FAMILIES[fam].era === e) others.push(fam); });
        });
        var html = (mine ? family(mine) : '') +
            eras.map(function (e, n) {
                return group('Fits anything' + (eras.length > 1 ? ', ' + L.ERAS[e].year : ''),
                    catalog.filter(function (x) { return !L.PARTS[x.id].fam && L.PARTS[x.id].era === e; }), n === 0);
            }).join('') +
            others.map(family).join('');
        var intro = car
            ? 'Your ' + esc(L.carName(car)) + ' has the ' + esc(L.PARTS[car.parts.engine].name) + '. Carbs, intakes, cams and exhausts only fit their own engine family; engines and the rest fit anything.'
            : 'Everything we carry. Buy a car and we\'ll put what fits it first.';
        render(
            status('parts') + flash(msg) + '<div class="panel"><h2>Speed Shop</h2><p class="sub">' + intro +
            (L.beatTheGame(g) ? ' You beat The Last King, so every part is in stock, every week.'
                : ' The shelves restock every week with something for every engine, but not every part every week, and the Bestest parts sell out fast.') +
            ' Bestest+ is a hair quicker than Bestest at five times the price. Now and then a Legendary part turns up: as quick as Bestest+, and every one on your car widens the green shift zone.</p>' +
            catalog.filter(function (x) { return L.PARTS[x.id].legend; }).map(function (x) {
                var p = L.PARTS[x.id];
                return '<p class="legend-find"><span class="cls cls5">Legendary</span> Just in: the ' + esc(p.name) + ', ' + money(p.price) +
                    (car && !x.fits ? '. It doesn\'t fit your engine.' : '. It won\'t be here long.') + '</p>';
            }).join('') + html + '</div>' +
            backBar('Back', 'back', [['Garage', 'garage']]),
            {
                buy: act(L.showParts, function (id) { return L.buyPart(g, id) || 'Bought. It\'s on your garage shelf.'; }),
                garage: function () { L.showGarage(); },
                back: function () { L.showHub(); }
            }
        );
    };

    // ── Paint shop ────────────────────────────────────────────────────────

    // What you've picked so far; a fresh visit starts from how the car looks now
    var pick = null;

    L.showPaint = function (msg) {
        var car = L.activeCar(g);
        if (!car) return L.showHub('You need a car first.');
        if (!pick || pick.car !== car.id) pick = { car: car.id, paint: null, livery: car.livery || 'none', trim: car.trim || 'white' };
        var preview = { body: car.body, paint: pick.paint || car.paint, livery: pick.livery, trim: pick.trim };
        var usesTrim = pick.livery !== 'none' && !L.LIVERIES[pick.livery].ownColors;
        var cost = L.paintCost(car, pick.paint, pick.livery, pick.trim);
        var err = L.canPaint(g, pick.paint, pick.livery, pick.trim);

        function swatches(act, chosen, priced) {
            return '<div class="swatches">' + Object.keys(L.PAINTS).map(function (id) {
                var p = L.PAINTS[id];
                return '<button data-act="' + act + '" data-arg="' + id + '" class="swatch-btn' + (id === chosen ? ' on' : '') + '" aria-pressed="' + (id === chosen) + '">' +
                    '<span class="swatch" style="background:' + p.hex + '"></span><span>' + esc(p.name) +
                    (priced ? '<small>' + (id === car.paint ? 'yours now' : money(p.price)) + '</small>' : '') + '</span></button>';
            }).join('') + '</div>';
        }

        render(
            status('paint') + flash(msg) +
            '<div class="panel paint-shop"><h2>Paint shop</h2>' +
            '<p class="sub">Sal\'s Custom Paint does it while you wait, so it takes none of your garage hours. It only changes the looks, not what she\'s worth.</p>' +
            '<canvas class="paint-preview" id="paint-preview" width="192" height="96" aria-label="How the car will look"></canvas>' +
            '<h3>Colour</h3>' + swatches('paint', pick.paint || car.paint || null, true) +
            '<h3>Livery</h3><div class="swatches">' + Object.keys(L.LIVERIES).map(function (id) {
                var lv = L.LIVERIES[id], locked = id !== (car.livery || 'none') && L.liveryLocked(g, id);
                return '<button data-act="livery" data-arg="' + id + '" class="swatch-btn' + (id === pick.livery ? ' on' : '') + (locked ? ' locked' : '') + '" aria-pressed="' + (id === pick.livery) + '"' + (locked ? ' disabled' : '') + '>' +
                    '<span>' + (locked ? '🔒 ' : '') + esc(lv.name) + '<small>' + (locked ? 'Beat The King first' : id === (car.livery || 'none') ? 'yours now' : lv.price ? money(lv.price) : 'free') + '</small></span></button>';
            }).join('') + '</div>' +
            (usesTrim ? '<h3>' + esc(L.LIVERIES[pick.livery].name) + ' colour</h3>' + swatches('trim', pick.trim, false) : '') +
            '<div class="paint-total"><span>' + (cost ? 'Total ' + money(cost) : 'Nothing to pay') + '</span>' +
            '<button data-act="go"' + (err ? ' disabled' : '') + '>Paint it</button></div>' +
            (err && err.indexOf('already') < 0 ? '<p class="sub">' + esc(err) + '</p>' : '') +
            '</div>' + backBar('Back'),
            {
                paint: function (id) { pick.paint = id === car.paint ? null : id; keepScroll = true; L.showPaint(); },
                livery: function (id) { pick.livery = id; keepScroll = true; L.showPaint(); },
                trim: function (id) { pick.trim = id; keepScroll = true; L.showPaint(); },
                go: function () {
                    var e = L.paintCar(g, pick.paint, pick.livery, pick.trim);
                    if (!e) { L.sound.cash(); L.sound.spray(1.2); pick = null; L.save(g); }
                    keepScroll = true;
                    L.showPaint(e || 'Fresh from the booth. She looks sharp.');
                },
                back: function () { pick = null; L.showHub(); }
            }
        );
        var cv = document.getElementById('paint-preview');
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#1f1f38';
        ctx.fillRect(0, 0, 192, 96);
        ctx.fillStyle = '#3a3a3e';
        ctx.fillRect(0, 84, 192, 12);
        L.drawCar(ctx, 8, 2, L.carLook(preview), { scale: 4 });
    };

    // ── Garage ────────────────────────────────────────────────────────────

    // The mechanic's once-over for a car you own, like the classifieds': what restoring it
    // earns over selling it as it is, and how fast it is now, fixed and fully built
    function onceOver(car) {
        var p = L.carPotential(car);
        var gain = p.margin >= 0 ? '<b class="up">+' + money(p.margin) + '</b>' : '<b class="down">−' + money(-p.margin) + '</b>';
        return '<div class="look garage-look"><h4>Mechanic\'s once-over</h4><dl>' +
            (p.fixCost
                ? '<dt>Restored</dt><dd>sells for ' + money(p.restored) + '</dd>' +
                  '<dt>Fix it all</dt><dd>' + money(p.fixCost) + ' · ' + p.fixHours + ' h</dd>' +
                  '<dt>Worth it?</dt><dd>' + money(p.restored) + ' − ' + money(p.fixCost) + ' fix − ' + money(L.carValue(car)) +
                  ' it sells for now = ' + gain + '</dd>'
                : '<dt>Restored</dt><dd>already in top shape</dd>') +
            '<dt>¼ mile</dt><dd><span class="et">' + p.asIs.toFixed(2) + ' s</span> now · <span class="et">' + p.fixedEt.toFixed(2) + ' s</span> fixed · <span class="et best">' + p.builtEt.toFixed(2) + ' s</span> built</dd>' +
            '</dl><p class="build">' + (p.buildCost ? 'Built: the Bestest ' + esc(p.family.toLowerCase()) + ' parts it doesn\'t have yet, about ' + money(p.buildCost) + ', ' + p.builtHp + ' hp.'
                : 'Already built with the Bestest ' + esc(p.family.toLowerCase()) + ' parts.') + '</p></div>';
    }

    // A car's name coloured by its build (L.carTier), with a badge: grey for stock, a class's
    // colour for a built car, gold and a crown for a King's car
    function tierName(c) {
        var t = L.carTier(c);
        var cls = t === 'king' ? 'king' : 't' + t;
        return '<span class="car-tier ' + cls + '"><span class="tier-badge">' + (t === 'king' ? '♛ King' : L.CLASSES[t]) + '</span> ' +
            '<span class="car-name">' + esc(L.carName(c)) + '</span></span>';
    }

    // Each part on a car, coloured by class, with its condition
    function partRows(car) {
        return L.SLOTS.map(function (slot) {
            return '<div class="row"><span><span class="slot">' + L.SLOT_NAMES[slot] + '</span>' + partName(car.parts[slot]) + '</span>' +
                '<span>' + bar(L.partCondition(car, slot), 'Condition') + '</span></div>';
        }).join('');
    }

    // A good look at one of your cars: its picture in its paint, the dyno, body and every part.
    // Looking doesn't change which car you drive; Drive this one does.
    L.showCar = function (i) {
        var c = g.cars[i];
        if (!c) return L.showGarage();
        var st = carStats(c);
        var t = L.carTier(c);
        render(
            status('garage') +
            '<div class="panel car-view ' + (t === 'king' ? 'king' : 't' + t) + '"><h2>' + tierName(c) + '</h2>' +
            '<div class="car-stage"><canvas id="car-view" width="200" height="100" aria-label="' + esc(L.carName(c)) + '"></canvas></div>' +
            (c.king ? '<p class="won-from">Won from ' + esc(c.king) + ' for pink slips.</p>' : '') +
            '<div class="dyno">' +
            '<p><b>' + st.hp + ' hp</b> at ' + st.hpRpm + ' rpm · redline ' + st.redline + '</p>' +
            '<p>0-60 ' + (st.zeroSixty ? st.zeroSixty.toFixed(1) + ' s' : 'n/a') + ' · quarter mile ' + st.et.toFixed(2) + ' s at ' + Math.round(st.trap) + ' mph</p>' +
            '<p>Body ' + bar(c.condition, 'Body condition') + ' · engine ' + bar(c.engineCondition, 'Engine condition') + '</p>' +
            '<p class="sub">Sells for ' + money(L.carValue(c)) + ' as it is.</p></div>' +
            partRows(c) +
            '<div class="car-btns">' + (i === g.active ? '<span class="price">You\'re driving this one</span>' : '<button data-act="drive">Drive this one</button>') + '</div>' +
            '</div>' + backBar('Back to the garage'),
            {
                drive: function () { g.active = i; L.save(g); L.showGarage('You\'re driving the ' + L.carName(c) + '.'); },
                back: function () { L.showGarage(); }
            }
        );
        var cv = document.getElementById('car-view');
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#1f1f38';
        ctx.fillRect(0, 0, 200, 100);
        ctx.fillStyle = '#3a3a3e';
        ctx.fillRect(0, 88, 200, 12);
        L.drawCar(ctx, 12, 2, L.carLook(c), { scale: 4 });
    };

    // The shelf grouped by slot in the car's order, each group headed by what's on your car now,
    // best class and best condition first. A part that beats what's fitted says so; one that
    // doesn't fit your engine says what it fits instead of offering to install.
    function shelfGroups(car) {
        if (!g.inventory.length) return '<p>Nothing on the shelf. Parts you buy and parts you take off land here.</p>';
        return L.SLOTS.map(function (slot) {
            var items = [];
            g.inventory.forEach(function (id, i) { if (L.PARTS[id].slot === slot) items.push({ id: id, i: i, cls: L.PARTS[id].cls, cond: L.shelfCondition(g, i) }); });
            if (!items.length) return '';
            items.sort(function (a, b) { return b.cls - a.cls || b.cond - a.cond; });
            var fitted = car && L.PARTS[car.parts[slot]];
            return '<div class="shelf-group"><h3><span>' + L.SLOT_NAMES[slot] + ' <span class="count">' + items.length + '</span></span>' +
                (fitted ? '<span class="on-car">On your car: ' + partName(car.parts[slot]) + '</span>' : '') + '</h3>' +
                items.map(function (it) {
                    var fits = !car || L.fits(it.id, car.parts.engine);
                    var reb = L.shelfRebuild(g, it.i), value = L.partValue(g, it.i);
                    var others = fits ? [] : L.carsItFits(g, it.id);
                    var tag = !fits ? '<span class="shelf-tag no">Fits a ' + esc(L.FAMILIES[L.PARTS[it.id].fam].name.toLowerCase()) +
                            (others.length ? ', like your ' + esc(L.carName(others[0])) + (others.length > 1 ? ' and ' + (others.length - 1) + ' more' : '') : '') + '</span>'
                        : fitted && it.cls > fitted.cls ? '<span class="shelf-tag up">▲ Upgrade</span>' : '';
                    return '<div class="shelf-item' + (fits ? '' : ' nofit') + '">' +
                        '<span class="shelf-name">' + partName(it.id) + ' <span class="shelf-cls t' + it.cls + '">' + L.CLASSES[it.cls] + '</span>' + tag + '</span>' +
                        '<span class="shelf-cond">' + (it.cond < 100 ? bar(it.cond, 'Condition') : '<span class="like-new">Like new</span>') + '</span>' +
                        '<span class="shelf-acts">' +
                        (car && fits ? '<button data-act="install" data-arg="' + it.i + '">Install · ' + L.JOB_HOURS[slot] + ' h</button>' : '') +
                        (reb ? '<button data-act="rebuild" data-arg="' + it.i + '" class="minor">Rebuild ' + money(reb.cost) + ' · ' + reb.hours + ' h</button>' : '') +
                        '<button data-act="sellpart" data-arg="' + it.i + '" class="minor">' + (value ? 'Sell ' + money(value) : 'Bin it') + '</button></span></div>';
                }).join('') + '</div>';
        }).join('');
    }

    L.showGarage = function (msg) {
        var car = L.activeCar(g);
        var cars = g.cars.map(function (c, i) {
            var p = L.carPotential(c);
            return '<div class="row' + (i === g.active ? ' active' : '') + '"><span>' + tierName(c) +
                ' · <span class="fam">' + esc(L.FAMILIES[L.PARTS[c.parts.engine].fam].name) + '</span>' +
                ' · sells for ' + money(L.carValue(c)) +
                '<small class="potential">' + (p.fixCost ? 'Restoring earns ' + (p.margin >= 0 ? '+' + money(p.margin) : '−' + money(-p.margin)) + ' · ' : '') +
                'built ' + p.builtEt.toFixed(2) + ' s</small></span>' +
                '<span class="car-acts"><button data-act="view" data-arg="' + i + '" class="minor">View</button>' +
                (i === g.active ? '<span class="price">Driving</span>' : '<button data-act="drive" data-arg="' + i + '">Drive</button>') +
                '<button data-act="sell" data-arg="' + i + '" class="minor">Sell</button>' +
                '<button data-act="strip" data-arg="' + i + '" class="minor">Strip</button></span></div>';
        }).join('') || '<p>No cars. Check the classifieds.</p>';

        var detail = '';
        if (car) {
            var st = carStats(car);
            var fix = L.fixAll(car);
            detail = '<div class="panel"><h2>' + tierName(car) + '</h2>' +
                '<div class="dyno">' +
                '<p><b>' + st.hp + ' hp</b> at ' + st.hpRpm + ' rpm · redline ' + st.redline + '</p>' +
                '<p>0-60 ' + (st.zeroSixty ? st.zeroSixty.toFixed(1) + ' s' : 'n/a') + ' · quarter mile ' + st.et.toFixed(2) + ' s at ' + Math.round(st.trap) + ' mph</p>' +
                '<p>Body ' + bar(car.condition, 'Body condition') + (car.condition < L.MIN_BODY ? ' <span class="shot">needs ' + L.MIN_BODY + '% to race</span>' : '') + '</p>' +
                '<p class="sub">Sells for ' + money(L.carValue(car)) + ' as it is.</p>' +
                (fix.cost ? '' : '<p class="sub">Everything is in good shape.</p>') +
                '<div class="car-btns">' + (fix.cost ? '<button data-act="fix">Fix car (' + money(fix.cost) + ', ' + fix.hours + ' h for everything)</button>' : '') +
                '<button data-act="shop">Shop for parts</button></div>' +
                '</div>' + onceOver(car) + partRows(car) + '</div>';
        }

        var shelf = shelfGroups(car);
        render(
            status('garage') + flash(msg) +
            '<div class="panel"><h2>Your cars <span class="sub">' + g.cars.length + ' of ' + L.maxCars(g) + '</span></h2>' + cars + '</div>' + detail +
            '<div class="panel shelf"><h2>Shelf' + (g.inventory.length ? ' <span class="sub">' + plural(g.inventory.length, 'part') +
                ' · worth ' + money(g.inventory.reduce(function (sum, id, i) { return sum + L.partValue(g, i); }, 0)) + '</span>' : '') + '</h2>' + shelf + '</div>' +
            backBar('Back'),
            {
                drive: act(L.showGarage, function (i) { g.active = +i; }),
                view: function (i) { L.showCar(+i); },
                sell: function (i) {
                    var c = g.cars[+i];
                    ask('Sell your ' + L.carName(c) + ' for ' + money(L.carValue(c)) + '?' +
                        (L.restoredValue(c) > L.carValue(c) ? ' Restored, it would fetch about ' + money(L.restoredValue(c)) + '.' : ''), 'Sell it',
                        act(L.showGarage, function () { return L.sellCar(g, +i) || 'Sold.'; }), L.showGarage);
                },
                strip: function (i) {
                    var c = g.cars[+i];
                    var err = L.canStrip(g, +i);
                    if (err) return L.showGarage(err);
                    ask('Strip your ' + L.carName(c) + ' for parts? It takes ' + L.STRIP_HOURS + ' hours. Speed parts and the engine go on your shelf as they are, stock parts go in the bin, and the shell goes for ' +
                        money(L.stripValue(c)) + ' scrap.', 'Strip it',
                        act(L.showGarage, function () { return L.stripCar(g, +i); }), L.showGarage);
                },
                install: function (i) {
                    var err = L.canInstall(g, +i);
                    if (err) return L.showGarage(err);
                    var part = L.PARTS[g.inventory[+i]];
                    function go() {
                        wrench(part.slot, 'Installing: ' + part.name, L.PARTS[car.parts[part.slot]].name, part.name,
                            act(L.showGarage, function () {
                                var out = {};
                                return L.installPart(g, +i, out) || 'Installed the ' + part.name + '.' +
                                    (out.shelved.length ? ' The old ' + out.shelved.join(', ') + ' went on the shelf.' : '') +
                                    (out.binned.length ? ' The old ' + out.binned.join(', ') + (out.binned.length > 1 ? ' were' : ' was') + ' shot, so ' + (out.binned.length > 1 ? 'they' : 'it') + ' went in the bin.' : '');
                            }), L.showGarage);
                    }
                    // An engine from another family takes the carb, intake, cam and exhaust with it
                    var swap = L.swapPreview(g, +i);
                    if (!swap) return go();
                    var fam = L.FAMILIES[part.fam].name.toLowerCase();
                    ask('The ' + part.name + ' is a ' + fam + ', and your carb, intake, cam and exhaust only fit a ' +
                        L.FAMILIES[L.PARTS[car.parts.engine].fam].name.toLowerCase() + '. They come off and go on the shelf, and the car gets the new engine\'s stock ones.' +
                        (swap.lost.length ? ' That takes off your ' + swap.lost.map(function (id) { return L.PARTS[id].name; }).join(', ') + '.' : '') +
                        ' With those, your quarter mile goes from ' + swap.et.toFixed(2) + ' s to about ' + swap.newEt.toFixed(2) + ' s.' +
                        (swap.fits ? ' You have ' + plural(swap.fits, 'part') + ' on your shelf that ' + (swap.fits === 1 ? 'fits' : 'fit') + ' a ' + fam + '.' : ' Nothing on your shelf fits a ' + fam + ' yet.'),
                        'Swap the engine', go, L.showGarage);
                },
                sellpart: act(L.showGarage, function (i) { return L.sellPart(g, +i); }),
                rebuild: act(L.showGarage, function (i) {
                    var name = L.PARTS[g.inventory[+i]].name;
                    return L.rebuildShelf(g, +i) || 'Rebuilt the ' + name + '. It\'s like new, and worth ' + money(L.partValue(g, +i)) + ' now.';
                }),
                fix: function () { L.showFix(); },
                shop: function () { L.showParts(); },
                back: function () { L.showHub(); }
            }
        );
    };

    // ── Fix car: what's worn, what it costs, then the workbench ───────────

    L.showFix = function (msg) {
        var car = L.activeCar(g);
        if (!car) return L.showGarage('You need a car first.');
        var total = L.fixAll(car);
        function cost(dollars, hours) { return money(dollars) + ' · ' + hours + ' h'; }
        function can(dollars, hours) { return g.cash >= dollars && !g.friday && g.hours >= hours; }

        // The body first: it decides whether you can race at all
        var patch = L.bodyJob(car, L.MIN_BODY), full = L.bodyJob(car, 100);
        var bodyBtns = !full.points ? '<span class="price">Good</span>' :
            (patch.points ? '<button data-act="body" data-arg="' + L.MIN_BODY + '"' + (can(patch.cost, patch.hours) ? '' : ' disabled') + '>Patch to ' + L.MIN_BODY + '% ' + cost(patch.cost, patch.hours) + '</button>' : '') +
            '<button data-act="body" data-arg="100"' + (patch.points ? ' class="minor"' : '') + (can(full.cost, full.hours) ? '' : ' disabled') + '>Restore to 100% ' + cost(full.cost, full.hours) + '</button>';
        var bodyRow = '<div class="row fix"><span><span class="slot">Body</span>' + (car.condition < L.MIN_BODY ? '<span class="shot">Too rough to race</span>' : 'Paint and panels') + '<br>' +
            bar(car.condition, 'Condition') + '</span>' + bodyBtns + '</div>';

        var rows = L.diagnose(car).map(function (d) {
            var name = partName(d.part);
            var btns;
            if (d.action === 'ok') {
                btns = '<span class="price">Good</span>';
            } else if (d.action === 'repair') {
                btns = '<button data-act="repair" data-arg="' + d.slot + '"' + (can(d.cost, d.hours) ? '' : ' disabled') + '>' +
                    (d.slot === 'engine' ? 'Rebuild ' : 'Repair ') + cost(d.cost, d.hours) + '</button>';
            } else {
                var stocked = L.inStock(g, d.part);
                btns = '<span class="shot">' + (d.slot === 'tires' ? 'Worn out' : 'Shot, replace it') + '</span>' +
                    '<button data-act="junk" data-arg="' + d.slot + '"' + (can(d.junk, d.hours) ? '' : ' disabled') + '>Used stock ' + cost(d.junk, d.hours) + '</button>' +
                    (d.fresh ? '<button data-act="new" data-arg="' + d.slot + '" class="minor"' + (stocked && can(d.fresh, d.hours) ? '' : ' disabled') + '>' +
                        (stocked ? 'New ' + cost(d.fresh, d.hours) : 'New: sold out this week') + '</button>' : '');
            }
            return '<div class="row fix"><span><span class="slot">' + L.SLOT_NAMES[d.slot] + '</span>' + name + '<br>' +
                bar(d.condition, 'Condition') + '</span>' + btns + '</div>';
        }).join('');
        var budget = total.cost
            ? 'Fixing everything costs ' + money(total.cost) + ' and ' + total.hours + ' hours. You have ' + money(g.cash) +
                (g.friday ? ', and it\'s Friday night: the garage opens again next week.' : ' and ' + g.hours + ' hours before Friday.') +
                (total.cost > g.cash || total.hours > g.hours ? ' Pick what matters: the body has to be ' + L.MIN_BODY + '% to race, and the engine and tires matter most.' : '')
            : 'Everything is in good shape.';

        function job(slot, how) {
            var part = L.PARTS[car.parts[slot]];
            var err = how === 'repair' ? L.canRepairPart(g, slot) : L.canReplacePart(g, slot, how);
            if (err) return L.showFix(err);
            var title, oldName = 'worn ' + part.name, newName;
            if (slot === 'engine') { title = 'Rebuilding the ' + part.name; oldName = 'worn cylinder heads'; newName = 'rebuilt heads'; }
            else if (how === 'repair') { title = 'Repairing the ' + part.name; newName = 'rebuilt ' + part.name; }
            else if (how === 'new') { title = 'Replacing the ' + part.name; newName = 'new ' + part.name; }
            else { title = 'Fitting a junkyard part'; newName = 'used ' + L.PARTS[L.stockPart(car.parts.engine, slot)].name; }
            wrench(slot === 'engine' ? 'rebuild' : slot, title, oldName, newName, act(L.showFix, function () {
                var e = how === 'repair' ? L.repairPart(g, slot) : L.replacePart(g, slot, how);
                return e || (slot === 'engine' ? 'Engine rebuilt. Good as new.' : 'The ' + L.SLOT_NAMES[slot].toLowerCase() + ' is sorted.');
            }), L.showFix);
        }

        function bodyJob(target) {
            target = +target;
            var err = L.canBodywork(g, target);
            if (err) return L.showFix(err);
            var spec = L.bodyJob(car, target);
            bench(function (canvas, onLine, done) {
                return L.startBodywork(canvas, {
                    spots: spec.spots, color: L.carLook(car), onLine: onLine,
                    title: (target === 100 ? 'Restoring the ' : 'Patching up the ') + L.carName(car)
                }, done);
            }, act(L.showFix, function () {
                return L.bodywork(g, target) || (target === 100 ? 'Fresh paint. She looks like new.' : 'Patched and primed. Good enough to race.');
            }), L.showFix);
        }

        // Fix all, every job at once without the workbench, once you've beaten a King
        var plan = L.fixAllPlan(g), fixErr = L.canFixAll(g), unlocked = L.beatAKing(g);
        var fixAllRow = !plan.jobs.length ? '' : '<div class="fix-all' + (unlocked ? '' : ' locked') + '">' +
            '<button data-act="fixall"' + (fixErr ? ' disabled' : '') + '>' + (unlocked ? 'Fix all ' + cost(plan.cost, plan.hours) : '🔒 Fix all') + '</button>' +
            '<span class="sub">' + (unlocked ? (fixErr ? esc(fixErr) : 'Every job at once, no workbench.') : 'Beat The King to unlock: every job at once, no workbench.') + '</span></div>';

        render(
            status('garage') + flash(msg) +
            '<div class="panel"><h2>Fix the ' + esc(L.carName(car)) + '</h2><p class="sub">' + budget + '</p>' + fixAllRow + bodyRow + rows + '</div>' +
            '<p class="hint">Each job opens the workbench: bolts out and back in for parts, grind and fill the rust for bodywork. Jobs use up your garage hours for the week.</p>' +
            backBar('Back to the garage'),
            {
                repair: function (slot) { job(slot, 'repair'); },
                junk: function (slot) { job(slot, 'junk'); },
                new: function (slot) { job(slot, 'new'); },
                body: bodyJob,
                fixall: act(L.showFix, function () { return L.fixEverything(g) || 'All done. Every job on her is sorted.'; }),
                back: function () { L.showGarage(); }
            }
        );
    };

    // A job on the workbench canvas. start(canvas, onLine, done) starts it and returns a
    // stop function; finish() runs when the job is done, back(msg) if you walk away from it.
    function bench(start, finish, back) {
        render('<div class="race-controls"><p class="hint" id="wrench-line"></p>' +
            '<button data-act="cancel" class="minor">Leave it for now</button></div>', {
            cancel: function () { stop(); L.showCanvas(false); back('You put the tools down. Nothing changed.'); }
        });
        L.titleScreen(false);
        L.showCanvas(true);
        L.sound.scene('garage');
        var lineEl = document.getElementById('wrench-line');
        var stop = start(L.canvas, function (text) { lineEl.textContent = text; }, function () {
            L.showCanvas(false);
            finish();
        });
    }

    // Bolts out and back in for a part
    function wrench(job, title, oldName, newName, finish, back) {
        bench(function (canvas, onLine, done) {
            return L.startWrench(canvas, { job: job, title: title, oldName: oldName, newName: newName, onLine: onLine }, done);
        }, finish, back);
    }

    // ── Burger stand: pick a race ─────────────────────────────────────────

    L.showStand = function (msg) {
        var car = L.activeCar(g);
        var myEt = car ? L.estimate(L.spec(car)).et : null;
        var rows = g.rivals.map(function (r, i) {
            var bet = L.cashBet(g, r);
            var funErr = L.canRace(g, r, 'fun');
            var cashErr = L.canRace(g, r, 'cash');
            var pinkErr = L.canRace(g, r, 'pinks');
            var buttons = r.king
                ? '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Race for his crown: pinks and ' + money(L.kingPrize(g)) + '</button>'
                : '<button data-act="fun" data-arg="' + i + '" class="minor"' + (funErr ? ' disabled' : '') + '>' +
                    (r.funDone ? 'Raced for fun this week' : 'Just for fun (win ' + money(L.funPrize(r)) + ')') + '</button>' +
                  '<button data-act="cash" data-arg="' + i + '"' + (cashErr ? ' disabled title="' + esc(cashErr) + '"' : '') + '>' +
                    'Bet up to ' + money(bet) + '</button>' +
                  '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Pink slips</button>';
            var theirEt = L.estimate(L.spec(L.rivalCar(r))).et;
            return '<div class="rival' + (r.king ? ' king' : '') + '">' +
                '<div class="rival-car"><canvas class="stand-car" width="96" height="48" data-rival="' + i + '" aria-hidden="true"></canvas>' +
                '<span class="plate">' + (r.king ? 'KING' : ((r.era || 0) < L.eraOf(g) ? L.ERAS[r.era || 0].year + ' · ' : '') + 'TIER ' + (r.tier + 1)) + '</span></div>' +
                '<div class="rival-info"><h3>' + (r.king ? '<span class="crown" aria-hidden="true">♛</span> ' : '') + esc(r.name) + '</h3>' +
                '<p class="rival-ride">' + esc(L.BODIES[r.body].name) + '</p>' +
                '<p class="quote">"' + esc(r.line) + '"</p>' +
                (car ? tape(myEt, theirEt) + chances(L.odds(car, r)) : '') +
                '</div><div class="rival-btns">' + buttons + '</div>' +
                '</div>';
        }).join('') || '<p class="empty-lot">Nobody wants to race you this week. Come back next week.</p>';
        var why = !car ? 'You need a car to race.' :
            car.engineCondition <= 0 ? 'Your engine is blown. Rebuild it in the garage next week.' :
            car.condition < L.MIN_BODY ? 'Nobody races a rust bucket: the body has to be ' + L.MIN_BODY + '%. Fix it up in the garage next week.' : '';
        render(
            status('stand') + flash(msg || why) +
            '<div class="panel stand"><header class="stand-sign"><h2>The Burger Stand</h2><p>Friday night. Engines idling, everybody watching.</p></header>' +
            '<div class="rivals">' + rows + '</div></div>' +
            '<details class="stand-help"><summary>How a race works</summary><p>Press Space, Enter or the big button when the start light turns green, then again each time the SHIFT light goes green. Keep out of the red.</p>' +
            '<p>A race just for fun risks nothing and pays a little. In a cash race you pick the bet, from ' + money(L.MIN_BET) + ' up to ' + money(L.rivalPrize(g)) + ' or all your cash, and the rival puts up the same. Pink slips are for the cars.</p>' +
            '<p>The times are each car\'s best quarter mile with a perfect launch and shifts. The odds count an average driver for you and the rival\'s own skill.</p></details>' +
            backBar('Back'),
            {
                cash: function (i) { showBet(+i); },
                fun: function (i) { race(+i, 'fun'); },
                pinks: function (i) {
                    var r = g.rivals[+i];
                    ask('Race ' + r.name + ' for pink slips? Win and you take their ' + L.BODIES[r.body].name + (r.king ? ' and ' + money(L.kingPrize(g)) : '') +
                        '. Lose and they keep your ' + L.carName(L.activeCar(g)) + '.',
                        'Race for pinks', function () { race(+i, 'pinks'); }, L.showStand, matchup(r));
                    drawMatchup(r);
                },
                back: function () { L.showHub(); }
            }
        );
        app.querySelectorAll('canvas.stand-car').forEach(function (c) {
            L.drawCar(c.getContext('2d'), 4, 2, L.rivalLook(g.rivals[+c.getAttribute('data-rival')]), { scale: 2 });
        });
    };

    // Your car and the rival's side by side, with both times and your chances
    function matchup(r) {
        var car = L.activeCar(g);
        return '<div class="matchup">' +
            '<figure class="side"><canvas class="stand-car" width="96" height="48" data-side="me" aria-hidden="true"></canvas>' +
            '<figcaption><b>You</b>' + esc(L.carName(car)) + '</figcaption></figure>' +
            '<span class="vs" aria-hidden="true">VS</span>' +
            '<figure class="side' + (r.king ? ' king' : '') + '"><canvas class="stand-car" width="96" height="48" data-side="them" aria-hidden="true"></canvas>' +
            '<figcaption><b>' + esc(r.name) + '</b>' + esc(L.BODIES[r.body].name) + '</figcaption></figure></div>' +
            '<div class="matchup-odds">' + tape(L.estimate(L.spec(car)).et, L.estimate(L.spec(L.rivalCar(r))).et) + chances(L.odds(car, r)) + '</div>';
    }
    function drawMatchup(r) {
        var me = app.querySelector('canvas[data-side="me"]'), them = app.querySelector('canvas[data-side="them"]');
        if (me) L.drawCar(me.getContext('2d'), 4, 2, L.carLook(L.activeCar(g)), { scale: 2 });
        if (them) L.drawCar(them.getContext('2d'), 4, 2, L.rivalLook(r), { scale: 2 });
    }

    // Pick a bet for a cash race: a slider and quick picks from the least you can bet to the
    // most, what you'd have after a win or a loss, and a warning when it's every dollar you have
    function showBet(i) {
        var r = g.rivals[i];
        var err = L.canRace(g, r, 'cash');
        if (err) return L.showStand(err);
        var max = L.cashBet(g, r), min = L.MIN_BET, step = L.betStep(g, r);
        function snap(v) { return L.betAmount(g, r, v >= max ? max : Math.round(v / step) * step); }
        var bet = snap(max / 2);
        var picks = [['Small', min], ['Quarter', max / 4], ['Half', max / 2], [max >= g.cash ? 'All in' : 'Max', max]];
        render(
            status('stand') +
            '<div class="panel stand bet"><header class="stand-sign"><h2>Place your bet</h2><p>' + esc(r.name) + ' puts up the same. Winner takes the pot.</p></header>' +
            '<div class="bet-body">' + matchup(r) +
            '<div class="bet-pick"><output class="bet-amount" id="bet-amount" aria-live="polite"></output>' +
            '<input type="range" id="bet-range" min="' + min + '" max="' + max + '" step="' + (max - min < step ? 1 : step) + '" value="' + bet + '" aria-label="Your bet">' +
            '<div class="bet-scale"><span>' + money(min) + '</span><span>' + money(max) + '</span></div>' +
            '<div class="bet-chips">' + picks.map(function (p) {
                return '<button data-act="pick" data-arg="' + snap(p[1]) + '" class="chip">' + p[0] + '<small>' + money(snap(p[1])) + '</small></button>';
            }).join('') + '</div></div>' +
            '<div class="bet-outcome"><p class="win">Win: <b id="bet-win"></b></p><p class="lose">Lose: <b id="bet-lose"></b></p></div>' +
            '<p class="bet-warn" id="bet-warn" hidden>That\'s every dollar you have. Lose and you\'re broke.</p>' +
            '<div class="ask-btns"><button data-act="go" id="bet-go"></button><button data-act="no" class="minor">Cancel</button></div>' +
            '</div></div>',
            {
                pick: function (v) { set(+v); },
                go: function () { race(i, 'cash', bet); },
                no: function () { L.showStand(); }
            }
        );
        drawMatchup(r);
        var range = document.getElementById('bet-range');
        range.addEventListener('input', function () { set(+range.value); });
        function set(v) {
            bet = snap(v);
            range.value = bet;
            var allIn = bet >= g.cash;
            document.getElementById('bet-amount').textContent = money(bet);
            document.getElementById('bet-win').textContent = '+' + money(bet) + ', you\'ll have ' + money(g.cash + bet);
            document.getElementById('bet-lose').textContent = '−' + money(bet) + ', you\'ll have ' + money(g.cash - bet);
            document.getElementById('bet-warn').hidden = !allIn;
            var go = document.getElementById('bet-go');
            go.textContent = (allIn ? 'Bet it all: ' : 'Bet ') + money(bet);
            go.className = allIn ? 'danger' : '';
            app.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', +c.getAttribute('data-arg') === bet); });
        }
        set(bet);
    }

    // Both cars' quarter mile times side by side, the quicker one lit
    function tape(mine, theirs) {
        var d = mine - theirs;
        var gap = Math.abs(d) < 0.05 ? 'dead even' : Math.abs(d).toFixed(2) + ' s ' + (d < 0 ? 'quicker' : 'slower');
        return '<p class="tape"><span class="' + (d <= 0 ? 'quick' : '') + '">You ' + mine.toFixed(2) + ' s</span>' +
            '<span class="' + (d > 0 ? 'quick' : '') + '">Them ' + theirs.toFixed(2) + ' s</span>' +
            '<span class="gap ' + (d < -0.05 ? 'ahead' : d > 0.05 ? 'behind' : '') + '">' + gap + '</span></p>';
    }

    // Your chances as a ten-light meter from red to green
    function chances(p) {
        var pct = Math.round(p * 100);
        var label = p >= 0.7 ? 'Easy money' : p >= 0.45 ? 'Even race' : p >= 0.2 ? 'Tough' : 'Long shot';
        var hue = Math.round(p * 120);   // 0 red, 60 amber, 120 green
        var lit = Math.max(1, Math.round(p * 10));
        var lights = '';
        for (var k = 0; k < 10; k++) lights += '<span' + (k < lit ? ' style="background:hsl(' + hue + ',85%,50%)"' : '') + '></span>';
        return '<p class="odds"><span class="odds-bar" aria-hidden="true">' + lights + '</span> ' +
            '<strong style="color:hsl(' + hue + ',85%,60%)">' + label + '</strong> · about ' + pct + '% to win</p>';
    }

    function race(i, stake, bet) {
        var rival = g.rivals[i];
        var pinks = stake === 'pinks';
        var err = L.canRace(g, rival, stake);
        if (err) return L.showStand(err);
        var car = L.activeCar(g);
        render('<div class="race-controls"><button class="go" id="go">GO / SHIFT</button>' +
            '<p class="hint">Racing ' + esc(rival.name) + ' ' + (pinks ? 'for pink slips' : stake === 'fun' ? 'just for fun' : 'for ' + money(L.betAmount(g, rival, bet))) +
            '. Shift when the SHIFT light goes green.</p>' +
            '<button data-act="sound" class="minor" id="sound">Sound: ' + (L.sound.on ? 'on' : 'off') + '</button></div>', {
            sound: function () { document.getElementById('sound').textContent = 'Sound: ' + (L.sound.toggle() ? 'on' : 'off'); L.sound.begin(); L.sound.engineOn(); }
        });
        L.titleScreen(false);
        L.showCanvas(true);
        L.sound.scene('race');
        var rcar = L.rivalCar(rival);
        L.startRace(
            L.canvas,
            document.getElementById('go'),
            { spec: L.spec(car), color: L.carLook(car), condition: car.engineCondition },
            { spec: L.spec(rcar), color: L.rivalLook(rival), skill: rival.skill },
            function (result, damage, sum) {
                var line = L.settleRace(g, i, stake, result, damage, bet);
                var beat = L.noteRace(g, result, sum.et, sum.reaction);
                L.save(g);
                var rec = L.records(g);
                var best = beat.map(function (k) {
                    return k === 'streak' ? rec.streak + ' wins in a row' : (k === 'et' ? 'quarter mile ' : 'reaction ') + boardOf(k).fmt(rec[k]);
                });
                L.showCanvas(false);
                render(
                    status('stand') +
                    '<div class="panel result ' + result + '"><h2>' + { win: 'You win!', lose: 'You lose', foul: 'Red light!' }[result] + '</h2>' +
                    '<p>' + esc(line) + '</p>' +
                    '<p class="sub">You: ' + esc(sum.me) + (sum.reaction !== null && result !== 'foul' ? ' (reaction ' + sum.reaction.toFixed(3) + ' s)' : '') +
                    '<br>' + esc(rival.name) + ': ' + esc(sum.them) + '</p>' +
                    (best.length ? '<p class="record">New personal best: ' + best.join(', ') + '!</p>' : '') + '</div>' +
                    backBar('Back to the burger stand', 'stand'),
                    { stand: function () { L.showStand(); } }
                );
            }
        );
    }

    L.initUi = function (root) { app = root; };
})(window.Lemon = window.Lemon || {});

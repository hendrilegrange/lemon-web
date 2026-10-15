// Menu screens: the hub, classifieds, parts catalog, garage and the burger stand.
// Each screen is plain HTML built into #app; the race takes over the canvas.
(function (L) {
    'use strict';

    var app, g;

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
        var focus = app.querySelector('button:not([disabled])');
        if (focus) focus.focus({ preventScroll: true });
    }

    // The gauges across the top of every screen
    function status() {
        function gauge(label, value, cls) {
            return '<div class="gauge' + (cls ? ' ' + cls : '') + '"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
        }
        return '<div class="status">' +
            gauge('Cash', money(g.cash), 'cash') +
            gauge('Week', g.week) +
            (g.friday ? gauge('Tonight', 'Friday night', 'friday') : gauge('Garage', g.hours + ' h left')) +
            gauge('Record', g.wins + '–' + g.losses) +
            '</div>';
    }

    // Ask before something that can't be undone. Shows the question in place of the screen;
    // Cancel goes back to the screen it came from.
    function ask(question, yesLabel, onYes, back) {
        render(
            status() + '<div class="panel ask"><h2>Are you sure?</h2><p>' + esc(question) + '</p>' +
            '<button data-act="yes" class="danger">' + esc(yesLabel) + '</button>' +
            '<button data-act="no" class="minor">Cancel</button></div>',
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
            screen(err || null);
        };
    }

    function carStats(car) {
        var s = L.spec(car);
        var pp = L.peakPower(s);
        var est = L.estimate(s);
        return { hp: Math.round(pp.hp), hpRpm: pp.rpm, et: est.et, trap: est.trapMph, zeroSixty: est.zeroSixty, redline: s.redline };
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
            accountBlock() +
            '</div>',
            {
                login: function () { showAccount('login'); },
                register: function () { showAccount('register'); },
                signout: function () {
                    L.account.signOut().then(function (r) {
                        L.showTitle(r.cleared ? 'Signed out. Your game is safe in your account.' : 'Signed out. Your game is still saved in this browser.');
                    });
                },
                cont: function () { g = saved; L.showHub(); },
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
            var paint = L.BODIES[car.body].color;
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
            status() + flash(msg) +
            '<canvas class="scene" id="hub-scene" width="320" height="120" aria-hidden="true"></canvas>' +
            carHtml +
            '<nav class="menu tiles">' +
            tile('ads', 'ads', 'Classifieds', plural(g.ads.length, 'car') + ' for sale') +
            tile('parts', 'parts', 'Speed shop', stocked + (car ? ' parts for your car' : ' parts') + ' in stock') +
            tile('garage', 'garage', 'Garage', plural(g.cars.length, 'car') + ' · ' + plural(g.inventory.length, 'part') + ' on the shelf') +
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
                ads: function () { L.showAds(); },
                parts: function () { L.showParts(); },
                garage: function () { L.showGarage(); },
                stand: function () {
                    if (g.friday || g.hours === 0) { L.goFriday(g); L.save(g); return L.showStand(); }
                    ask('Head out to the burger stand? It\'s Friday night, so the garage is closed till next week. You still have ' +
                        g.hours + ' hours left.', 'Go racing', function () { L.goFriday(g); L.save(g); L.showStand(); }, L.showHub);
                },
                week: function () { L.newWeek(g); L.save(g); L.showHub('A new week. New ads, a restocked speed shop, new faces at the burger stand.'); },
                quit: function () { L.showTitle(); }
            }
        );
        var scene = document.getElementById('hub-scene');
        var sctx = scene.getContext('2d');
        L.drawHubScene(sctx, 320, 120, car ? L.BODIES[car.body].color : null, g.friday);
    };

    // ── Classifieds ───────────────────────────────────────────────────────

    L.showAds = function (msg) {
        var rows = g.ads.map(function (ad, i) {
            return '<div class="ad"><h3>' + esc(L.BODIES[ad.body].name.toUpperCase()) + '</h3>' +
                '<p>' + esc(ad.note) + ' Body ' + ad.condition + '%, engine ' + ad.engineCondition + '%.</p>' +
                '<p class="price">' + money(ad.price) + '</p>' +
                '<button data-act="buy" data-arg="' + i + '"' + (g.cash < ad.price ? ' disabled' : '') + '>Buy</button></div>';
        }).join('') || '<p>Sold out this week. Try again next week.</p>';
        render(
            status() + flash(msg) +
            '<div class="paper"><h2>CLASSIFIEDS</h2><p class="sub">Autos for sale · Week ' + g.week + '</p>' + rows + '</div>' +
            '<button data-act="back">Back</button>',
            {
                buy: act(L.showAds, function (i) { return L.buyAd(g, +i) || 'Sold! It\'s in your garage.'; }),
                back: function () { L.showHub(); }
            }
        );
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
            return group((fam === mine ? 'For your ' : '') + L.FAMILIES[fam].name + ' engines and parts',
                catalog.filter(function (x) { return L.PARTS[x.id].fam === fam; }), fam === mine || !car);
        }
        // Your engine's family, then what fits anything, then the other families folded away
        // for a swap
        var mine = car ? L.PARTS[car.parts.engine].fam : null;
        var others = Object.keys(L.FAMILIES).filter(function (fam) { return fam !== mine; });
        var html = (mine ? family(mine) : '') +
            group('Fits anything', catalog.filter(function (x) { return !L.PARTS[x.id].fam; }), true) +
            others.map(family).join('');
        var intro = car
            ? 'Your ' + esc(L.carName(car)) + ' has the ' + esc(L.PARTS[car.parts.engine].name) + '. Carbs, intakes, cams and exhausts only fit their own engine family; engines and the rest fit anything.'
            : 'Everything we carry. Buy a car and we\'ll put what fits it first.';
        render(
            status() + flash(msg) + '<div class="panel"><h2>Speed Shop</h2><p class="sub">' + intro +
            ' The shelves restock every week with something for every engine, but not every part every week, and the Bestest parts sell out fast.</p>' + html + '</div>' +
            '<button data-act="back">Back</button>',
            {
                buy: act(L.showParts, function (id) { return L.buyPart(g, id) || 'Bought. It\'s on your garage shelf.'; }),
                back: function () { L.showHub(); }
            }
        );
    };

    // ── Garage ────────────────────────────────────────────────────────────

    L.showGarage = function (msg) {
        var car = L.activeCar(g);
        var cars = g.cars.map(function (c, i) {
            return '<div class="row' + (i === g.active ? ' active' : '') + '"><span>' + esc(L.carName(c)) +
                ' · sells for ' + money(L.carValue(c)) + '</span>' +
                (i === g.active ? '<span class="price">Driving</span>' : '<button data-act="drive" data-arg="' + i + '">Drive</button>') +
                '<button data-act="sell" data-arg="' + i + '" class="minor">Sell</button>' +
                '<button data-act="strip" data-arg="' + i + '" class="minor">Strip</button></div>';
        }).join('') || '<p>No cars. Check the classifieds.</p>';

        var detail = '';
        if (car) {
            var st = carStats(car);
            var fix = L.fixAll(car);
            detail = '<div class="panel"><h2>' + esc(L.carName(car)) + '</h2>' +
                '<div class="dyno">' +
                '<p><b>' + st.hp + ' hp</b> at ' + st.hpRpm + ' rpm · redline ' + st.redline + '</p>' +
                '<p>0-60 ' + (st.zeroSixty ? st.zeroSixty.toFixed(1) + ' s' : 'n/a') + ' · quarter mile ' + st.et.toFixed(2) + ' s at ' + Math.round(st.trap) + ' mph</p>' +
                '<p>Body ' + bar(car.condition, 'Body condition') + (car.condition < L.MIN_BODY ? ' <span class="shot">needs ' + L.MIN_BODY + '% to race</span>' : '') + '</p>' +
                '<p class="sub">Sells for ' + money(L.carValue(car)) + (fix.cost ? '. Restored, it would fetch about ' + money(L.restoredValue(car)) : '') + '.</p>' +
                (fix.cost ? '<button data-act="fix">Fix car (' + money(fix.cost) + ', ' + fix.hours + ' h for everything)</button>' : '<p class="sub">Everything is in good shape.</p>') +
                '</div>' +
                L.SLOTS.map(function (slot) {
                    return '<div class="row"><span><span class="slot">' + L.SLOT_NAMES[slot] + '</span>' + esc(L.PARTS[car.parts[slot]].name) + '</span>' +
                        '<span>' + bar(L.partCondition(car, slot), 'Condition') + '</span></div>';
                }).join('') + '</div>';
        }

        var shelf = g.inventory.map(function (id, i) {
            var p = L.PARTS[id];
            var cond = L.shelfCondition(g, i);
            return '<div class="row"><span><span class="slot">' + L.SLOT_NAMES[p.slot] + '</span> ' + esc(p.name) + (cond < 100 ? ' ' + bar(cond, 'Condition') : '') + '</span>' +
                (car ? '<button data-act="install" data-arg="' + i + '">Install (' + L.JOB_HOURS[p.slot] + ' h)</button>' : '') +
                '<button data-act="sellpart" data-arg="' + i + '" class="minor">Sell ' + money(L.partValue(g, i)) + '</button></div>';
        }).join('') || '<p>Nothing on the shelf. Parts you buy and parts you take off land here.</p>';

        render(
            status() + flash(msg) +
            '<div class="panel"><h2>Your cars</h2>' + cars + '</div>' + detail +
            '<div class="panel"><h2>Shelf</h2>' + shelf + '</div>' +
            '<button data-act="back">Back</button>',
            {
                drive: act(L.showGarage, function (i) { g.active = +i; }),
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
                    wrench(part.slot, 'Installing: ' + part.name, L.PARTS[car.parts[part.slot]].name, part.name,
                        act(L.showGarage, function () { return L.installPart(g, +i) || 'Installed the ' + part.name + '.'; }), L.showGarage);
                },
                sellpart: act(L.showGarage, function (i) { return L.sellPart(g, +i); }),
                fix: function () { L.showFix(); },
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
            var name = esc(L.PARTS[d.part].name);
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
                    spots: spec.spots, color: L.BODIES[car.body].color, onLine: onLine,
                    title: (target === 100 ? 'Restoring the ' : 'Patching up the ') + L.carName(car)
                }, done);
            }, act(L.showFix, function () {
                return L.bodywork(g, target) || (target === 100 ? 'Fresh paint. She looks like new.' : 'Patched and primed. Good enough to race.');
            }), L.showFix);
        }

        render(
            status() + flash(msg) +
            '<div class="panel"><h2>Fix the ' + esc(L.carName(car)) + '</h2><p class="sub">' + budget + '</p>' + bodyRow + rows + '</div>' +
            '<p class="hint">Each job opens the workbench: bolts out and back in for parts, grind and fill the rust for bodywork. Jobs use up your garage hours for the week.</p>' +
            '<button data-act="back">Back to the garage</button>',
            {
                repair: function (slot) { job(slot, 'repair'); },
                junk: function (slot) { job(slot, 'junk'); },
                new: function (slot) { job(slot, 'new'); },
                body: bodyJob,
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
        var bet = L.cashBet(g);
        var rows = g.rivals.map(function (r, i) {
            var funErr = L.canRace(g, r, 'fun');
            var cashErr = L.canRace(g, r, 'cash');
            var pinkErr = L.canRace(g, r, 'pinks');
            var buttons = r.king
                ? '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Race for his crown: pinks and ' + money(L.KING_PRIZE) + '</button>'
                : '<button data-act="fun" data-arg="' + i + '" class="minor"' + (funErr ? ' disabled' : '') + '>' +
                    (r.funDone ? 'Raced for fun this week' : 'Just for fun (win ' + money(L.funPrize(r)) + ')') + '</button>' +
                  '<button data-act="cash" data-arg="' + i + '"' + (cashErr ? ' disabled title="' + esc(cashErr) + '"' : '') + '>' +
                    (bet >= L.RIVAL_PRIZE ? 'Bet ' + money(bet) : 'Bet it all: ' + money(bet)) + '</button>' +
                  '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Pink slips</button>';
            return '<div class="card rival' + (r.king ? ' king' : '') + '"><h3>' + esc(r.name) + '</h3>' +
                '<p>Drives a ' + esc(L.BODIES[r.body].name) + '. <em>"' + esc(r.line) + '"</em></p>' +
                (car ? chances(L.odds(car, r)) : '') + buttons +
                '</div>';
        }).join('') || '<p>Nobody wants to race you this week. Come back next week.</p>';
        var why = !car ? 'You need a car to race.' :
            car.engineCondition <= 0 ? 'Your engine is blown. Rebuild it in the garage next week.' :
            car.condition < L.MIN_BODY ? 'Nobody races a rust bucket: the body has to be ' + L.MIN_BODY + '%. Fix it up in the garage next week.' : '';
        render(
            status() + flash(msg || why) +
            '<div class="panel"><h2>The Burger Stand</h2><p class="sub">Friday night. Engines idling, everybody watching.</p>' + rows + '</div>' +
            '<p class="hint">At the race: press Space, Enter or the big button when the start light turns green, then again each time the SHIFT light goes green. Keep out of the red. A race just for fun risks nothing and pays a little; a cash race bets all your cash, up to ' + money(L.RIVAL_PRIZE) + ', against the same; pink slips are for the cars.</p>' +
            '<button data-act="back">Back</button>',
            {
                cash: function (i) {
                    var r = g.rivals[+i];
                    if (bet < g.cash) return race(+i, 'cash');
                    ask('Bet all ' + money(bet) + ' you have on beating ' + r.name + '? Lose and you are broke.',
                        'Bet it all', function () { race(+i, 'cash'); }, L.showStand);
                },
                fun: function (i) { race(+i, 'fun'); },
                pinks: function (i) {
                    var r = g.rivals[+i];
                    ask('Race ' + r.name + ' for pink slips? Win and you take their ' + L.BODIES[r.body].name + (r.king ? ' and ' + money(L.KING_PRIZE) : '') +
                        '. Lose and they keep your ' + L.carName(L.activeCar(g)) + '.',
                        'Race for pinks', function () { race(+i, 'pinks'); }, L.showStand);
                },
                back: function () { L.showHub(); }
            }
        );
    };

    // Your chances as a meter from red to green
    function chances(p) {
        var pct = Math.round(p * 100);
        var label = p >= 0.7 ? 'Easy money' : p >= 0.45 ? 'Even race' : p >= 0.2 ? 'Tough' : 'Long shot';
        var hue = Math.round(p * 120);   // 0 red, 60 amber, 120 green
        return '<p class="odds"><span class="odds-bar"><span style="width:' + Math.max(4, pct) + '%;background:hsl(' + hue + ',85%,50%)"></span></span> ' +
            label + ' · about ' + pct + '% to win</p>';
    }

    function race(i, stake) {
        var rival = g.rivals[i];
        var pinks = stake === 'pinks';
        var err = L.canRace(g, rival, stake);
        if (err) return L.showStand(err);
        var car = L.activeCar(g);
        render('<div class="race-controls"><button class="go" id="go">GO / SHIFT</button>' +
            '<p class="hint">Racing ' + esc(rival.name) + ' ' + (pinks ? 'for pink slips' : stake === 'fun' ? 'just for fun' : 'for ' + money(L.cashBet(g))) +
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
            { spec: L.spec(car), color: L.BODIES[car.body].color, condition: car.engineCondition },
            { spec: L.spec(rcar), color: '#e8e8e8', skill: rival.skill },
            function (result, damage, sum) {
                var line = L.settleRace(g, i, stake, result, damage);
                L.save(g);
                L.showCanvas(false);
                render(
                    status() +
                    '<div class="panel result ' + result + '"><h2>' + { win: 'You win!', lose: 'You lose', foul: 'Red light!' }[result] + '</h2>' +
                    '<p>' + esc(line) + '</p>' +
                    '<p class="sub">You: ' + esc(sum.me) + (sum.reaction !== null && result !== 'foul' ? ' (reaction ' + sum.reaction.toFixed(2) + ' s)' : '') +
                    '<br>' + esc(rival.name) + ': ' + esc(sum.them) + '</p></div>' +
                    '<button data-act="stand">Back to the burger stand</button>',
                    { stand: function () { L.showStand(); } }
                );
            }
        );
    }

    L.initUi = function (root) { app = root; };
})(window.Lemon = window.Lemon || {});

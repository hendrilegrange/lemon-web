// The kids' garage: an easy mode for little ones, from the title screen. No account and no
// money: pick a car, race it, fix it. Nothing wears out. Every fix bolts on a shinier part that
// makes the car quicker, and the race shifts by itself, so all there is to do is press GO on
// green. The player's name and car last for the browser session (sessionStorage); the ten
// quickest times go on the kids' own leaderboard (api.php's kids and kid_time), or this
// browser's own top ten when the server doesn't answer.
(function (L) {
    'use strict';

    var SESSION_KEY = 'lemon_kid', LOCAL_TOP = 'lemon_kid_top';

    // The cars to pick from, one from each era, each with a name a five-year-old can read
    L.KID_CARS = [
        { body: 'ford48', name: 'Hot Rod' },
        { body: 'chevy57', name: 'Cruiser' },
        { body: 'camaro69', name: 'Muscle Car' },
        { body: 'gn84', name: 'Turbo Car' },
        { body: 'supra93', name: 'Sports Car' },
        { body: 'gtr24', name: 'Super Car' }
    ];
    L.KID_COLORS = ['#d7263d', '#f07a28', '#ffd23f', '#3bb273', '#2fb8ac', '#2f7fd6', '#7a2fa0', '#ff4fa0', '#16161c', '#e6e2d6'];
    // The parts to fix, in short words
    L.KID_JOBS = [['engine', 'Engine'], ['tires', 'Tires'], ['exhaust', 'Pipes'], ['carb', 'Fuel'],
        ['intake', 'Air'], ['cam', 'Cam'], ['trans', 'Gears'], ['rear', 'Axle']];
    var BEST = 3;                       // fixing goes up to the Bestest part, then it's as quick as it gets
    L.KID_NAME_MAX = 12;

    // A name as the leaderboard keeps it: letters, numbers and spaces, at most 12
    L.kidName = function (s) {
        return String(s || '').replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, L.KID_NAME_MAX).trim();
    };

    // A new kid's car: the body's own parts, in its own colour
    L.kidNewCar = function (body) {
        return { body: body, color: L.BODIES[body].color, parts: Object.assign({}, L.BODIES[body].parts) };
    };

    // The car as the physics sees it: brand new, and it never wears
    L.kidCar = function (kc) {
        return { body: kc.body, condition: 100, engineCondition: 100, partCondition: {}, parts: kc.parts };
    };
    L.kidLook = function (kc) { return { color: kc.color, shape: L.BODIES[kc.body].shape }; };
    L.kidCarName = function (kc) {
        return (L.KID_CARS.filter(function (c) { return c.body === kc.body; })[0] || { name: 'Car' }).name;
    };

    // Is this part as shiny as it gets?
    L.kidMaxed = function (kc, slot) { return L.PARTS[kc.parts[slot]].cls >= BEST; };

    // A fix bolts on the next class up (its family's next engine for the engine). False when
    // it's already the best.
    L.kidUpgrade = function (kc, slot) {
        var part = L.PARTS[kc.parts[slot]];
        if (part.cls >= BEST) return false;
        if (slot === 'engine') {
            var next = Object.keys(L.PARTS).filter(function (id) {
                var p = L.PARTS[id];
                return p.slot === 'engine' && p.fam === part.fam && p.cls === part.cls + 1;
            })[0];
            if (!next) return false;
            kc.parts.engine = next;
        } else {
            kc.parts[slot] = L.partOfClass(kc.parts.engine, slot, part.cls + 1);
        }
        return true;
    };

    // Speed stars, 1 to 5, for how far the fixing has come
    L.kidStars = function (kc) {
        var sum = 0;
        L.KID_JOBS.forEach(function (j) { sum += Math.min(BEST, L.PARTS[kc.parts[j[0]]].cls); });
        return 1 + Math.round(4 * sum / (BEST * L.KID_JOBS.length));
    };

    // The car to race: the same car as yours, stock and a little tired, driven by Mac
    L.kidRival = function (kc) {
        var car = { body: kc.body, condition: 100, engineCondition: 85, partCondition: {}, parts: Object.assign({}, L.BODIES[kc.body].parts) };
        return { spec: L.spec(car), color: { color: '#8a8aa8', shape: L.BODIES[kc.body].shape }, skill: 0.3 };
    };

    // This browser's own top ten, kept for when the server doesn't answer
    L.kidLocalTop = function () {
        try { var list = JSON.parse(localStorage.getItem(LOCAL_TOP) || '[]'); return Array.isArray(list) ? list : []; } catch (e) { return []; }
    };
    // Adds a time to a top ten (one row per name, its best); returns the new list
    L.kidAddTime = function (list, entry) {
        var key = entry.name.toLowerCase();
        var mine = list.filter(function (r) { return r.name.toLowerCase() === key; })[0];
        if (mine && mine.t <= entry.t) return list;
        var out = list.filter(function (r) { return r !== mine; }).concat([entry]);
        out.sort(function (a, b) { return a.t - b.t; });
        return out.slice(0, 10);
    };

    if (typeof document === 'undefined') return;     // the rest is the screens

    var U, kid;
    function load() {
        try { kid = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { kid = null; }
        if (!kid || typeof kid !== 'object') kid = {};
        if (kid.car && !(L.BODIES[kid.car.body] && L.PARTS[kid.car.parts.engine])) delete kid.car;
    }
    function save() { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(kid)); } catch (e) { /* private window: it lasts till the page closes */ } }
    function esc(s) { return U.esc(s); }

    // Pixel pictures drawn after the screen is built: [data-car] cars, [data-part] parts
    function paint() {
        document.querySelectorAll('canvas[data-car]').forEach(function (c) {
            var ctx = c.getContext('2d'), body = c.getAttribute('data-car');
            ctx.clearRect(0, 0, c.width, c.height);
            var look = { color: c.getAttribute('data-color') || L.BODIES[body].color, shape: L.BODIES[body].shape };
            var scale = Number(c.getAttribute('data-scale')) || 2;
            L.drawCar(ctx, (c.width - 44 * scale) / 2, 2 * scale, look, { scale: scale });
        });
        document.querySelectorAll('canvas[data-part]').forEach(function (c) {
            var ctx = c.getContext('2d');
            ctx.fillStyle = '#1a1a34';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.save();
            ctx.translate(-30, -30);     // the part's middle of the workbench, so it fills the tile
            L.drawPart(ctx, c.getAttribute('data-part'), c.getAttribute('data-new') === '1', 0, 0);
            ctx.restore();
        });
    }

    function carCanvas(body, color, scale, cls) {
        return '<canvas class="' + (cls || 'kid-car') + '" width="' + (44 * scale + 8 * scale) + '" height="' + (28 * scale) + '" data-car="' + body + '"' +
            (color ? ' data-color="' + color + '"' : '') + ' data-scale="' + scale + '"></canvas>';
    }

    function screen(html, actions) {
        U.render('<div class="kids">' + html + '</div>', actions);
        L.titleScreen(false);
        paint();
    }

    // The way in, from the title screen
    L.showKids = function (msg) {
        U = L.ui;
        load();
        if (!kid.name) return kidName();
        if (!kid.car) return kidPick();
        kidHub(msg);
    };

    function kidName(msg) {
        screen(
            '<div class="panel kid-panel"><h2>Hi! What\'s your name?</h2>' +
            '<p class="kid-say">Type your name, then press the big button.</p>' +
            '<input id="kid-name" class="kid-input" maxlength="' + L.KID_NAME_MAX + '" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(kid.name || '') + '" aria-label="Your name">' +
            (msg ? '<p class="kid-oops">' + esc(msg) + '</p>' : '') +
            '<button data-act="ok" class="kid-big">That\'s me!</button></div>' +
            U.backBar('Back to the title'),
            {
                ok: done,
                back: function () { L.showTitle(); }
            }
        );
        var input = document.getElementById('kid-name');
        input.focus();
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } });
        function done() {
            var name = L.kidName(input.value);
            if (!name) return kidName('Type your name first!');
            kid.name = name;
            save();
            if (!kid.car) return kidPick();
            kidHub();
        }
    }

    function kidPick() {
        screen(
            '<div class="panel kid-panel"><h2>Pick your car, ' + esc(kid.name) + '!</h2>' +
            '<p class="kid-say">Tap the car you like best.</p>' +
            '<div class="kid-cars">' + L.KID_CARS.map(function (c) {
                return '<button data-act="pick" data-arg="' + c.body + '" class="kid-card">' + carCanvas(c.body, null, 3) + '<span>' + c.name + '</span></button>';
            }).join('') + '</div></div>' +
            U.backBar(kid.car ? 'Back to my garage' : 'Back to the title'),
            {
                pick: function (body) {
                    kid.car = L.kidNewCar(body);
                    save();
                    kidHub('Great pick! This is your ' + L.kidCarName(kid.car) + '.');
                },
                back: function () { if (kid.car) kidHub(); else L.showTitle(); }
            }
        );
    }

    function stars(n) {
        var s = '';
        for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= n ? 'on' : 'off') + '">★</span>';
        return '<span class="kid-stars" aria-label="' + n + ' of 5 stars">' + s + '</span>';
    }

    function kidHub(msg) {
        var kc = kid.car;
        screen(
            (msg ? '<p class="kid-msg">' + esc(msg) + '</p>' : '') +
            '<div class="panel kid-panel kid-hub"><h2>' + esc(kid.name) + '\'s ' + L.kidCarName(kc) + '</h2>' +
            carCanvas(kc.body, kc.color, 4, 'kid-car big') +
            '<p class="kid-speed">Speed ' + stars(L.kidStars(kc)) + '</p>' +
            '<div class="kid-buttons">' +
            '<button data-act="race" class="kid-big go-race">🏁 Race!</button>' +
            '<button data-act="fix" class="kid-big go-fix">🔧 Fix it!</button>' +
            '<button data-act="paint" class="kid-big go-paint">🎨 Paint it!</button>' +
            '<button data-act="top" class="kid-big go-top">🏆 Top 10</button>' +
            '</div>' +
            '<p class="kid-say">Fix your car to make it faster. Then race!</p></div>' +
            U.backBar('Back to the title', 'back', [['Pick another car', 'pick'], ['Change my name', 'name']]),
            {
                race: kidRaceReady,
                fix: function () { kidFix(); },
                paint: kidPaint,
                top: function () { kidTop(); },
                pick: kidPick,
                name: function () { kidName(); },
                back: function () { L.showTitle(); }
            }
        );
    }

    function kidFix(msg) {
        var kc = kid.car;
        screen(
            (msg ? '<p class="kid-msg">' + esc(msg) + '</p>' : '') +
            '<div class="panel kid-panel"><h2>Fix your car!</h2>' +
            '<p class="kid-say">Tap a part. Take the orange bolts out, then put them back in.</p>' +
            '<div class="kid-parts">' + L.KID_JOBS.map(function (j) {
                var maxed = L.kidMaxed(kc, j[0]);
                return '<button data-act="job" data-arg="' + j[0] + '" class="kid-card' + (maxed ? ' maxed' : '') + '">' +
                    '<canvas class="kid-part" width="260" height="140" data-part="' + j[0] + '" data-new="' + (maxed ? 1 : 0) + '"></canvas>' +
                    '<span>' + j[1] + (maxed ? ' ★' : '') + '</span></button>';
            }).join('') + '</div>' +
            '<p class="kid-say small">A ★ part is super shiny already. You can still fix it for fun!</p></div>' +
            U.backBar('Back to my garage'),
            {
                job: function (slot) { kidJob(slot); },
                back: function () { kidHub(); }
            }
        );
    }

    function kidJob(slot) {
        var word = L.KID_JOBS.filter(function (j) { return j[0] === slot; })[0][1].toLowerCase();
        U.bench(function (canvas, onLine, done) {
            return L.startWrench(canvas, { job: slot, title: 'Fixing the ' + word, oldName: 'old ' + word, newName: 'shiny new ' + word, share: 0.3, onLine: onLine }, done);
        }, function () {
            var faster = L.kidUpgrade(kid.car, slot);
            save();
            L.sound.cash();
            kidFix(faster ? 'Shiny new ' + word + '! Your car is faster now!' : 'All fixed! Your ' + word + ' is super shiny.');
        }, function () { kidFix(); });
    }

    function kidPaint() {
        var kc = kid.car;
        screen(
            '<div class="panel kid-panel"><h2>Paint your car!</h2>' +
            carCanvas(kc.body, kc.color, 4, 'kid-car big') +
            '<p class="kid-say">Tap a color.</p>' +
            '<div class="kid-colors">' + L.KID_COLORS.map(function (c) {
                return '<button data-act="color" data-arg="' + c + '" class="kid-swatch' + (c === kc.color ? ' here' : '') + '" style="background:' + c + '" aria-label="Color ' + c + '"></button>';
            }).join('') + '</div></div>' +
            U.backBar('Back to my garage'),
            {
                color: function (c) {
                    if (L.KID_COLORS.indexOf(c) < 0) return;
                    kc.color = c;
                    save();
                    L.sound.spray(0.4);
                    kidPaint();
                },
                back: function () { kidHub(); }
            }
        );
    }

    // Before the race: the one thing to know, in big letters
    function kidRaceReady() {
        screen(
            '<div class="panel kid-panel"><h2>Ready to race?</h2>' +
            '<ol class="kid-steps"><li>Watch the lights at the top.</li><li>When the light turns <b class="green">GREEN</b>, press <b>GO!</b></li><li>Your car changes gears by itself.</li></ol>' +
            '<p class="kid-say">You race Mac in his grey car.</p>' +
            '<button data-act="go" class="kid-big go-race">I\'m ready!</button></div>' +
            U.backBar('Back to my garage'),
            { go: kidRace, back: function () { kidHub(); } }
        );
    }

    function kidRace() {
        var kc = kid.car;
        U.render('<div class="race-controls kids"><button class="go kid-go" id="go">GO!</button>' +
            '<p class="kid-say">Press GO when the light turns green!</p></div>', {});
        L.titleScreen(false);
        L.showCanvas(true);
        L.sound.scene('race');
        L.startRace(L.canvas, document.getElementById('go'),
            { spec: L.spec(L.kidCar(kc)), color: L.kidLook(kc), condition: 100 }, L.kidRival(kc),
            function (result, damage, sum) {
                L.showCanvas(false);
                var t = sum.et;
                var entry = t ? { name: kid.name, car: L.kidCarName(kc), t: Math.round(t * 1000) / 1000 } : null;
                var before = L.kidLocalTop(), after = entry ? L.kidAddTime(before, entry) : before;
                var localTop = entry && after.indexOf(entry) >= 0;
                kidResult(result, t);
                if (!entry) return;
                try { localStorage.setItem(LOCAL_TOP, JSON.stringify(after)); } catch (e) { /* no storage: the server still counts it */ }
                // On the board? The server's says, or this browser's when it doesn't answer
                var shown = document.querySelector('.kid-result');
                var sent = L.account && L.account.kidTime ? L.account.kidTime(entry) : Promise.resolve({ error: 'offline' });
                sent.then(function (res) {
                    var onBoard = res.error ? localTop : !!res.rank;
                    var spot = document.getElementById('kid-top');
                    if (onBoard && spot && document.querySelector('.kid-result') === shown) spot.hidden = false;
                });
            }, { kids: true });
    }

    function kidResult(result, t) {
        var won = result === 'win';
        screen(
            '<div class="panel kid-panel kid-result ' + (won ? 'win' : 'lose') + '"><h2>' + (won ? '🏆 You won!' : 'So close!') + '</h2>' +
            (t ? '<p class="kid-time">' + t.toFixed(2) + ' <small>seconds</small></p>' : '') +
            '<p class="kid-msg" id="kid-top" hidden>You\'re in the top 10!</p>' +
            '<p class="kid-say">' + (won ? 'Mac says: "Wow, you\'re fast!"' : 'Mac says: "Fix your car and try again!"') + '</p>' +
            '<div class="kid-buttons">' +
            '<button data-act="again" class="kid-big go-race">🏁 Race again</button>' +
            '<button data-act="fix" class="kid-big go-fix">🔧 Fix it!</button>' +
            '<button data-act="top" class="kid-big go-top">🏆 Top 10</button>' +
            '</div></div>' +
            U.backBar('Back to my garage'),
            {
                again: kidRace,
                fix: function () { kidFix(); },
                top: function () { kidTop(); },
                back: function () { kidHub(); }
            }
        );
    }

    // The top ten: the server's, or this browser's when it doesn't answer
    function kidTop() {
        function rows(list) {
            if (!list.length) return '<p class="kid-say">Nobody yet. Race and be the first!</p>';
            var me = (kid.name || '').toLowerCase();
            return '<ol class="board kid-board">' + list.map(function (r, i) {
                return '<li' + (r.name.toLowerCase() === me ? ' class="you"' : '') + '><span class="rank">' + (i + 1) + '</span>' +
                    '<span class="name">' + esc(r.name) + ' <small class="car">' + esc(r.car) + '</small></span><span class="val">' + Number(r.t).toFixed(2) + ' s</span></li>';
            }).join('') + '</ol>';
        }
        function show(list, local) {
            screen(
                '<div class="panel kid-panel"><h2>🏆 Top 10 kids</h2>' +
                '<p class="kid-say">The fastest times. Fix your car to get on it!</p>' + rows(list) +
                (local ? '<p class="sub">These are the times on this computer.</p>' : '') + '</div>' +
                U.backBar('Back to my garage'),
                { back: function () { kidHub(); } }
            );
        }
        show(L.kidLocalTop(), true);
        if (!L.account || !L.account.available || !L.account.kids) return;
        var shown = document.querySelector('.kids');
        L.account.kids().then(function (res) {
            if (res.error || document.querySelector('.kids') !== shown) return;     // offline, or they moved on
            show(res.top, false);
        });
    }
})(window.Lemon = window.Lemon || {});

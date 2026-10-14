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

    // Wires every [data-act] button in the screen to a handler by name
    function render(html, actions) {
        app.innerHTML = '';
        app.appendChild(el(html));
        app.querySelectorAll('[data-act]').forEach(function (b) {
            b.addEventListener('click', function () {
                var fn = actions[b.getAttribute('data-act')];
                if (fn) fn(b.getAttribute('data-arg'));
            });
        });
        var focus = app.querySelector('button:not([disabled])');
        if (focus) focus.focus({ preventScroll: true });
    }

    function status() {
        return '<div class="status"><span>' + money(g.cash) + '</span><span>Week ' + g.week +
            '</span><span>Wins ' + g.wins + ' · Losses ' + g.losses + '</span></div>';
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
            var err = fn(arg);
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

    L.showTitle = function () {
        var saved = L.load();
        render(
            '<div class="title-menu">' +
            '<p class="tag">Buy a junker. Build a hot rod. Beat The King.</p>' +
            (saved ? '<button data-act="cont">Continue (week ' + saved.week + ', ' + money(saved.cash) + ')</button>' : '') +
            '<button data-act="new">New game</button>' +
            '<p class="hint">Summer, 1963. You have ' + money(L.START_CASH) + ' and a driver\'s license.</p>' +
            '</div>',
            {
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

    // ── Hub ───────────────────────────────────────────────────────────────

    L.showHub = function (msg) {
        L.titleScreen(false);
        var car = L.activeCar(g);
        var carHtml;
        if (car) {
            var st = carStats(car);
            carHtml = '<div class="card"><h3>' + esc(L.carName(car)) + '</h3>' +
                '<p>' + st.hp + ' hp · quarter mile about ' + st.et.toFixed(1) + ' s</p>' +
                '<p>Engine ' + bar(car.engineCondition, 'Engine condition') + '</p></div>';
        } else {
            carHtml = '<div class="card"><h3>No car</h3><p>Check the classifieds.</p></div>';
        }
        render(
            status() + flash(msg) + carHtml +
            '<nav class="menu">' +
            '<button data-act="ads">Classifieds</button>' +
            '<button data-act="parts">Parts catalog</button>' +
            '<button data-act="garage">Garage</button>' +
            '<button data-act="stand">Burger stand</button>' +
            '<button data-act="week">Next week</button>' +
            '<button data-act="quit" class="minor">Title screen</button>' +
            '</nav>',
            {
                ads: function () { L.showAds(); },
                parts: function () { L.showParts(); },
                garage: function () { L.showGarage(); },
                stand: function () { L.showStand(); },
                week: function () { L.newWeek(g); L.save(g); L.showHub('A new week. New ads, new faces at the burger stand.'); },
                quit: function () { L.showTitle(); }
            }
        );
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
        var html = L.SLOTS.map(function (slot) {
            var items = L.CATALOG.filter(function (id) { return L.PARTS[id].slot === slot; });
            if (!items.length) return '';
            return '<h3>' + L.SLOT_NAMES[slot] + '</h3>' + items.map(function (id) {
                var p = L.PARTS[id];
                var owned = g.inventory.filter(function (x) { return x === id; }).length;
                return '<div class="row"><span>' + esc(p.name) + (p.needs ? ' <em>(needs ' + esc(L.PARTS[p.needs].name) + ')</em>' : '') +
                    (owned ? ' <em>· ' + owned + ' on your shelf</em>' : '') + '</span>' +
                    '<span class="price">' + money(p.price) + '</span>' +
                    '<button data-act="buy" data-arg="' + id + '"' + (g.cash < p.price ? ' disabled' : '') + '>Buy</button></div>';
            }).join('');
        }).join('');
        render(
            status() + flash(msg) + '<div class="panel"><h2>Speed Shop Catalog</h2>' + html + '</div>' +
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
                ' · worth ' + money(L.carValue(c)) + '</span>' +
                (i === g.active ? '<span class="price">Driving</span>' : '<button data-act="drive" data-arg="' + i + '">Drive</button>') +
                '<button data-act="sell" data-arg="' + i + '" class="minor">Sell</button></div>';
        }).join('') || '<p>No cars. Check the classifieds.</p>';

        var detail = '';
        if (car) {
            var st = carStats(car);
            var fixCost = L.fixAllCost(car);
            detail = '<div class="panel"><h2>' + esc(L.carName(car)) + '</h2>' +
                '<div class="dyno">' +
                '<p><b>' + st.hp + ' hp</b> at ' + st.hpRpm + ' rpm · redline ' + st.redline + '</p>' +
                '<p>0-60 ' + (st.zeroSixty ? st.zeroSixty.toFixed(1) + ' s' : 'n/a') + ' · quarter mile ' + st.et.toFixed(2) + ' s at ' + Math.round(st.trap) + ' mph</p>' +
                '<p>Body ' + car.condition + '%</p>' +
                (fixCost ? '<button data-act="fix">Fix car (' + money(fixCost) + ' for everything)</button>' : '<p class="sub">Everything is in good shape.</p>') +
                '</div>' +
                L.SLOTS.map(function (slot) {
                    return '<div class="row"><span><span class="slot">' + L.SLOT_NAMES[slot] + '</span>' + esc(L.PARTS[car.parts[slot]].name) + '</span>' +
                        '<span>' + bar(L.partCondition(car, slot), 'Condition') + '</span></div>';
                }).join('') + '</div>';
        }

        var shelf = g.inventory.map(function (id, i) {
            var p = L.PARTS[id];
            return '<div class="row"><span><span class="slot">' + L.SLOT_NAMES[p.slot] + '</span> ' + esc(p.name) + '</span>' +
                (car ? '<button data-act="install" data-arg="' + i + '">Install</button>' : '') +
                '<button data-act="sellpart" data-arg="' + i + '" class="minor">Sell ' + money(Math.floor(p.price / 2)) + '</button></div>';
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
                    ask('Sell your ' + L.carName(c) + ' to the dealer for ' + money(L.carValue(c)) + '?', 'Sell it',
                        act(L.showGarage, function () { return L.sellCar(g, +i) || 'Sold.'; }), L.showGarage);
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
        var total = L.fixAllCost(car);
        var rows = L.diagnose(car).map(function (d) {
            var name = esc(L.PARTS[d.part].name);
            var btns;
            if (d.action === 'ok') {
                btns = '<span class="price">Good</span>';
            } else if (d.action === 'repair') {
                btns = '<button data-act="repair" data-arg="' + d.slot + '"' + (g.cash < d.cost ? ' disabled' : '') + '>' +
                    (d.slot === 'engine' ? 'Rebuild ' : 'Repair ') + money(d.cost) + '</button>';
            } else {
                btns = '<span class="shot">' + (d.slot === 'tires' ? 'Worn out' : 'Shot, replace it') + '</span>' +
                    '<button data-act="junk" data-arg="' + d.slot + '"' + (g.cash < d.junk ? ' disabled' : '') + '>Used stock ' + money(d.junk) + '</button>' +
                    (d.fresh ? '<button data-act="new" data-arg="' + d.slot + '" class="minor"' + (g.cash < d.fresh ? ' disabled' : '') + '>New ' + money(d.fresh) + '</button>' : '');
            }
            return '<div class="row fix"><span><span class="slot">' + L.SLOT_NAMES[d.slot] + '</span>' + name + '<br>' +
                bar(d.condition, 'Condition') + '</span>' + btns + '</div>';
        }).join('');
        var budget = total
            ? 'Fixing everything costs ' + money(total) + '. You have ' + money(g.cash) + '.' + (total > g.cash ? ' Start with what you can afford: the engine and tires matter most.' : '')
            : 'Everything is in good shape.';

        function job(slot, how) {
            var part = L.PARTS[car.parts[slot]];
            var err = how === 'repair' ? L.canRepairPart(g, slot) : L.canReplacePart(g, slot, how);
            if (err) return L.showFix(err);
            var title, oldName = 'worn ' + part.name, newName;
            if (slot === 'engine') { title = 'Rebuilding the ' + part.name; oldName = 'worn cylinder heads'; newName = 'rebuilt heads'; }
            else if (how === 'repair') { title = 'Repairing the ' + part.name; newName = 'rebuilt ' + part.name; }
            else if (how === 'new') { title = 'Replacing the ' + part.name; newName = 'new ' + part.name; }
            else { title = 'Fitting a junkyard part'; newName = 'used ' + L.PARTS[L.STOCK_PARTS[slot]].name; }
            wrench(slot === 'engine' ? 'rebuild' : slot, title, oldName, newName, act(L.showFix, function () {
                var e = how === 'repair' ? L.repairPart(g, slot) : L.replacePart(g, slot, how);
                return e || (slot === 'engine' ? 'Engine rebuilt. Good as new.' : 'The ' + L.SLOT_NAMES[slot].toLowerCase() + ' is sorted.');
            }), L.showFix);
        }

        render(
            status() + flash(msg) +
            '<div class="panel"><h2>Fix the ' + esc(L.carName(car)) + '</h2><p class="sub">' + budget + '</p>' + rows + '</div>' +
            '<p class="hint">Each job opens the workbench: click the orange bolts out, then back in.</p>' +
            '<button data-act="back">Back to the garage</button>',
            {
                repair: function (slot) { job(slot, 'repair'); },
                junk: function (slot) { job(slot, 'junk'); },
                new: function (slot) { job(slot, 'new'); },
                back: function () { L.showGarage(); }
            }
        );
    };

    // A wrenching job on the canvas; finish() runs once the new part is bolted down,
    // back(msg) if you walk away from it
    function wrench(job, title, oldName, newName, finish, back) {
        render('<div class="race-controls"><p class="hint" id="wrench-line"></p>' +
            '<button data-act="cancel" class="minor">Leave it for now</button></div>', {
            cancel: function () { stop(); L.showCanvas(false); back('You put the wrenches down. Nothing changed.'); }
        });
        L.titleScreen(false);
        L.showCanvas(true);
        var lineEl = document.getElementById('wrench-line');
        var stop = L.startWrench(L.canvas, {
            job: job, title: title, oldName: oldName, newName: newName,
            onLine: function (text) { lineEl.textContent = text; }
        }, function () {
            L.showCanvas(false);
            finish();
        });
    }

    // ── Burger stand: pick a race ─────────────────────────────────────────

    L.showStand = function (msg) {
        var car = L.activeCar(g);
        var rows = g.rivals.map(function (r, i) {
            var funErr = L.canRace(g, r, 'fun');
            var cashErr = L.canRace(g, r, 'cash');
            var pinkErr = L.canRace(g, r, 'pinks');
            var buttons = r.king
                ? '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Race for his crown: pinks and ' + money(L.KING_PRIZE) + '</button>'
                : '<button data-act="fun" data-arg="' + i + '" class="minor"' + (funErr ? ' disabled' : '') + '>' +
                    (r.funDone ? 'Raced for fun this week' : 'Just for fun (win ' + money(L.funPrize(r)) + ')') + '</button>' +
                  '<button data-act="cash" data-arg="' + i + '"' + (cashErr ? ' disabled title="You need ' + money(L.RIVAL_PRIZE) + ' to put up"' : '') + '>Race for ' + money(L.RIVAL_PRIZE) + '</button>' +
                  '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Pink slips and ' + money(L.RIVAL_PRIZE) + '</button>';
            return '<div class="card rival' + (r.king ? ' king' : '') + '"><h3>' + esc(r.name) + '</h3>' +
                '<p>Drives a ' + esc(L.BODIES[r.body].name) + '. <em>"' + esc(r.line) + '"</em></p>' +
                (car ? chances(L.odds(car, r)) : '') + buttons +
                '</div>';
        }).join('') || '<p>Nobody wants to race you this week. Come back next week.</p>';
        var why = car ? (car.engineCondition <= 0 ? 'Your engine is blown. Rebuild it in the garage.' : '') : 'You need a car to race.';
        render(
            status() + flash(msg || why) +
            '<div class="panel"><h2>The Burger Stand</h2><p class="sub">Friday night. Engines idling, everybody watching.</p>' + rows + '</div>' +
            '<p class="hint">At the race: press Space, Enter or the big button when the start light turns green, then again each time the SHIFT light goes green. Keep out of the red. A race just for fun risks nothing and pays a little; a real race is ' + money(L.RIVAL_PRIZE) + ' or pink slips.</p>' +
            '<button data-act="back">Back</button>',
            {
                cash: function (i) { race(+i, 'cash'); },
                fun: function (i) { race(+i, 'fun'); },
                pinks: function (i) {
                    var r = g.rivals[+i];
                    ask('Race ' + r.name + ' for pink slips? Win and you take their car and ' + money(r.king ? L.KING_PRIZE : L.RIVAL_PRIZE) +
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
            '<p class="hint">Racing ' + esc(rival.name) + ' ' + (pinks ? 'for pink slips' : stake === 'fun' ? 'just for fun' : 'for ' + money(L.RIVAL_PRIZE)) +
            '. Shift when the SHIFT light goes green.</p>' +
            '<button data-act="sound" class="minor" id="sound">Sound: ' + (L.sound.on ? 'on' : 'off') + '</button></div>', {
            sound: function () { document.getElementById('sound').textContent = 'Sound: ' + (L.sound.toggle() ? 'on' : 'off'); L.sound.begin(); L.sound.engineOn(); }
        });
        L.titleScreen(false);
        L.showCanvas(true);
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

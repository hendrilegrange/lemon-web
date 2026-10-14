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
            var cost = L.repairCost(car);
            detail = '<div class="panel"><h2>' + esc(L.carName(car)) + '</h2>' +
                '<div class="dyno">' +
                '<p><b>' + st.hp + ' hp</b> at ' + st.hpRpm + ' rpm · redline ' + st.redline + '</p>' +
                '<p>0-60 ' + (st.zeroSixty ? st.zeroSixty.toFixed(1) + ' s' : 'n/a') + ' · quarter mile ' + st.et.toFixed(2) + ' s at ' + Math.round(st.trap) + ' mph</p>' +
                '<p>Engine ' + bar(car.engineCondition, 'Engine condition') + ' · Body ' + car.condition + '%</p>' +
                (cost ? '<button data-act="repair"' + (g.cash < cost ? ' disabled' : '') + '>Rebuild engine (' + money(cost) + ')</button>' : '') +
                '</div>' +
                L.SLOTS.map(function (slot) {
                    return '<div class="row"><span class="slot">' + L.SLOT_NAMES[slot] + '</span><span>' + esc(L.PARTS[car.parts[slot]].name) + '</span></div>';
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
                        act(L.showGarage, function () { return L.installPart(g, +i) || 'Installed the ' + part.name + '.'; }));
                },
                sellpart: act(L.showGarage, function (i) { return L.sellPart(g, +i); }),
                repair: function () {
                    var err = L.canRepair(g);
                    if (err) return L.showGarage(err);
                    wrench('rebuild', 'Rebuilding the ' + L.PARTS[car.parts.engine].name, 'worn cylinder heads', 'rebuilt heads',
                        act(L.showGarage, function () { return L.repair(g) || 'Engine rebuilt. Good as new.'; }));
                },
                back: function () { L.showHub(); }
            }
        );
    };

    // A wrenching job on the canvas; finish() runs once the new part is bolted down
    function wrench(job, title, oldName, newName, finish) {
        render('<div class="race-controls"><p class="hint" id="wrench-line"></p>' +
            '<button data-act="cancel" class="minor">Leave it for now</button></div>', {
            cancel: function () { stop(); L.showCanvas(false); L.showGarage('You put the wrenches down. Nothing changed.'); }
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
            var cashErr = L.canRace(g, r, false);
            var pinkErr = L.canRace(g, r, true);
            return '<div class="card rival"><h3>' + esc(r.name) + '</h3>' +
                '<p>Drives a ' + esc(L.BODIES[r.body].name) + '. <em>"' + esc(r.line) + '"</em></p>' +
                '<button data-act="cash" data-arg="' + i + '"' + (cashErr ? ' disabled' : '') + '>Race for ' + money(r.bet) + '</button>' +
                (r.pinks ? '<button data-act="pinks" data-arg="' + i + '" class="danger"' + (pinkErr ? ' disabled' : '') + '>Race for pink slips</button>' : '') +
                '</div>';
        }).join('') || '<p>Nobody wants to race you this week. Come back next week.</p>';
        var why = car ? (car.engineCondition <= 0 ? 'Your engine is blown. Rebuild it in the garage.' : '') : 'You need a car to race.';
        render(
            status() + flash(msg || why) +
            '<div class="panel"><h2>The Burger Stand</h2><p class="sub">Friday night. Engines idling, everybody watching.</p>' + rows + '</div>' +
            '<p class="hint">At the race: press Space, Enter or the big button when the light turns green, then again to shift. Keep out of the red.</p>' +
            '<button data-act="back">Back</button>',
            {
                cash: function (i) { race(+i, false); },
                pinks: function (i) {
                    ask('Race ' + g.rivals[+i].name + ' for pink slips? If you lose, they keep your ' + L.carName(L.activeCar(g)) + '.',
                        'Race for pinks', function () { race(+i, true); }, L.showStand);
                },
                back: function () { L.showHub(); }
            }
        );
    };

    function race(i, pinks) {
        var rival = g.rivals[i];
        var err = L.canRace(g, rival, pinks);
        if (err) return L.showStand(err);
        var car = L.activeCar(g);
        render('<div class="race-controls"><button class="go" id="go">GO / SHIFT</button>' +
            '<p class="hint">Racing ' + esc(rival.name) + ' for ' + (pinks ? 'pink slips' : money(rival.bet)) + '</p></div>', {});
        L.titleScreen(false);
        L.showCanvas(true);
        var rcar = L.rivalCar(rival);
        L.startRace(
            L.canvas,
            document.getElementById('go'),
            { spec: L.spec(car), color: L.BODIES[car.body].color, condition: car.engineCondition },
            { spec: L.spec(rcar), color: '#e8e8e8', skill: rival.skill },
            function (result, damage, sum) {
                var line = L.settleRace(g, i, pinks, result, damage);
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

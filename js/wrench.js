// The workbench on the canvas. Wrenching: swapping a part or rebuilding the engine. Click the
// highlighted bolts to take them out, the old part comes off and the new one goes on, then
// click the bolts back in. Grey bolts hold something else and stay put, and on a repair the
// ones with a green tick are still tight. Bodywork: click each rust spot to grind it to bare
// metal, again to fill it, and then the car gets its paint.
(function (L) {
    'use strict';

    var W = 320, H = 200;
    var SPIN = 0.35;        // seconds a bolt takes to spin out or in
    var SWAP = 0.7;         // seconds for the old part to lift out, and again for the new one to drop in
    var HIT = 12;           // how close a click must land to a bolt, in screen pixels
    var OLD = 'old', NEW = 'new';   // which part is on the bench

    // Each job: the shapes of the part ([x, y, w, h] rects and [x, y, r] circles) and its
    // bolts ([x, y] must come out, [x, y, 'reason'] holds something else). At most 8 bolts.
    L.WRENCH = {
        engine: {
            rects: [[105, 70, 110, 60], [118, 58, 84, 12]], circles: [[96, 112, 14]],
            bolts: [[112, 77], [160, 77], [208, 77], [112, 123], [160, 123], [208, 123],
                [70, 100, 'That one holds the radiator.'], [250, 100, 'That one holds the firewall bracket.']]
        },
        carb: {
            rects: [[130, 80, 60, 40], [95, 125, 130, 15]], circles: [[160, 70, 16]],
            bolts: [[135, 85], [185, 85], [135, 115], [185, 115],
                [105, 132, 'That bolt holds the intake down.'], [215, 132, 'That bolt holds the intake down.']]
        },
        intake: {
            rects: [[90, 85, 140, 30], [90, 132, 140, 16]],
            bolts: [[98, 89], [98, 111], [140, 100], [180, 100], [222, 89], [222, 111],
                [105, 140, 'That one holds the valve cover.'], [215, 140, 'That one holds the valve cover.']]
        },
        cam: {
            rects: [[115, 65, 90, 70]], circles: [[160, 100, 18]],
            bolts: [[122, 72], [198, 72], [122, 128], [198, 128],
                [160, 50, 'That one holds the water pump.'], [160, 152, 'That one holds the oil pan.']]
        },
        exhaust: {
            rects: [[85, 70, 150, 20], [100, 90, 8, 50], [140, 90, 8, 50], [172, 90, 8, 50], [212, 90, 8, 50], [100, 140, 120, 12]],
            bolts: [[97, 80], [122, 80], [147, 80], [172, 80], [197, 80], [222, 80],
                [60, 80, "That's the starter. Leave it."], [260, 80, "That's the steering box. Leave it."]]
        },
        trans: {
            rects: [[110, 60, 80, 80], [190, 85, 70, 30]],
            bolts: [[115, 65], [185, 65], [115, 135], [185, 135],
                [225, 70, 'That one holds the clutch linkage.'], [245, 130, "That's the speedometer cable."]]
        },
        rear: {
            rects: [[40, 92, 75, 16], [205, 92, 75, 16]], circles: [[160, 100, 45]],
            bolts: [[198, 100], [179, 133], [141, 133], [122, 100], [141, 67], [179, 67],
                [70, 85, "That's the brake line."], [250, 85, "That's the brake line."]]
        },
        tires: {
            circles: [[160, 100, 50], [160, 100, 30]],
            bolts: [[160, 78], [181, 93], [173, 118], [147, 118], [139, 93],
                [228, 48, 'That one holds the fender.']]
        },
        rebuild: {
            rects: [[85, 72, 70, 56], [165, 72, 70, 56]],
            bolts: [[95, 82], [145, 82], [120, 118], [175, 82], [225, 82], [200, 118],
                [160, 52, 'That one holds the distributor.'], [160, 148, 'That one holds the oil pan.']]
        }
    };

    // Starts a job on the canvas. opts: { job, oldName, newName, title, share, onLine(text) }.
    // done(true) when the part is on and bolted down; returns a function that cancels.
    L.startWrench = function (canvas, opts, done) {
        // opts.big: bolts twice the size, easier to hit (the kids' garage)
        var k = opts.big ? 2 : 1, hit = opts.big ? 22 : HIT;
        var ctx = canvas.getContext('2d');
        var job = L.WRENCH[opts.job];
        // opts.share (0-1): how much of the job a repair needs, so a lightly worn part only
        // has a couple of its bolts to undo; the rest are still tight (snug) and stay put.
        // A swap undoes them all.
        var need = Math.max(2, Math.ceil(job.bolts.filter(function (b) { return !b[2]; }).length * (opts.share == null ? 1 : opts.share)));
        var bolts = job.bolts.map(function (b) {
            return { x: b[0], y: b[1], reason: b[2] || null, snug: !b[2] && need-- <= 0, out: false, anim: null, wrong: null };
        });
        var st = { phase: 'off', clock: 0, swapAt: 0, doneAt: 0, last: null, stopped: false };

        function left() {
            return bolts.filter(function (b) {
                return !b.reason && !b.snug && (st.phase === 'off' ? !b.out : b.out) && !b.anim;
            }).length;
        }

        function line(text) { if (opts.onLine) opts.onLine(text); }

        function prompt() {
            var n = left();
            if (st.phase === 'off') line('Take out the ' + n + ' orange bolt' + (n === 1 ? '' : 's') + ' to pull the ' + opts.oldName + '.');
            else if (st.phase === 'on') line('Bolt the ' + opts.newName + ' down: ' + n + ' to go.');
        }

        function onPointer(e) {
            if (st.phase !== 'off' && st.phase !== 'on') return;
            var pt = canvasPoint(canvas, e), x = pt.x, y = pt.y;
            var best = null, bestD = hit;
            bolts.forEach(function (b) {
                var d = Math.hypot(b.x - x, b.y - y);
                if (d < bestD) { best = b; bestD = d; }
            });
            if (!best || best.anim) return;
            if (best.snug) {
                best.wrong = st.clock;
                line("That one's still tight. Leave it.");
                return;
            }
            if (best.reason) {
                best.wrong = st.clock;
                L.sound.clank();
                line(best.reason);
                return;
            }
            if (st.phase === 'off' && !best.out) { best.anim = { at: st.clock, dir: 'out' }; L.sound.ratchet(); }
            if (st.phase === 'on' && best.out) { best.anim = { at: st.clock, dir: 'in' }; L.sound.ratchet(); }
        }

        function update() {
            bolts.forEach(function (b) {
                if (b.anim && st.clock - b.anim.at >= SPIN) {
                    b.out = b.anim.dir === 'out';
                    b.anim = null;
                    if (!b.out) L.sound.clink();
                    if (left() === 0) {
                        if (st.phase === 'off') { st.phase = 'swap'; st.swapAt = st.clock; line('Off it comes.'); L.sound.thunk(); }
                        else { st.phase = 'done'; st.doneAt = st.clock; line('Done. Tight as a drum.'); L.sound.ding(); }
                    } else {
                        prompt();
                    }
                }
            });
            if (st.phase === 'swap' && st.clock - st.swapAt >= SWAP * 2) { st.phase = 'on'; prompt(); L.sound.thunk(); }
            if (st.phase === 'done' && st.clock - st.doneAt >= 0.8) { stop(); done(true); }
        }

        // ── Drawing ───────────────────────────────────────────────────────

        function background() {
            L.drawGarage(ctx, W, H);
            bolts.forEach(function (b) { if (b.reason) L.drawBracket(ctx, b.x, b.y); });
        }

        function bolt(b) {
            var holding = st.phase === 'off' ? !b.out : b.out;
            var lift = 0, turn = 0, show = b.reason || !b.out;
            if (b.anim) {
                var p = Math.min(1, (st.clock - b.anim.at) / SPIN);
                if (b.anim.dir === 'in') p = 1 - p;
                turn = Math.floor(p * 12);
                lift = Math.round(p * 8 * k);
                show = true;
            }
            if (!b.reason && (b.out || b.anim)) L.drawHole(ctx, b.x, b.y, k);
            // Orange ring on the bolts that still need doing
            if (!b.reason && !b.snug && !b.anim && holding && (st.phase === 'off' || st.phase === 'on')) L.drawTarget(ctx, b.x, b.y, 8 + 6 * (k - 1), st.clock);
            if (!show) return;
            var wrong = b.wrong !== null && st.clock - b.wrong < 0.5;
            var dx = wrong ? Math.round(Math.sin(st.clock * 60) * 2) : 0;
            L.drawBolt(ctx, b.x + dx, b.y - lift, wrong ? 'wrong' : b.reason ? 'other' : 'steel', turn, k);
            if (b.snug) tick(b.x + 6 * k, b.y - 9 * k);
        }

        // A little green tick by a bolt that's still tight
        function tick(x, y) {
            ctx.fillStyle = '#3bff6e';
            [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]].forEach(function (p) { ctx.fillRect(x + p[0], y + p[1], 1, 2); });
        }

        function draw() {
            background();
            var dy = 0, color = st.phase === 'off' ? OLD : NEW;
            if (st.phase === 'swap') {
                var t = (st.clock - st.swapAt) / SWAP;
                if (t < 1) { color = OLD; dy = -t * t * 170; }
                else { color = NEW; dy = -(1 - (t - 1)) * (1 - (t - 1)) * 170; }
            }
            L.drawPart(ctx, opts.job, color === NEW, dy, st.clock, color === NEW ? opts.newCls : opts.oldCls);
            bolts.forEach(function (b) {
                // The part's own bolts are out while it moves; ones holding something else stay
                if (st.phase === 'swap' && !b.reason) return;
                bolt(b);
            });
            L.text(ctx, opts.title, 8, 16, { color: '#ffd23f', scale: fit(opts.title, W - 16) });
            var label = st.phase === 'off' || (st.phase === 'swap' && color === OLD) ? opts.oldName : opts.newName;
            L.text(ctx, label, W / 2, 178, { color: '#f4e9c8', scale: fit(label, W - 16), align: 'center' });
            if (st.phase === 'done') L.text(ctx, 'DONE', W / 2, 196, { color: '#3bff6e', scale: 2, align: 'center' });
        }

        function frame(now) {
            if (st.stopped) return;
            if (st.last !== null) st.clock += Math.min(0.1, (now - st.last) / 1000);
            st.last = now;
            update();
            if (!st.stopped) {
                draw();
                requestAnimationFrame(frame);
            }
        }

        function stop() {
            st.stopped = true;
            canvas.removeEventListener('pointerdown', onPointer);
            canvas.style.cursor = '';
        }

        canvas.addEventListener('pointerdown', onPointer);
        canvas.style.cursor = 'pointer';
        prompt();
        requestAnimationFrame(frame);
        return stop;
    };

    // Where a click landed on the canvas, in its 320x200 pixels (the border doesn't count)
    // Text at double size when it fits in the width, else single
    function fit(str, width) { return L.textWidth(str, 2) <= width ? 2 : 1; }

    function canvasPoint(canvas, e) {
        var r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left - canvas.clientLeft) * W / canvas.clientWidth,
            y: (e.clientY - r.top - canvas.clientTop) * H / canvas.clientHeight
        };
    }

    // ── Bodywork ──────────────────────────────────────────────────────────

    // The car side-on, five times the size it is on the strip
    var BODY = { x: 50, y: 95, w: 220, h: 40 }, CAB = { x: 100, y: 60, w: 100, h: 35 };
    var GRIND = 0.3, PAINT = 1.2;
    // A spot's look by stage: rust, ground to bare metal, filled with body filler
    var SPOT = [
        ['#2a1206', '#5c2e0e', '#8b4513', '#a8642e', '#c48450'],
        ['#3a4048', '#7a8490', '#b0bac4', '#d8e0e8', '#ffffff'],
        ['#4a4030', '#8a7a5a', '#c8b890', '#ddd0b0', '#f4ead0']
    ];

    // Rust spots spread over the body panels, far enough apart to click on a phone: a row
    // along the doors and a few low down between the wheels, picked at random
    var SPOT_SLOTS = [62, 90, 118, 146, 174, 202, 230, 258].map(function (x) { return [x, 103]; })
        .concat([[132, 126], [160, 126], [188, 126]]);

    function rustSpots(n) {
        var free = SPOT_SLOTS.slice(), spots = [];
        while (spots.length < n && free.length) {
            var slot = free.splice(Math.floor(L.random() * free.length), 1)[0];
            spots.push({ x: slot[0] + Math.round(L.random() * 6 - 3), y: slot[1], stage: 0, at: -1 });
        }
        return spots;
    }

    // Starts bodywork on the canvas. opts: { spots (1-8), color, title, onLine(text) }.
    // done() once it's painted; returns a function that cancels.
    L.startBodywork = function (canvas, opts, done) {
        var ctx = canvas.getContext('2d');
        var spots = rustSpots(opts.spots);
        var drop = L.shapeDrop(opts.color && opts.color.shape) * 5;     // a lower body: its panels sit lower
        spots.forEach(function (p) { p.y += drop; });
        var st = { phase: 'work', clock: 0, paintAt: 0, last: null, stopped: false };

        function line(text) { if (opts.onLine) opts.onLine(text); }

        function prompt() {
            var rust = spots.filter(function (p) { return p.stage === 0; }).length;
            var bare = spots.filter(function (p) { return p.stage === 1; }).length;
            if (rust) line('Click the rust spots to grind them to bare metal: ' + rust + ' to go' + (bare ? ', and ' + bare + ' to fill.' : '.'));
            else if (bare) line('Click the bare metal to fill it: ' + bare + ' to go.');
        }

        function onPointer(e) {
            if (st.phase !== 'work') return;
            var pt = canvasPoint(canvas, e);
            var best = null, bestD = HIT;
            spots.forEach(function (p) {
                var d = Math.hypot(p.x - pt.x, p.y - pt.y);
                if (p.stage < 2 && d < bestD) { best = p; bestD = d; }
            });
            if (!best || st.clock - best.at < GRIND) return;
            best.stage++;
            best.at = st.clock;
            if (best.stage === 1) L.sound.grind(GRIND);
            else L.sound.smear();
            if (spots.every(function (p) { return p.stage === 2; })) {
                st.phase = 'paint';
                st.paintAt = st.clock + GRIND;
                line('Laying on the paint...');
                setTimeout(function () { if (!st.stopped) L.sound.spray(PAINT); }, GRIND * 1000);
            } else {
                prompt();
            }
        }

        // The car five times the size it is on the strip, filling BODY and CAB; clip is
        // how far across the new paint has reached
        function car(color, clip) {
            L.drawCar(ctx, BODY.x, CAB.y, color, { scale: 5, clip: clip, shape: opts.color && opts.color.shape });
        }

        function draw() {
            L.drawGarage(ctx, W, H);
            L.text(ctx, opts.title, 8, 16, { color: '#ffd23f', scale: fit(opts.title, W - 16) });

            // Faded old paint, then the new paint sweeping across once the panels are ready
            car('#6a645a');
            var sweep = st.phase === 'work' ? 0 : Math.min(1, (st.clock - st.paintAt) / PAINT);
            var paintX = BODY.x - 10 + sweep * (BODY.w + 20);
            if (sweep > 0) car(opts.color, paintX);

            spots.forEach(function (p) {
                if (sweep > 0 && p.x < paintX) return;     // painted over
                var fresh = st.clock - p.at < GRIND;
                L.art.ball(ctx, p.x, p.y, 7, SPOT[p.stage]);
                if (p.stage === 0) {                       // flaky rust
                    L.art.speckle(ctx, p.x - 5, p.y - 5, 11, 11, p.x * 7 + p.y, ['#3a1a06', '#c06a30'], 0.25,
                        function (x, y) { return Math.hypot(x - p.x, y - p.y) < 6; });
                }
                if (fresh && p.stage === 1) {              // grinder sparks
                    ctx.fillStyle = '#ffd23f';
                    for (var i = 0; i < 6; i++) ctx.fillRect(p.x + 8 + i * 3, p.y - 6 - ((i * 7 + Math.floor(st.clock * 40)) % 9), 1, 1);
                }
                if (p.stage < 2 && st.phase === 'work') L.drawTarget(ctx, p.x, p.y, 10, st.clock);
            });
            if (sweep > 0 && sweep < 1) {                  // the spray gun's mist
                ctx.fillStyle = '#e8e8f0';
                for (var my = CAB.y - 6; my < BODY.y + BODY.h + 6; my += 2) {
                    ctx.fillRect(Math.round(paintX) - 4 + (my / 2) % 2, my, 1, 1);
                    ctx.fillRect(Math.round(paintX) + (my / 2) % 3, my + 1, 1, 1);
                }
            }
            if (st.phase === 'done') {
                L.text(ctx, 'DONE', W / 2, 190, { color: '#3bff6e', scale: 2, align: 'center' });
            }
        }

        function frame(now) {
            if (st.stopped) return;
            if (st.last !== null) st.clock += Math.min(0.1, (now - st.last) / 1000);
            st.last = now;
            if (st.phase === 'paint' && st.clock - st.paintAt >= PAINT) { st.phase = 'done'; st.doneAt = st.clock; line('Done. Looking sharp.'); L.sound.ding(); }
            if (st.phase === 'done' && st.clock - st.doneAt >= 0.8) { stop(); done(true); return; }
            draw();
            requestAnimationFrame(frame);
        }

        function stop() {
            st.stopped = true;
            canvas.removeEventListener('pointerdown', onPointer);
            canvas.style.cursor = '';
        }

        canvas.addEventListener('pointerdown', onPointer);
        canvas.style.cursor = 'pointer';
        prompt();
        requestAnimationFrame(frame);
        return stop;
    };

    L.rustSpots = rustSpots;
})(window.Lemon = window.Lemon || {});

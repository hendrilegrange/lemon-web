// The workbench on the canvas. Wrenching: swapping a part or rebuilding the engine. Click the
// highlighted bolts to take them out, the old part comes off and the new one goes on, then
// click the bolts back in. Grey bolts hold something else and stay put. Bodywork: click each
// rust spot to grind it to bare metal, again to fill it, and then the car gets its paint.
(function (L) {
    'use strict';

    var W = 320, H = 200;
    var SPIN = 0.35;        // seconds a bolt takes to spin out or in
    var SWAP = 0.7;         // seconds for the old part to lift out, and again for the new one to drop in
    var HIT = 12;           // how close a click must land to a bolt, in screen pixels
    var OLD = '#7a5c44', NEW = '#b8c4cc';

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

    // Starts a job on the canvas. opts: { job, oldName, newName, title, onLine(text) }.
    // done(true) when the part is on and bolted down; returns a function that cancels.
    L.startWrench = function (canvas, opts, done) {
        var ctx = canvas.getContext('2d');
        var job = L.WRENCH[opts.job];
        var bolts = job.bolts.map(function (b) {
            return { x: b[0], y: b[1], reason: b[2] || null, out: false, anim: null, wrong: null };
        });
        var st = { phase: 'off', clock: 0, swapAt: 0, doneAt: 0, last: null, stopped: false };

        function left() {
            return bolts.filter(function (b) {
                return !b.reason && (st.phase === 'off' ? !b.out : b.out) && !b.anim;
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
            var best = null, bestD = HIT;
            bolts.forEach(function (b) {
                var d = Math.hypot(b.x - x, b.y - y);
                if (d < bestD) { best = b; bestD = d; }
            });
            if (!best || best.anim) return;
            if (best.reason) {
                best.wrong = st.clock;
                line(best.reason);
                return;
            }
            if (st.phase === 'off' && !best.out) best.anim = { at: st.clock, dir: 'out' };
            if (st.phase === 'on' && best.out) best.anim = { at: st.clock, dir: 'in' };
        }

        function update() {
            bolts.forEach(function (b) {
                if (b.anim && st.clock - b.anim.at >= SPIN) {
                    b.out = b.anim.dir === 'out';
                    b.anim = null;
                    if (left() === 0) {
                        if (st.phase === 'off') { st.phase = 'swap'; st.swapAt = st.clock; line('Off it comes.'); }
                        else { st.phase = 'done'; st.doneAt = st.clock; line('Done. Tight as a drum.'); }
                    } else {
                        prompt();
                    }
                }
            });
            if (st.phase === 'swap' && st.clock - st.swapAt >= SWAP * 2) { st.phase = 'on'; prompt(); }
            if (st.phase === 'done' && st.clock - st.doneAt >= 0.8) { stop(); done(true); }
        }

        // ── Drawing ───────────────────────────────────────────────────────

        function background() {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, W, 160);
            ctx.fillStyle = '#24243f';                    // pegboard
            for (var x = 8; x < W; x += 12) for (var y = 8; y < 150; y += 12) ctx.fillRect(x, y, 1, 1);
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 160, W, 40);
            ctx.fillStyle = '#2c2c2c';                    // oil stains
            ctx.fillRect(40, 172, 30, 4);
            ctx.fillRect(230, 182, 22, 3);
            ctx.fillStyle = '#ffd23f';
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(opts.title.toUpperCase(), 8, 14);
        }

        // The part, shifted up by dy while it lifts out or drops in
        function part(color, dy) {
            ctx.fillStyle = color;
            (job.rects || []).forEach(function (r) { ctx.fillRect(r[0], r[1] + dy, r[2], r[3]); });
            (job.circles || []).forEach(function (c, i) {
                ctx.beginPath();
                ctx.arc(c[0], c[1] + dy, c[2], 0, Math.PI * 2);
                ctx.fillStyle = i ? shade(color) : color;
                ctx.fill();
            });
            ctx.fillStyle = shade(color);                 // a highlight edge to give it some depth
            (job.rects || []).forEach(function (r) { ctx.fillRect(r[0], r[1] + dy + r[3] - 3, r[2], 3); });
        }

        function shade(color) { return color === OLD ? '#5a4232' : '#8a96a0'; }

        function hex(x, y, r, fill, angle) {
            ctx.beginPath();
            for (var i = 0; i < 6; i++) {
                var a = angle + i * Math.PI / 3;
                ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        }

        function bolt(b) {
            var pulse = 0.5 + 0.5 * Math.sin(st.clock * 8);
            var holding = st.phase === 'off' ? !b.out : b.out;
            var lift = 0, angle = 0, show = b.reason || !b.out;
            if (b.anim) {
                var p = Math.min(1, (st.clock - b.anim.at) / SPIN);
                if (b.anim.dir === 'in') p = 1 - p;
                angle = p * Math.PI * 4;
                lift = p * 8;
                show = true;
            }
            if (!b.reason && b.out && !b.anim) {        // an empty hole
                ctx.fillStyle = '#0d0d0d';
                ctx.beginPath();
                ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            // Orange ring on the bolts that still need doing
            if (!b.reason && !b.anim && holding && (st.phase === 'off' || st.phase === 'on')) {
                ctx.strokeStyle = 'rgba(255,140,0,' + (0.5 + 0.5 * pulse) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (!show) return;
            var wrong = b.wrong !== null && st.clock - b.wrong < 0.5;
            var dx = wrong ? Math.round(Math.sin(st.clock * 60) * 2) : 0;
            var fill = wrong ? '#ff3b3b' : b.reason ? '#6e6e78' : '#d0d0d8';
            hex(b.x + dx, b.y - lift, 5, fill, angle);
            ctx.fillStyle = b.reason ? '#4a4a52' : '#8a8a94';
            ctx.fillRect(b.x + dx - 1, b.y - lift - 1, 2, 2);
        }

        function draw() {
            background();
            var dy = 0, color = st.phase === 'off' ? OLD : NEW;
            if (st.phase === 'swap') {
                var t = (st.clock - st.swapAt) / SWAP;
                if (t < 1) { color = OLD; dy = -t * t * 170; }
                else { color = NEW; dy = -(1 - (t - 1)) * (1 - (t - 1)) * 170; }
            }
            part(color, Math.round(dy));
            bolts.forEach(function (b) {
                // The part's own bolts are out while it moves; ones holding something else stay
                if (st.phase === 'swap' && !b.reason) return;
                bolt(b);
            });
            ctx.fillStyle = '#f4e9c8';
            ctx.font = '8px "Courier New", monospace';
            ctx.textAlign = 'center';
            var label = st.phase === 'off' || (st.phase === 'swap' && color === OLD) ? opts.oldName : opts.newName;
            ctx.fillText(label, W / 2, 178);
            if (st.phase === 'done') {
                ctx.fillStyle = '#3bff6e';
                ctx.font = 'bold 14px "Courier New", monospace';
                ctx.fillText('DONE', W / 2, 192);
            }
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
            if (spots.every(function (p) { return p.stage === 2; })) {
                st.phase = 'paint';
                st.paintAt = st.clock + GRIND;
                line('Laying on the paint...');
            } else {
                prompt();
            }
        }

        function car(color, clipX) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, clipX, H);
            ctx.clip();
            ctx.fillStyle = color;
            ctx.fillRect(BODY.x, BODY.y, BODY.w, BODY.h);
            ctx.fillRect(CAB.x, CAB.y, CAB.w, CAB.h);
            ctx.restore();
        }

        function draw() {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, W, 160);
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 160, W, 40);
            ctx.fillStyle = '#ffd23f';
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(opts.title.toUpperCase(), 8, 14);

            // Faded old paint, then the new paint sweeping across once the panels are ready
            car('#5f5a52', W);
            var sweep = st.phase === 'work' ? 0 : Math.min(1, (st.clock - st.paintAt) / PAINT);
            var paintX = BODY.x - 10 + sweep * (BODY.w + 20);
            if (sweep > 0) car(opts.color, paintX);
            ctx.fillStyle = '#9ad1ff';                     // windows
            ctx.fillRect(CAB.x + 15, CAB.y + 10, 30, 20);
            ctx.fillRect(CAB.x + 55, CAB.y + 10, 30, 20);
            ctx.fillStyle = '#111';                        // tires
            ctx.fillRect(70, 125, 50, 40);
            ctx.fillRect(210, 135, 35, 30);

            var pulse = 0.5 + 0.5 * Math.sin(st.clock * 8);
            spots.forEach(function (p) {
                if (sweep > 0 && p.x < paintX) return;     // painted over
                var fresh = st.clock - p.at < GRIND;
                ctx.fillStyle = p.stage === 0 ? '#8b4513' : p.stage === 1 ? '#b8bcc4' : '#d8c8a0';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
                ctx.fill();
                if (p.stage === 0) {                       // flaky rust
                    ctx.fillStyle = '#5c2e0e';
                    ctx.fillRect(p.x - 3, p.y - 2, 2, 2);
                    ctx.fillRect(p.x + 2, p.y + 1, 2, 2);
                }
                if (fresh && p.stage === 1) {              // grinder sparks
                    ctx.fillStyle = '#ffd23f';
                    for (var i = 0; i < 6; i++) ctx.fillRect(p.x + 8 + i * 3, p.y - 6 - ((i * 7 + Math.floor(st.clock * 40)) % 9), 1, 1);
                }
                if (p.stage < 2 && st.phase === 'work') {
                    ctx.strokeStyle = 'rgba(255,140,0,' + (0.5 + 0.5 * pulse) + ')';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
            if (sweep > 0 && sweep < 1) {                  // the spray gun's mist
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(paintX - 4, CAB.y - 6, 8, BODY.y + BODY.h - CAB.y + 12);
            }
            if (st.phase === 'done') {
                ctx.fillStyle = '#3bff6e';
                ctx.font = 'bold 14px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('DONE', W / 2, 188);
            }
        }

        function frame(now) {
            if (st.stopped) return;
            if (st.last !== null) st.clock += Math.min(0.1, (now - st.last) / 1000);
            st.last = now;
            if (st.phase === 'paint' && st.clock - st.paintAt >= PAINT) { st.phase = 'done'; st.doneAt = st.clock; line('Done. Looking sharp.'); }
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

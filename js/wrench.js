// Wrenching: swapping a part or rebuilding the engine on the canvas. Click the highlighted
// bolts to take them out, the old part comes off and the new one goes on, then click the
// bolts back in. Grey bolts hold something else and stay put.
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
            var r = canvas.getBoundingClientRect();       // includes the border, so measure inside it
            var x = (e.clientX - r.left - canvas.clientLeft) * W / canvas.clientWidth;
            var y = (e.clientY - r.top - canvas.clientTop) * H / canvas.clientHeight;
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
})(window.Lemon = window.Lemon || {});

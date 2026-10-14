// The drag race: a Christmas tree start, then you shift by hand down a quarter mile.
// Space, Enter or the big button launches at green and shifts after that.
(function (L) {
    'use strict';

    var W = 320, H = 200;
    var DT = 1 / 120;
    var PX_PER_M = 2.2;
    var LANE_Y = [96, 122];      // rival lane, player lane (screen y of the car's roof)

    L.drawCar = function (ctx, x, y, color, opts) {
        opts = opts || {};
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 7, 44, 8);            // body
        ctx.fillRect(x + 10, y, 20, 7);           // cab
        ctx.fillStyle = '#9ad1ff';
        ctx.fillRect(x + 13, y + 2, 6, 4);        // windows
        ctx.fillRect(x + 21, y + 2, 6, 4);
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(x + 32, y + 4, 6, 3);        // air cleaner poking out of the hood
        ctx.fillStyle = '#111';
        ctx.fillRect(x + 4, y + 13, 10, 8);       // fat rear tire
        ctx.fillRect(x + 32, y + 15, 7, 6);
        if (opts.smoke) {
            ctx.fillStyle = 'rgba(200,200,200,0.8)';
            for (var i = 0; i < 4; i++) ctx.fillRect(x - 6 - i * 7, y + 15 - (i % 2) * 3, 6, 5);
        }
    };

    // Starts a race on the canvas. player/rival: { spec, color, condition, skill (rival only) }.
    // done(result, damage) gets 'win', 'lose' or 'foul' and the engine damage the player did.
    L.startRace = function (canvas, button, player, rival, done) {
        var ctx = canvas.getContext('2d');
        var state = {
            clock: 0,                 // seconds since the tree started
            greenAt: 1.6 + L.random() * 0.8,
            phase: 'tree',            // tree, racing, finished
            me: { run: L.newRun(player.spec), launchedAt: null, finishAt: null, damage: 0, blown: false },
            them: {
                run: L.newRun(rival.spec), launchedAt: null, finishAt: null, blown: false,
                reaction: 0.2 + (1 - rival.skill) * (0.25 + L.random() * 0.3),
                shiftError: function () { return (1 - rival.skill) * (L.random() * 900 - 600); }
            },
            message: 'STAGE',
            foul: false,
            last: null,
            stopped: false
        };
        state.them.nextShiftAt = L.shiftRpm(rival.spec, 0) + state.them.shiftError();

        function press() {
            if (state.phase === 'tree') {
                if (state.clock < state.greenAt) { state.foul = true; finish(); return; }
            }
            if (state.phase !== 'racing' && state.phase !== 'tree') return;
            var me = state.me;
            if (me.launchedAt === null) {
                me.launchedAt = state.clock;
                state.phase = 'racing';
            } else if (!me.blown) {
                L.shift(player.spec, me.run);
            }
        }

        function onKey(e) {
            if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (!e.repeat) press();
            }
        }
        function onButton(e) { e.preventDefault(); press(); }

        document.addEventListener('keydown', onKey);
        button.addEventListener('pointerdown', onButton);

        function cleanup() {
            state.stopped = true;
            document.removeEventListener('keydown', onKey);
            button.removeEventListener('pointerdown', onButton);
        }

        function finish() {
            if (state.phase === 'finished') return;
            state.phase = 'finished';
            var me = state.me, them = state.them;
            var result;
            if (state.foul) result = 'foul';
            else if (me.blown || me.finishAt === null) result = 'lose';
            else if (them.blown || them.finishAt === null) result = 'win';
            else result = me.finishAt <= them.finishAt ? 'win' : 'lose';
            state.result = result;
            state.message = { win: 'YOU WIN!', lose: 'YOU LOSE', foul: 'RED LIGHT!' }[result];
            draw();
            setTimeout(function () { cleanup(); done(result, me.damage, summary()); }, 1800);
        }

        function summary() {
            var me = state.me, them = state.them;
            function line(who) {
                if (who.blown) return 'blew the engine';
                if (who.finishAt === null) return 'did not finish';
                return (who.finishAt - state.greenAt).toFixed(2) + ' s at ' + Math.round(L.mph(who.run.trap)) + ' mph';
            }
            return {
                me: state.foul ? 'jumped the light' : line(me),
                them: line(them),
                reaction: me.launchedAt === null ? null : (me.launchedAt - state.greenAt)
            };
        }

        function stepCar(car, spec, isRival, condition) {
            if (car.launchedAt === null || car.run.done || car.blown) return;
            if (isRival && car.run.shiftLeft <= 0 && car.run.rpm >= car.nextShiftAt) {
                if (L.shift(spec, car.run)) car.nextShiftAt = L.shiftRpm(spec, car.run.gear) + car.shiftError();
            }
            var damage = L.step(spec, car.run, DT);
            if (!isRival) {
                car.damage += damage;
                if (car.damage >= condition) car.blown = true;
            }
            if (car.run.done) car.finishAt = car.launchedAt + car.run.et;
        }

        function tick(dt) {
            state.clock += dt;
            var me = state.me, them = state.them;
            if (state.phase === 'tree' && state.clock >= state.greenAt) state.message = 'GO!';
            if (them.launchedAt === null && state.clock >= state.greenAt + them.reaction) them.launchedAt = state.clock;
            if (state.phase === 'racing' && state.clock > state.greenAt + 0.6) state.message = '';
            stepCar(me, player.spec, false, player.condition);
            stepCar(them, rival.spec, true);
            if (state.phase === 'racing') {
                var meOver = me.run.done || me.blown;
                var themOver = them.run.done || them.blown;
                // Done when both are over the line, or one is and the other is hopelessly behind
                if ((meOver && themOver) || state.clock - state.greenAt > 40 ||
                    (me.run.done && state.clock - me.finishAt > 1.5) || (them.run.done && state.clock - them.finishAt > 4)) {
                    finish();
                }
            }
            // Never launched: the rival is long gone
            if (state.phase === 'tree' && state.clock > state.greenAt + 5) finish();
        }

        function frame(now) {
            if (state.stopped || state.phase === 'finished') return;
            if (state.last === null) state.last = now;
            var elapsed = Math.min(0.1, (now - state.last) / 1000);
            state.last = now;
            var steps = Math.round(elapsed / DT);
            for (var i = 0; i < steps && state.phase !== 'finished'; i++) tick(DT);
            draw();
            requestAnimationFrame(frame);
        }

        function draw() {
            var me = state.me, them = state.them;
            var camX = me.run.x;
            var toScreen = function (x) { return 70 + (x - camX) * PX_PER_M; };

            // Sky and horizon
            ctx.fillStyle = '#0b0b1a';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#1c1c38';
            for (var b = 0; b < 8; b++) {
                var bx = ((b * 97 - camX * 0.4) % 400 + 400) % 400 - 40;
                ctx.fillRect(bx, 70 - (b % 3) * 8, 34, 20 + (b % 3) * 8);
            }

            // Road, lane lines moving past
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 90, W, 58);
            ctx.fillStyle = '#f4e9c8';
            ctx.fillRect(0, 90, W, 1);
            ctx.fillRect(0, 147, W, 1);
            ctx.fillStyle = '#ffd23f';
            var dashOffset = (camX * PX_PER_M) % 24;
            for (var dx = -dashOffset; dx < W; dx += 24) ctx.fillRect(dx, 118, 12, 2);

            // Start and finish lines
            var startX = toScreen(0) + 44;
            if (startX > -4 && startX < W) { ctx.fillStyle = '#f4e9c8'; ctx.fillRect(startX, 91, 2, 56); }
            var finishX = toScreen(L.QUARTER_MILE) + 44;
            if (finishX > -10 && finishX < W + 10) {
                for (var fy = 91; fy < 147; fy += 4) {
                    ctx.fillStyle = (fy / 4) % 2 ? '#fff' : '#111';
                    ctx.fillRect(finishX, fy, 4, 4);
                    ctx.fillStyle = (fy / 4) % 2 ? '#111' : '#fff';
                    ctx.fillRect(finishX + 4, fy, 4, 4);
                }
            }

            L.drawCar(ctx, toScreen(them.run.x), LANE_Y[0], rival.color, { smoke: them.run.spinning && them.run.v > 0 });
            L.drawCar(ctx, toScreen(me.run.x), LANE_Y[1], player.color, { smoke: (me.run.spinning && me.run.v > 0) || me.blown });

            drawTree();
            drawDash();

            if (state.message) {
                ctx.fillStyle = state.message === 'GO!' || state.message === 'YOU WIN!' ? '#3bff6e' : state.message === 'STAGE' ? '#ffd23f' : '#ff3b3b';
                ctx.font = 'bold 20px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(state.message, W / 2, 40);
            }
        }

        function drawTree() {
            if (state.clock > state.greenAt + 2) return;
            var x = 296, y = 10;
            ctx.fillStyle = '#111';
            ctx.fillRect(x - 6, y - 4, 16, 60);
            var ambersLit = Math.floor((state.clock - (state.greenAt - 1.5)) / 0.5);
            for (var i = 0; i < 3; i++) {
                ctx.fillStyle = state.clock < state.greenAt && ambersLit > i ? '#ffb000' : '#333';
                ctx.fillRect(x - 2, y + i * 12, 8, 8);
            }
            ctx.fillStyle = state.foul ? '#ff3b3b' : state.clock >= state.greenAt ? '#3bff6e' : '#333';
            ctx.fillRect(x - 2, y + 40, 8, 8);
        }

        function drawDash() {
            var me = state.me, spec = player.spec;
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 150, W, 50);

            // Tachometer: an arc from 0 to redline + 1000, redline in red
            var max = spec.redline + 1000;
            var cx = 40, cy = 192, r = 34;
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#444';
            ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke();
            ctx.strokeStyle = '#ff3b3b';
            ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI + Math.PI * spec.redline / max, 2 * Math.PI); ctx.stroke();
            var rpm = me.launchedAt === null ? (state.phase === 'tree' ? 1800 + Math.sin(state.clock * 30) * 200 : 900) : me.run.rpm;
            var a = Math.PI + Math.PI * Math.min(rpm, max) / max;
            ctx.strokeStyle = '#f4e9c8';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke();

            ctx.textAlign = 'left';
            ctx.font = '9px "Courier New", monospace';
            ctx.fillStyle = '#8a8aa8';
            ctx.fillText('RPM ' + Math.round(rpm / 100) * 100, 82, 162);
            ctx.fillText('GEAR', 82, 176);
            ctx.fillText('MPH', 82, 190);
            ctx.fillStyle = '#ffd23f';
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.fillText(me.run.shiftLeft > 0 ? '-' : String(me.run.gear + 1), 112, 177);
            ctx.fillText(String(Math.round(L.mph(me.run.v))), 112, 191);

            if (me.run.spinning && me.run.v > 0) { ctx.fillStyle = '#ff3b3b'; ctx.fillText('SPIN', 150, 177); }
            if (me.run.rpm > spec.redline && me.launchedAt !== null) { ctx.fillStyle = '#ff3b3b'; ctx.fillText('SHIFT!', 150, 191); }
            if (me.blown) { ctx.fillStyle = '#ff3b3b'; ctx.fillText('BLOWN!', 150, 163); }

            // Progress: both cars along the quarter mile
            var px = 200, pw = 112;
            ctx.fillStyle = '#333';
            ctx.fillRect(px, 168, pw, 2);
            ctx.fillRect(px, 184, pw, 2);
            ctx.fillStyle = rival.color;
            ctx.fillRect(px + Math.min(1, state.them.run.x / L.QUARTER_MILE) * (pw - 4), 165, 4, 8);
            ctx.fillStyle = player.color;
            ctx.fillRect(px + Math.min(1, me.run.x / L.QUARTER_MILE) * (pw - 4), 181, 4, 8);
            ctx.fillStyle = '#8a8aa8';
            ctx.font = '8px "Courier New", monospace';
            ctx.fillText('THEM', px, 162);
            ctx.fillText('YOU', px, 197);
        }

        draw();
        requestAnimationFrame(frame);
        return { stop: cleanup };
    };
})(window.Lemon = window.Lemon || {});

// The drag race: a Christmas tree start, then you shift by hand down a quarter mile.
// Space, Enter or the big button launches at green and shifts after that.
(function (L) {
    'use strict';

    var W = 320, H = 200;
    var DT = 1 / 120;
    var PX_PER_M = 2.2;
    var LANE_Y = [96, 122];      // rival lane, player lane (screen y of the car's roof)

    // Starts a race on the canvas. player/rival: { spec, color, condition, skill (rival only) }.
    // done(result, damage) gets 'win', 'lose' or 'foul' and the engine damage the player did.
    // A solo run has no rival (null) and opts.distance in m: 'win' is crossing the line, 'lose'
    // blowing the engine or never launching. opts.kids: the kids' garage's easy race, where
    // a press before green just waits, the car shifts itself and can't be hurt, and it goes
    // on its own a few seconds after green if nobody presses.
    L.startRace = function (canvas, button, player, rival, done, opts) {
        var ctx = canvas.getContext('2d');
        var solo = !rival;
        var kids = !!(opts && opts.kids);
        var dist = (opts && opts.distance) || L.QUARTER_MILE;
        if (solo) rival = { spec: player.spec, color: player.color, skill: 1 };     // a stand-in that never runs
        var state = {
            clock: 0,                 // seconds since the tree started
            greenAt: 1.6 + L.random() * 0.8,
            phase: 'tree',            // tree, racing, finished
            me: { run: L.newRun(player.spec, dist), launchedAt: null, finishAt: null, damage: 0, blown: false },
            them: {
                run: L.newRun(rival.spec, dist), launchedAt: null, finishAt: null, blown: false,
                reaction: 0.2 + (1 - rival.skill) * (0.25 + L.random() * 0.3),
                shiftError: function () { return (1 - rival.skill) * (L.random() * 900 - 600); }
            },
            message: kids ? 'GET READY' : 'STAGE',
            lastAmber: -1,
            greenBeeped: false,
            shiftBeeped: -1,
            rpmRate: 0,               // how fast your revs are climbing, rpm a second
            foul: false,
            last: null,
            stopped: false
        };
        state.them.nextShiftAt = L.shiftRpm(rival.spec, 0) + state.them.shiftError();
        if (kids) {         // the kids' car shifts itself, right on time
            state.me.auto = true;
            state.me.shiftError = function () { return 0; };
            state.me.nextShiftAt = L.shiftRpm(player.spec, 0);
        }

        function press() {
            if (state.phase === 'tree' && state.clock < state.greenAt) {
                if (kids) { state.message = 'WAIT FOR GREEN!'; return; }
                state.foul = true; finish(); return;
            }
            if (state.phase !== 'racing' && state.phase !== 'tree') return;
            var me = state.me;
            if (me.launchedAt === null) {
                me.launchedAt = state.clock;
                state.phase = 'racing';
                L.sound.launch();
            } else if (!kids && !me.blown && !me.run.done) {
                if (L.shift(player.spec, me.run)) L.sound.shift();
            }
        }

        function onKey(e) {
            if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (!e.repeat) press();
            }
        }
        function onButton(e) { e.preventDefault(); press(); }
        // Turning a phone sideways mid-race: the page is sized to fit the screen again (CSS,
        // body.racing), so bring the strip back to the top with the button under it
        function onTurn() { canvas.scrollIntoView({ block: 'start' }); }

        document.addEventListener('keydown', onKey);
        button.addEventListener('pointerdown', onButton);
        canvas.addEventListener('pointerdown', onButton);      // a tap on the strip works too
        window.addEventListener('resize', onTurn);
        document.body.classList.add('racing');
        L.sound.begin();        // the click that started the race lets the audio start
        L.sound.engineOn();

        function cleanup() {
            state.stopped = true;
            document.removeEventListener('keydown', onKey);
            button.removeEventListener('pointerdown', onButton);
            canvas.removeEventListener('pointerdown', onButton);
            window.removeEventListener('resize', onTurn);
            document.body.classList.remove('racing');
            L.sound.engineOff();
        }

        // The shift window for this gear, in rpm. A fast engine climbs through the last few
        // hundred rpm in a blink, and its best shift is often right at redline, so the window
        // opens a set time (SHIFT_LEAD) before the best point at the revs' current climb rate,
        // and the amber warning comes READY_LEAD before that. A shift a beat early costs little.
        var SHIFT_LEAD = 0.3, READY_LEAD = 0.4;
        function shiftWindow(gear) {
            var spec = player.spec;
            var best = Math.min(L.shiftRpm(spec, gear), spec.redline);
            var rate = Math.max(state.rpmRate, 0);
            var green = best - Math.max(150, rate * SHIFT_LEAD) * (1 + L.ZONE_PER_LEGEND * (spec.legends || 0));
            return { best: best, green: green, ready: green - Math.max(400, rate * READY_LEAD) };
        }

        // The shift light: off, 'ready' as the window nears, 'shift' in it, 'over' past
        // redline. Nothing in top gear but the redline warning.
        function shiftLight() {
            var me = state.me, spec = player.spec;
            if (me.launchedAt === null || me.blown || me.run.done || me.run.shiftLeft > 0) return null;
            if (me.run.rpm > spec.redline) return 'over';
            if (me.run.gear >= spec.gears.length - 1) return null;
            var w = shiftWindow(me.run.gear);
            if (me.run.rpm >= w.green) return 'shift';
            if (me.run.rpm >= w.ready) return 'ready';
            return null;
        }

        function sounds() {
            var me = state.me;
            // Start lights: a tick for each amber, a high beep for green
            var ambers = Math.floor((state.clock - (state.greenAt - 1.5)) / 0.5);
            if (state.phase === 'tree' && ambers >= 0 && ambers < 3 && ambers !== state.lastAmber) {
                state.lastAmber = ambers;
                L.sound.beep(440, 0.12);
            }
            if (!state.greenBeeped && state.clock >= state.greenAt && !state.foul) {
                state.greenBeeped = true;
                L.sound.beep(880, 0.3);
            }
            var light = kids ? null : shiftLight();
            if (light === 'shift' && state.shiftBeeped !== me.run.gear) {
                state.shiftBeeped = me.run.gear;
                L.sound.beep(1320, 0.1);
            }
            // Waiting at the tree: a lumpy idle with a blip of the throttle now and then
            var blip = Math.pow(Math.max(0, Math.sin(state.clock * 2.6)), 6);
            var rpm = me.launchedAt === null ? 1500 + Math.sin(state.clock * 30) * 120 + blip * 2600 : me.run.rpm;
            L.sound.engineAt(me.blown ? 0 : rpm, me.launchedAt === null ? 0.2 + 0.6 * blip : me.run.shiftLeft <= 0 && !me.run.done ? 1 : 0.2);
        }

        function finish() {
            if (state.phase === 'finished') return;
            state.phase = 'finished';
            var me = state.me, them = state.them;
            var result;
            if (state.foul) result = 'foul';
            else if (me.blown || me.finishAt === null) result = 'lose';
            else if (solo) result = 'win';
            else if (them.blown || them.finishAt === null) result = 'win';
            else result = me.finishAt <= them.finishAt ? 'win' : 'lose';
            state.result = result;
            state.message = solo ? { win: 'FINISH!', lose: me.blown ? 'BLOWN!' : 'NO TIME', foul: 'RED LIGHT!' }[result]
                : { win: 'YOU WIN!', lose: kids ? 'SO CLOSE!' : 'YOU LOSE', foul: 'RED LIGHT!' }[result];
            L.sound[result]();
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
                them: solo ? '' : line(them),
                reaction: me.launchedAt === null ? null : (me.launchedAt - state.greenAt),
                et: state.foul || me.blown || me.finishAt === null ? null : me.finishAt - state.greenAt
            };
        }

        function stepCar(car, spec, isRival, condition) {
            if (car.launchedAt === null || car.run.done || car.blown) return;
            if ((isRival || car.auto) && car.run.shiftLeft <= 0 && car.run.rpm >= car.nextShiftAt) {
                if (L.shift(spec, car.run)) {
                    car.nextShiftAt = L.shiftRpm(spec, car.run.gear) + car.shiftError();
                    if (car.auto) L.sound.shift();
                }
            }
            var damage = L.step(spec, car.run, DT);
            if (!isRival && !kids) {
                car.damage += damage;
                if (car.damage >= condition) { car.blown = true; L.sound.blow(); }
            }
            if (car.run.done) car.finishAt = car.launchedAt + car.run.et;
        }

        function tick(dt) {
            state.clock += dt;
            var me = state.me, them = state.them;
            if (state.phase === 'tree' && state.clock >= state.greenAt) state.message = 'GO!';
            if (kids && state.phase === 'tree' && state.clock > state.greenAt + 3) press();      // off it goes anyway
            if (!solo && them.launchedAt === null && state.clock >= state.greenAt + them.reaction) them.launchedAt = state.clock;
            if (state.phase === 'racing' && state.clock > state.greenAt + 0.6) state.message = '';
            // The kids' GO button is only green while a press does something: from green until launch
            if (kids) button.classList.toggle('ready', state.phase === 'tree' && state.clock >= state.greenAt);
            var before = me.run.rpm, gear = me.run.gear;
            stepCar(me, player.spec, false, player.condition);
            // Smooth the climb rate; a shift or the launch clutch resets it
            if (me.run.shiftLeft > 0 || me.run.gear !== gear || me.launchedAt === null) state.rpmRate = 0;
            else state.rpmRate += ((me.run.rpm - before) / dt - state.rpmRate) * 0.15;
            stepCar(them, rival.spec, true);
            if (state.phase === 'racing') {
                var meOver = me.run.done || me.blown;
                var themOver = solo || them.run.done || them.blown;
                // Done when both are over the line, or one is and the other is hopelessly behind
                if ((meOver && themOver) || state.clock - state.greenAt > (solo ? 120 : 40) ||
                    (me.run.done && state.clock - me.finishAt > 1.5) || (!solo && them.run.done && state.clock - them.finishAt > 4)) {
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
            sounds();
            draw();
            requestAnimationFrame(frame);
        }

        function draw() {
            var me = state.me, them = state.them;
            var camX = me.run.x;
            var toScreen = function (x) { return 70 + (x - camX) * PX_PER_M; };
            // A car's wheels turn with the distance it covers (a tire is about 4 pixels across
            // the middle), faster still while the tires spin; at most 0.9 rad a frame, so the
            // spokes still read as rolling forward at speed
            var spin = function (c) {
                var step = (c.run.x - (c.lastX || 0)) * PX_PER_M / 4 + (c.run.spinning && c.run.v > 0 ? 0.6 : 0);
                c.lastX = c.run.x;
                c.wheel = (c.wheel || 0) + Math.min(step, 0.9);
                return c.wheel;
            };

            // Sky and horizon
            ctx.fillStyle = '#0b0b1a';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#f4e9c8';                      // stars
            for (var si = 0; si < 30; si++) ctx.fillRect((si * 73 + 11) % W, (si * 29 + 5) % 60, 1, 1);
            for (var b = 0; b < 8; b++) {                   // the town behind the strip, lights on
                var bx = Math.round(((b * 97 - camX * 0.4) % 400 + 400) % 400 - 40);
                var by = 70 - (b % 3) * 8, bh = 20 + (b % 3) * 8;
                ctx.fillStyle = '#1c1c38';
                ctx.fillRect(bx, by, 34, bh);
                ctx.fillStyle = '#2a2a50';
                ctx.fillRect(bx, by, 34, 1);
                for (var wy = by + 4; wy < 86; wy += 6) {
                    for (var wx = bx + 4; wx < bx + 31; wx += 7) {
                        if ((wx * 7 + wy * 13 + b * 5) % 5 < 2) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(wx, wy, 3, 2); }
                    }
                }
            }
            ctx.fillStyle = '#121226';                      // grass verge
            ctx.fillRect(0, 86, W, 4);

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
            var finishX = toScreen(dist) + 44;
            if (finishX > -10 && finishX < W + 10) {
                for (var fy = 91; fy < 147; fy += 4) {
                    ctx.fillStyle = (fy / 4) % 2 ? '#fff' : '#111';
                    ctx.fillRect(finishX, fy, 4, 4);
                    ctx.fillStyle = (fy / 4) % 2 ? '#111' : '#fff';
                    ctx.fillRect(finishX + 4, fy, 4, 4);
                }
            }

            if (!solo) L.drawCar(ctx, toScreen(them.run.x), LANE_Y[0], rival.color, { smoke: them.run.spinning && them.run.v > 0, spin: spin(them) });
            L.drawCar(ctx, toScreen(me.run.x), LANE_Y[1], player.color, { smoke: (me.run.spinning && me.run.v > 0) || me.blown, spin: spin(me) });

            drawTree();
            drawDash();

            if (state.message) {
                L.text(ctx, state.message, W / 2, 40, {
                    color: state.message === 'GO!' || state.message === 'YOU WIN!' || state.message === 'FINISH!' ? '#3bff6e' : state.message === 'STAGE' || state.message === 'GET READY' || state.message === 'SO CLOSE!' ? '#ffd23f' : '#ff3b3b',
                    scale: 3, align: 'center'
                });
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
            // The shift window for this gear in green, with a tick at the best shift point
            if (me.run.gear < spec.gears.length - 1) {
                var w = shiftWindow(me.run.gear);
                ctx.strokeStyle = '#3bff6e';
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI + Math.PI * Math.max(0, w.green) / max, Math.PI + Math.PI * w.best / max); ctx.stroke();
                var sa = Math.PI + Math.PI * w.best / max;
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(cx + Math.cos(sa) * (r - 6), cy + Math.sin(sa) * (r - 6));
                ctx.lineTo(cx + Math.cos(sa) * (r + 3), cy + Math.sin(sa) * (r + 3)); ctx.stroke();
            }
            var a = Math.PI + Math.PI * Math.min(rpm, max) / max;
            ctx.strokeStyle = '#f4e9c8';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke();

            ctx.fillStyle = '#8a8aa8';
            L.text(ctx, 'RPM ' + Math.round(rpm / 100) * 100, 82, 162);
            L.text(ctx, 'GEAR', 82, 176);
            L.text(ctx, 'MPH', 82, 190);
            ctx.fillStyle = '#ffd23f';
            L.text(ctx, me.run.shiftLeft > 0 ? '-' : String(me.run.gear + 1), 112, 176);
            L.text(ctx, String(Math.round(L.mph(me.run.v))), 112, 190);

            // Shift light: amber when it's nearly time, green to shift now, flashing red past redline
            var light = kids ? null : shiftLight();
            var lamp = { ready: '#ffb000', shift: '#3bff6e', over: Math.floor(state.clock * 8) % 2 ? '#ff3b3b' : '#5a1010' }[light] || '#2a2a2a';
            ctx.fillStyle = lamp;
            ctx.fillRect(148, 153, 46, 14);
            ctx.fillStyle = light ? '#111' : '#555';
            L.text(ctx, kids ? 'AUTO' : 'SHIFT', 171, 164, { align: 'center' });
            if (me.run.spinning && me.run.v > 0) L.text(ctx, 'SPIN', 150, 181, { color: '#ff3b3b' });
            if (me.blown) L.text(ctx, 'BLOWN!', 150, 195, { color: '#ff3b3b' });

            // Progress: both cars along the quarter mile
            var px = 200, pw = 112;
            ctx.fillStyle = '#333';
            ctx.fillRect(px, 168, pw, 2);
            ctx.fillRect(px, 184, pw, 2);
            if (!solo) {
                ctx.fillStyle = L.lookColor(rival.color);
                ctx.fillRect(px + Math.min(1, state.them.run.x / dist) * (pw - 4), 165, 4, 8);
            }
            ctx.fillStyle = L.lookColor(player.color);
            ctx.fillRect(px + Math.min(1, me.run.x / dist) * (pw - 4), 181, 4, 8);
            ctx.fillStyle = '#8a8aa8';
            // Solo: the clock in place of the rival
            if (solo) L.text(ctx, me.launchedAt === null ? '0.00 S' : ((me.finishAt !== null ? me.finishAt : state.clock) - state.greenAt).toFixed(2) + ' S', px, 162, { color: '#ffd23f' });
            else L.text(ctx, 'THEM', px, 162);
            L.text(ctx, 'YOU', px, 197);
        }

        draw();
        requestAnimationFrame(frame);
        return { stop: cleanup };
    };
})(window.Lemon = window.Lemon || {});

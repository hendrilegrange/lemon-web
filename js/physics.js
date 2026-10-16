// Car performance: turns a car's parts into a spec, and steps a drag race in time.
// SI units inside (kg, m, s, N·m); lb-ft, hp and mph only for display.
(function (L) {
    'use strict';

    var LBFT_TO_NM = 1.3558;
    var G = 9.81;
    var AIR = 1.2;               // air density, kg/m³
    var ROLLING = 0.015;         // rolling resistance coefficient
    var DRIVELINE = 0.85;        // share of engine torque that reaches the tires
    var REAR_WEIGHT = 0.62;      // share of weight on the driven wheels under launch
    var TIRE_RADIUS = 0.33;      // m
    var SHIFT_TIME = 0.35;       // s with no drive while shifting
    var LAUNCH_RPM = 2400;       // clutch slips at this rpm until the wheels catch up
    var QUARTER = 402.34;        // m

    L.QUARTER_MILE = QUARTER;
    L.SHIFT_TIME = SHIFT_TIME;

    // What a part worn right out costs: torque for the bolt-ons, grip for bald tires, seconds
    // on every shift for a tired gearbox, power lost in a worn rear end
    var WORN = { bolt: 0.10, tires: 0.20, trans: 0.4, rear: 0.15 };

    // Spec: everything the race needs, worked out once from the car's parts
    L.spec = function (car) {
        var p = car.parts;
        var engine = L.PARTS[p.engine];
        var tqMul = 1, rpmAdd = 0, redAdd = 0;
        function cond(slot) { return L.partCondition(car, slot) / 100; }
        ['carb', 'intake', 'cam', 'exhaust'].forEach(function (slot) {
            var part = L.PARTS[p[slot]];
            tqMul *= (part.tq || 1) * (1 - WORN.bolt * (1 - cond(slot)));   // a worn part costs up to 10%
            rpmAdd += part.rpm || 0;
            redAdd += part.redline || 0;
        });
        // A worn engine makes less torque: 60% at worst
        var wear = 0.6 + 0.4 * (car.engineCondition / 100);
        var body = L.BODIES[car.body];
        var legends = L.SLOTS.filter(function (slot) { return L.PARTS[p[slot]].legend; }).length;
        var s = {
            tqNm: engine.tqLbft * tqMul * wear * LBFT_TO_NM,
            tqRpm: engine.tqRpm + rpmAdd,
            redline: engine.redline + redAdd,
            mass: body.kg + engine.kg + 75,   // plus the driver
            cdA: body.cdA,
            gears: L.PARTS[p.trans].gears,
            final: L.PARTS[p.rear].final,
            mu: L.PARTS[p.tires].mu * (1 - WORN.tires * (1 - cond('tires'))),        // bald tires slip
            shiftTime: SHIFT_TIME * (L.PARTS[p.trans].shift || 1) + WORN.trans * (1 - cond('trans')),   // a tired gearbox is slow to shift
            driveline: DRIVELINE * (L.PARTS[p.rear].drive || 1) * (1 - WORN.rear * (1 - cond('rear'))),   // a worn rear end eats power
            legends: legends     // Legendary parts on the car: each widens the green shift zone
        };
        s.rolling = ROLLING * Math.pow(0.72 / s.mu, 0.3);   // a better tire rolls truer
        s.launchRpm = Math.min(LAUNCH_RPM * Math.sqrt(s.mu / 0.72), Math.max(LAUNCH_RPM, s.tqRpm));   // and you can leave harder on it, up to peak torque
        var own = body.parts;   // the gearbox and rear end the car came with
        return gearing(s, options(p.trans, own.trans, 'gears'), options(p.rear, own.rear, 'final'), p.trans + '|' + p.rear + '|' + car.body);
    };

    // The ratios a gearbox or rear end can be set up with, and the car's own stock ones
    function options(id, stockId, key) {
        var list = (L.PARTS[id].options || [L.PARTS[id][key]]).slice();
        var stock = L.PARTS[stockId] && L.PARTS[stockId][key];
        if (stock && L.PARTS[id].cls > 0 && list.indexOf(stock) < 0) list.push(stock);
        return list;
    }

    // A gearbox or rear end with a choice of ratios (see data.js) runs whichever pair makes
    // this car's quarter mile quickest. Worked out once per car setup.
    var GEARING = {}, gearingCount = 0;
    function gearing(s, gearsets, finals, parts) {
        gearsets = gearsets || [s.gears];
        finals = finals || [s.final];
        if (gearsets.length < 2 && finals.length < 2) return s;
        var key = [parts, s.tqNm.toFixed(1), s.tqRpm, s.redline, s.mass, s.cdA, s.mu.toFixed(3), s.shiftTime.toFixed(3), s.driveline.toFixed(4)].join('|');
        var best = GEARING[key];
        if (!best) {
            // The part's own ratios first, then the rest, each run given up once it's slower
            best = { et: L.estimate(s).et, gears: s.gears, final: s.final };
            gearsets.forEach(function (gears) {
                finals.forEach(function (final) {
                    if (gears === s.gears && final === s.final) return;
                    var et = L.estimate(Object.assign({}, s, { gears: gears, final: final }), null, best.et).et;
                    if (et < best.et - 1e-9) best = { et: et, gears: gears, final: final };
                });
            });
            if (++gearingCount > 5000) { GEARING = {}; gearingCount = 0; }
            GEARING[key] = best;
        }
        s.gears = best.gears;
        s.final = best.final;
        return s;
    }

    // Torque at an rpm: a broad hump around tqRpm that falls away faster above it, and
    // collapses past redline as the valves float
    L.torqueAt = function (s, rpm) {
        var x = (rpm - s.tqRpm) / s.tqRpm;
        var shape = Math.max(0.3, x < 0 ? 1 - 0.35 * x * x : 1 - 1.2 * x * x);
        if (rpm > s.redline) shape *= Math.max(0, 1 - (rpm - s.redline) / 600);
        return s.tqNm * shape;
    };

    L.hpAt = function (s, rpm) {
        return L.torqueAt(s, rpm) / LBFT_TO_NM * rpm / 5252;
    };

    L.peakPower = function (s) {
        var best = { hp: 0, rpm: 0 };
        for (var rpm = 1000; rpm <= s.redline; rpm += 50) {
            var hp = L.hpAt(s, rpm);
            if (hp > best.hp) best = { hp: hp, rpm: rpm };
        }
        return best;
    };

    // The best rpm to shift out of a gear: where the next gear would push harder, or redline
    L.shiftRpm = function (s, gear) {
        var next = s.gears[gear + 1];
        if (!next) return s.redline;
        var ratio = next / s.gears[gear];
        for (var rpm = s.tqRpm; rpm < s.redline; rpm += 50) {
            if (L.torqueAt(s, rpm) < L.torqueAt(s, rpm * ratio) * ratio) return rpm;
        }
        return s.redline;
    };

    // A run down the strip: a quarter mile unless dist (m) says otherwise
    L.newRun = function (s, dist) {
        return { t: 0, x: 0, v: 0, gear: 0, rpm: LAUNCH_RPM, shiftLeft: 0, spinning: false, overRev: 0, done: false, dist: dist || QUARTER };
    };

    // Advance a run by dt seconds. Returns engine damage done (points of condition).
    L.step = function (s, run, dt) {
        run.t += dt;
        var ratio = s.gears[run.gear] * s.final;
        var wheelRpm = run.v / TIRE_RADIUS * 60 / (2 * Math.PI);
        var rpm = wheelRpm * ratio;
        var drive = 0;

        if (run.shiftLeft > 0) {
            run.shiftLeft -= dt;
            run.rpm = Math.max(rpm, 1000);
        } else {
            // Clutch slips in first gear until the wheels catch up with the launch rpm
            var launch = s.launchRpm || LAUNCH_RPM;
            if (run.gear === 0 && rpm < launch) rpm = launch;
            run.rpm = rpm;
            drive = L.torqueAt(s, rpm) * ratio * (s.driveline || DRIVELINE) / TIRE_RADIUS;
        }

        // More force than the tires can hold spins them, and a tire on the edge of spinning
        // grips less. The car gets what the tires hold and no more, never less, so more power
        // or more gear is never slower.
        var grip = s.mu * s.mass * G * REAR_WEIGHT;
        run.spinning = drive > grip;
        drive = Math.min(drive, grip * 0.9);

        var resist = 0.5 * AIR * s.cdA * run.v * run.v + (s.rolling || ROLLING) * s.mass * G;
        run.v = Math.max(0, run.v + (drive - resist) / s.mass * dt);
        run.x += run.v * dt;

        var damage = 0;
        if (run.rpm > s.redline) {
            run.overRev += dt;
            damage = (run.rpm - s.redline) / 100 * dt * 4;
        }
        if (run.x >= (run.dist || QUARTER) && !run.done) {
            run.done = true;
            run.et = run.t - (run.x - (run.dist || QUARTER)) / Math.max(run.v, 0.1);   // when it crossed the line, between steps
            run.trap = run.v;
        }
        return damage;
    };

    L.shift = function (s, run) {
        if (run.shiftLeft > 0 || run.gear >= s.gears.length - 1) return false;
        run.gear++;
        run.shiftLeft = s.shiftTime || SHIFT_TIME;
        return true;
    };

    // A whole quarter mile (or dist m) with perfect shifts: the garage's time slip. With a
    // limit (s), a run still going by then stops there, its et Infinity.
    L.estimate = function (s, dist, limit) {
        var run = L.newRun(s, dist);
        var dt = 1 / 120;
        var zeroSixty = null;
        var shiftAt = s.gears.map(function (g, i) { return L.shiftRpm(s, i); });
        while (!run.done && run.t < (limit ? limit + dt : 200)) {
            if (run.shiftLeft <= 0 && run.rpm >= shiftAt[run.gear]) L.shift(s, run);
            L.step(s, run, dt);
            if (zeroSixty === null && run.v >= 26.82) zeroSixty = run.t;
        }
        return { et: run.done || !limit ? run.et : Infinity, trapMph: L.mph(run.trap || 0), zeroSixty: zeroSixty };
    };

    L.mph = function (v) { return v * 2.23694; };
})(window.Lemon = window.Lemon || {});

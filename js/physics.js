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

    // Spec: everything the race needs, worked out once from the car's parts
    L.spec = function (car) {
        var p = car.parts;
        var engine = L.PARTS[p.engine];
        var tqMul = 1, rpmAdd = 0, redAdd = 0;
        ['carb', 'intake', 'cam', 'exhaust'].forEach(function (slot) {
            var part = L.PARTS[p[slot]];
            tqMul *= part.tq || 1;
            rpmAdd += part.rpm || 0;
            redAdd += part.redline || 0;
        });
        // A worn engine makes less torque: 60% at worst
        var wear = 0.6 + 0.4 * (car.engineCondition / 100);
        var body = L.BODIES[car.body];
        return {
            tqNm: engine.tqLbft * tqMul * wear * LBFT_TO_NM,
            tqRpm: engine.tqRpm + rpmAdd,
            redline: engine.redline + redAdd,
            mass: body.kg + engine.kg + 75,   // plus the driver
            cdA: body.cdA,
            gears: L.PARTS[p.trans].gears,
            final: L.PARTS[p.rear].final,
            mu: L.PARTS[p.tires].mu
        };
    };

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

    L.newRun = function (s) {
        return { t: 0, x: 0, v: 0, gear: 0, rpm: LAUNCH_RPM, shiftLeft: 0, spinning: false, overRev: 0, done: false };
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
            if (run.gear === 0 && rpm < LAUNCH_RPM) rpm = LAUNCH_RPM;
            run.rpm = rpm;
            drive = L.torqueAt(s, rpm) * ratio * DRIVELINE / TIRE_RADIUS;
        }

        // More force than the tires can hold spins them, and a spinning tire grips less
        var grip = s.mu * s.mass * G * REAR_WEIGHT;
        run.spinning = drive > grip;
        if (run.spinning) drive = grip * 0.9;

        var resist = 0.5 * AIR * s.cdA * run.v * run.v + ROLLING * s.mass * G;
        run.v = Math.max(0, run.v + (drive - resist) / s.mass * dt);
        run.x += run.v * dt;

        var damage = 0;
        if (run.rpm > s.redline) {
            run.overRev += dt;
            damage = (run.rpm - s.redline) / 100 * dt * 4;
        }
        if (run.x >= QUARTER && !run.done) {
            run.done = true;
            run.et = run.t;
            run.trap = run.v;
        }
        return damage;
    };

    L.shift = function (s, run) {
        if (run.shiftLeft > 0 || run.gear >= s.gears.length - 1) return false;
        run.gear++;
        run.shiftLeft = SHIFT_TIME;
        return true;
    };

    // A whole quarter mile with perfect shifts: the garage's time slip
    L.estimate = function (s) {
        var run = L.newRun(s);
        var dt = 1 / 120;
        var zeroSixty = null;
        while (!run.done && run.t < 60) {
            if (run.shiftLeft <= 0 && run.rpm >= L.shiftRpm(s, run.gear)) L.shift(s, run);
            L.step(s, run, dt);
            if (zeroSixty === null && run.v >= 26.82) zeroSixty = run.t;
        }
        return { et: run.et, trapMph: L.mph(run.trap || 0), zeroSixty: zeroSixty };
    };

    L.mph = function (v) { return v * 2.23694; };
})(window.Lemon = window.Lemon || {});

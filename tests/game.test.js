// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const L = require('./load.js');

function car(body, extra) {
    return { body, condition: 80, engineCondition: 100, parts: Object.assign({}, L.BODIES[body].parts, extra || {}) };
}

test('every car body and rival build uses real parts in the right slots', () => {
    for (const [id, body] of Object.entries(L.BODIES)) {
        for (const slot of L.SLOTS) {
            assert.ok(L.PARTS[body.parts[slot]], `${id} ${slot}`);
            assert.strictEqual(L.PARTS[body.parts[slot]].slot, slot, `${id} ${slot}`);
        }
    }
    L.RIVAL_BUILDS.forEach((build, tier) => {
        for (const [slot, id] of Object.entries(build)) assert.strictEqual(L.PARTS[id].slot, slot, `tier ${tier} ${slot}`);
    });
});

test('bolt-ons make a car quicker, and tougher rivals are quicker', () => {
    const stock = L.estimate(L.spec(car('ford48'))).et;
    const built = L.estimate(L.spec(car('ford48', { carb: 'carb_4bbl', exhaust: 'exhaust_hdr' }))).et;
    assert.ok(built < stock, `${built} < ${stock}`);
    let last = Infinity;
    L.RIVAL_BUILDS.forEach((build, tier) => {
        const et = L.estimate(L.spec(car('ford50', build))).et;
        assert.ok(et < last, `tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

test('quarter-mile times stay in a believable range', () => {
    const slow = L.estimate(L.spec(car('merc49'))).et;
    const fast = L.estimate(L.spec(car('ford48', { engine: 'v8_427', carb: 'carb_six', intake: 'intake_hi', cam: 'cam_race', exhaust: 'exhaust_open', trans: 'trans_4cr', rear: 'rear_456', tires: 'tires_cheat' }))).et;
    assert.ok(slow > 18 && slow < 22, `stock Merc ${slow}`);
    assert.ok(fast > 11 && fast < 14, `full build ${fast}`);
});

test('a worn engine is slower', () => {
    const fresh = car('chevy57');
    const worn = Object.assign(car('chevy57'), { engineCondition: 30 });
    assert.ok(L.estimate(L.spec(worn)).et > L.estimate(L.spec(fresh)).et);
});

test('over-revving damages the engine', () => {
    const s = L.spec(car('ford48'));
    const run = L.newRun(s);
    let damage = 0;
    for (let i = 0; i < 120 * 6; i++) damage += L.step(s, run, 1 / 120);   // never shifts
    assert.ok(run.overRev > 0 && damage > 0);
});

test('buying a car, a part, installing it and selling the old one', () => {
    const g = L.newGame();
    g.cash = 2000;
    g.ads[0] = { body: 'ford48', condition: 60, engineCondition: 80, price: 500, note: '' };
    assert.strictEqual(L.buyAd(g, 0), null);
    assert.strictEqual(g.cash, 1500);
    assert.strictEqual(L.activeCar(g).body, 'ford48');

    assert.strictEqual(L.buyPart(g, 'carb_dual'), null);
    assert.match(L.installPart(g, 0), /needs/);                 // dual quads need the high-rise
    assert.strictEqual(L.buyPart(g, 'intake_hi'), null);
    assert.strictEqual(L.installPart(g, 1), null);
    assert.strictEqual(L.installPart(g, 0), null);
    assert.strictEqual(L.activeCar(g).parts.carb, 'carb_dual');
    assert.deepStrictEqual(g.inventory, []);                    // stock parts are binned

    assert.strictEqual(L.buyPart(g, 'intake_alu'), null);
    assert.match(L.installPart(g, 0), /single carb/);           // can't pull the intake under dual quads
});

test("can't buy what you can't afford or park", () => {
    const g = L.newGame();
    g.cash = 10;
    assert.ok(L.buyPart(g, 'v8_427'));
    g.cash = 100000;
    for (let i = 0; i < L.MAX_CARS; i++) g.cars.push(L.makeCar(g, 'ford50', null, 50, 50));
    g.ads[0] = { body: 'ford48', condition: 60, engineCondition: 80, price: 500, note: '' };
    assert.match(L.buyAd(g, 0), /full/);
});

test('settling races: $1,000 cash races and pink slips', () => {
    const g = L.newGame();
    g.cash = 2000;
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 90));
    g.active = 0;
    g.rivals = [{ name: 'A', tier: 1, skill: 0.5, body: 'ford50', engineCondition: 90 },
                { name: 'B', tier: 1, skill: 0.5, body: 'merc49', engineCondition: 90 },
                { name: 'C', tier: 1, skill: 0.5, body: 'chevy55', engineCondition: 90 }];
    L.settleRace(g, 0, 'cash', 'win', 5);
    assert.strictEqual(g.cash, 3000);
    assert.strictEqual(L.activeCar(g).engineCondition, 85);
    L.settleRace(g, 0, 'pinks', 'win', 0);
    assert.strictEqual(g.cash, 4000);                         // pinks pay the cash too
    assert.strictEqual(g.cars.length, 2);
    assert.strictEqual(g.cars[1].body, 'merc49');
    L.settleRace(g, 0, 'pinks', 'foul', 0);
    assert.strictEqual(g.cars.length, 1);
    assert.strictEqual(g.cars[0].body, 'merc49');
    assert.strictEqual(g.cash, 4000);
    assert.strictEqual(g.wins, 2);
    assert.strictEqual(g.losses, 1);
    g.cash = 999;
    assert.match(L.canRace(g, { tier: 1 }, 'cash'), /\$1,000/);
});

test('The King turns up after enough wins, races only for pinks, and pays $10,000 and his car', () => {
    const g = L.newGame();
    assert.ok(!g.rivals.some((r) => r.king));
    g.wins = L.KING_WINS;
    L.newWeek(g);
    const i = g.rivals.findIndex((r) => r.king);
    assert.ok(i >= 0);
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 90));
    g.active = 0;
    assert.match(L.canRace(g, g.rivals[i], 'cash'), /pink/);
    assert.match(L.canRace(g, g.rivals[i], 'fun'), /pink/);
    const cash = g.cash;
    assert.match(L.settleRace(g, i, 'pinks', 'win', 0), /King of the strip/);
    assert.strictEqual(g.cash, cash + L.KING_PRIZE);
    assert.strictEqual(g.cars[1].parts.engine, 'v8_427');
    assert.ok(g.kingBeaten);
    L.newWeek(g);
    assert.ok(!g.rivals.some((r) => r.king));
});

test('a blown engine stops you racing until it is rebuilt', () => {
    const g = L.newGame();
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 0));
    g.active = 0;
    const rival = { tier: 0 };
    assert.match(L.canRace(g, rival, 'fun'), /blown/);
    assert.strictEqual(L.repair(g), null);
    assert.strictEqual(L.canRace(g, rival, 'fun'), null);
});

test('every slot and the rebuild have a wrenching job with up to 8 bolts, spaced to click', () => {
    for (const job of [...L.SLOTS, 'rebuild']) {
        const bolts = L.WRENCH[job] && L.WRENCH[job].bolts;
        assert.ok(bolts, job);
        assert.ok(bolts.length <= 8, `${job} has ${bolts.length} bolts`);
        assert.ok(bolts.some((b) => !b[2]), `${job} has a bolt to take out`);
        bolts.forEach((a, i) => bolts.slice(i + 1).forEach((b) => {
            assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= 20, `${job}: bolts at ${a} and ${b} are too close`);
        }));
    }
});

test('install and rebuild checks match what installing and rebuilding do', () => {
    const g = L.newGame();
    g.cash = 5000;
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 40));
    g.active = 0;
    L.buyPart(g, 'carb_dual');
    assert.match(L.canInstall(g, 0), /needs/);
    assert.strictEqual(L.canRepair(g), null);
    assert.strictEqual(L.repair(g), null);
    assert.match(L.canRepair(g), /top shape/);
});

test('fixing a worn car: repair, replace a shot part, and the budget adds up', () => {
    const g = L.newGame();
    g.cash = 5000;
    g.cars.push(L.makeCar(g, 'ford48', { carb: 'carb_4bbl' }, 40, 50, { carb: 10, intake: 60, cam: 100, exhaust: 96, trans: 40, rear: 70, tires: 30 }));
    g.active = 0;
    const d = Object.fromEntries(L.diagnose(L.activeCar(g)).map((x) => [x.slot, x]));
    assert.strictEqual(d.engine.action, 'repair');
    assert.strictEqual(d.carb.action, 'replace');            // shot
    assert.strictEqual(d.carb.fresh, L.PARTS.carb_4bbl.price);
    assert.strictEqual(d.intake.action, 'repair');
    assert.strictEqual(d.cam.action, 'ok');
    assert.strictEqual(d.tires.action, 'replace');            // tires are replaced, never repaired
    const slow = L.estimate(L.spec(L.activeCar(g))).et;

    const total = L.fixAllCost(L.activeCar(g));
    const cash = g.cash;
    assert.match(L.repairPart(g, 'carb'), /past fixing/);
    assert.strictEqual(L.replacePart(g, 'carb', 'junk'), null);
    assert.strictEqual(L.activeCar(g).parts.carb, 'carb_stock');
    assert.strictEqual(L.partCondition(L.activeCar(g), 'carb'), L.JUNK_CONDITION);
    for (const slot of ['engine', 'intake', 'trans', 'rear']) assert.strictEqual(L.repairPart(g, slot), null, slot);
    assert.strictEqual(L.replacePart(g, 'tires', 'junk'), null);
    assert.strictEqual(g.cash, cash - total);
    assert.ok(L.estimate(L.spec(L.activeCar(g))).et < slow);
    assert.ok(L.diagnose(L.activeCar(g)).every((x) => x.action === 'ok' || x.slot === 'carb'));
});

test('a junk intake will not go under dual quads', () => {
    const g = L.newGame();
    g.cash = 5000;
    g.cars.push(L.makeCar(g, 'ford48', { carb: 'carb_dual', intake: 'intake_hi' }, 40, 80, { intake: 5 }));
    g.active = 0;
    assert.match(L.replacePart(g, 'intake', 'junk'), /high-rise/);
    assert.strictEqual(L.replacePart(g, 'intake', 'new'), null);
    assert.strictEqual(L.partCondition(L.activeCar(g), 'intake'), 100);
});

test('the first week has only starter rivals, and always a cheap car for sale', () => {
    for (let i = 0; i < 200; i++) {
        const g = L.newGame();
        assert.ok(g.rivals.length === 3 && g.rivals.every((r) => r.tier === 0 && !r.king));
        assert.ok(g.ads.some((ad) => ad.price <= 200));
    }
});

test('a race for fun costs nothing to lose, pays a prize by tier, and only once a week per rival', () => {
    const g = L.newGame();
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 90));
    g.active = 0;
    g.cash = 0;
    const rivals = g.rivals.length;
    assert.strictEqual(L.canRace(g, g.rivals[0], 'fun'), null);
    assert.match(L.settleRace(g, 0, 'fun', 'win', 0), /\$50/);
    assert.strictEqual(g.cash, L.FUN_PRIZE[0]);
    assert.match(L.canRace(g, g.rivals[0], 'fun'), /enough fun/);
    L.settleRace(g, 1, 'fun', 'lose', 0);
    assert.strictEqual(g.cash, L.FUN_PRIZE[0]);
    assert.strictEqual(g.rivals.length, rivals);              // they stay for a real race
    assert.deepStrictEqual([g.wins, g.losses], [1, 1]);
    assert.deepStrictEqual(L.FUN_PRIZE.slice(0, 4), [50, 100, 100, 200]);
});

test('odds favour the quicker car', () => {
    const g = L.newGame();
    const rival = { tier: 2, skill: 0.5, body: 'chevy57', engineCondition: 90 };
    const junk = L.makeCar(g, 'ford48', null, 30, 40, { tires: 30, trans: 30 });
    const built = L.makeCar(g, 'ford48', { engine: 'v8_427', carb: 'carb_six', intake: 'intake_hi', cam: 'cam_race', exhaust: 'exhaust_open', trans: 'trans_4cr', rear: 'rear_456', tires: 'tires_cheat' }, 90, 100);
    assert.ok(L.odds(junk, rival) < 0.1);
    assert.ok(L.odds(built, rival) > 0.9);
});

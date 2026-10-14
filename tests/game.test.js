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

test('settling races: cash bets and pink slips', () => {
    const g = L.newGame();
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 90));
    g.active = 0;
    g.rivals = [{ name: 'A', tier: 1, skill: 0.5, body: 'ford50', bet: 100, pinks: true, engineCondition: 90 },
                { name: 'B', tier: 1, skill: 0.5, body: 'merc49', bet: 100, pinks: true, engineCondition: 90 },
                { name: 'C', tier: 1, skill: 0.5, body: 'chevy55', bet: 100, pinks: true, engineCondition: 90 }];
    const cash = g.cash;
    L.settleRace(g, 0, false, 'win', 5);
    assert.strictEqual(g.cash, cash + 100);
    assert.strictEqual(L.activeCar(g).engineCondition, 85);
    L.settleRace(g, 0, true, 'win', 0);
    assert.strictEqual(g.cars.length, 2);
    assert.strictEqual(g.cars[1].body, 'merc49');
    L.settleRace(g, 0, true, 'foul', 0);
    assert.strictEqual(g.cars.length, 1);
    assert.strictEqual(g.cars[0].body, 'merc49');
    assert.strictEqual(g.wins, 2);
    assert.strictEqual(g.losses, 1);
});

test('a blown engine stops you racing until it is rebuilt', () => {
    const g = L.newGame();
    g.cars.push(L.makeCar(g, 'ford48', null, 60, 0));
    g.active = 0;
    const rival = { bet: 10 };
    assert.match(L.canRace(g, rival, false), /blown/);
    assert.strictEqual(L.repair(g), null);
    assert.strictEqual(L.canRace(g, rival, false), null);
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

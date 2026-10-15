// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const L = require('./load.js');

function car(body, extra) {
    return { body, condition: 80, engineCondition: 100, parts: Object.assign({}, L.BODIES[body].parts, extra || {}) };
}

// A full Bestest build on a big-block
const FULL = L.stockParts('v8_427', { carb: 3, intake: 3, cam: 3, exhaust: 3, trans: 3, rear: 3, tires: 3 });

// A game with one car, plenty of money, every part in stock, and a fresh week
function garage(body, parts, condition, engineCondition, partCondition) {
    const g = L.newGame();
    g.cash = 5000;
    g.shopStock = Object.keys(L.PARTS).filter((id) => L.PARTS[id].price > 0);
    g.cars.push(L.makeCar(g, body, parts, condition, engineCondition, partCondition));
    g.active = 0;
    return g;
}

test('every car body and rival build uses real parts in the right slots, and they fit', () => {
    const builds = Object.keys(L.BODIES).map((id) => [id, L.BODIES[id].parts]);
    L.ERA_BUILDS.forEach((list, era) => list.forEach((b, tier) => builds.push(['era ' + era + ' tier ' + tier, L.rivalParts('ford48', tier, era)])));
    for (const id of Object.keys(L.BODIES)) {
        const era = L.BODIES[id].era;
        assert.ok(L.SLOTS.every((slot) => L.PARTS[L.BODIES[id].parts[slot]].era === era), id + ' comes with its own era\'s parts');
    }
    for (const [name, parts] of builds) {
        for (const slot of L.SLOTS) {
            assert.ok(L.PARTS[parts[slot]], `${name} ${slot}`);
            assert.strictEqual(L.PARTS[parts[slot]].slot, slot, `${name} ${slot}`);
            assert.ok(L.fits(parts[slot], parts.engine), `${name} ${slot} fits`);
        }
    }
});

test('every slot has six classes, priced up from free stock', () => {
    for (const fam of Object.keys(L.FAMILIES)) {
        for (const slot of L.BOLT_ONS) {
            const prices = [0, 1, 2, 3, 4, 5].map((c) => L.PARTS[`${slot}_${fam}_${c}`].price);
            assert.strictEqual(prices[0], 0);
            assert.ok(prices.every((x, i) => i === 0 || x > prices[i - 1]), `${slot} ${fam} ${prices}`);
        }
    }
    for (const slot of ['trans', 'rear', 'tires']) assert.ok(L.PARTS[slot + '_5'] && L.PARTS[slot + '_0'].price === 0);
    assert.strictEqual(L.CLASSES.join(), 'Stock,Better,Best,Bestest,Bestest+,Legendary');
});

test('better classes make a car quicker, and tougher rivals are quicker', () => {
    const stock = L.estimate(L.spec(car('ford48'))).et;
    const built = L.estimate(L.spec(car('ford48', { carb: 'carb_flat_1', exhaust: 'exhaust_flat_1' }))).et;
    assert.ok(built < stock, `${built} < ${stock}`);
    let last = Infinity;
    L.RIVAL_BUILDS.forEach((b, tier) => {
        const et = L.estimate(L.spec(car('ford50', L.rivalParts('ford50', tier)))).et;
        assert.ok(et < last, `tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

test('quarter-mile times stay in a believable range', () => {
    const slow = L.estimate(L.spec(car('merc49'))).et;
    const fast = L.estimate(L.spec(car('ford48', FULL))).et;
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

test('the speed shop shows every family\'s parts, marks what fits, and only sells what it has in stock', () => {
    const g = garage('ford48', null, 80, 80);
    const fits = Object.fromEntries(L.catalogFor(g, L.activeCar(g)).map((x) => [x.id, x.fits]));
    assert.ok(fits.carb_flat_2 && fits.tires_3 && fits.v8_327 && fits.ardun296);
    assert.strictEqual(fits.carb_small_2, false, 'a small-block carb is for sale but does not fit a flathead');
    g.shopStock = ['carb_flat_1'];
    assert.match(L.buyPart(g, 'carb_flat_2'), /Sold out/);
    assert.strictEqual(L.buyPart(g, 'carb_flat_1'), null);
    assert.match(L.buyPart(g, 'carb_flat_1'), /Sold out/);   // one on the shelf
});

test('every engine family has three upgrade engines', () => {
    Object.keys(L.FAMILIES).forEach((fam) => {
        const classes = Object.values(L.PARTS).filter((p) => p.slot === 'engine' && p.fam === fam && p.price > 0).map((p) => p.cls).sort();
        assert.deepStrictEqual(classes, [1, 2, 3, 4, 5], fam);
    });
});

test('every week the shop has something for every engine family so far in every slot, but not everything', () => {
    L.ERAS.forEach((e, era) => {
        const g = L.newGame();
        g.era = era;
        const all = Object.keys(L.PARTS).filter((id) => L.PARTS[id].price > 0 && L.PARTS[id].era <= era);
        for (let w = 0; w < 300; w++) {
            L.newWeek(g);
            assert.ok(g.shopStock.every((id) => L.PARTS[id].era <= era), 'no parts from eras still to come');
            Object.keys(L.FAMILIES).filter((fam) => L.FAMILIES[fam].era <= era).forEach((fam) => ['engine'].concat(L.BOLT_ONS).forEach((slot) => {
                assert.ok(g.shopStock.some((id) => L.PARTS[id].slot === slot && L.PARTS[id].fam === fam), 'week ' + w + ': no ' + fam + ' ' + slot);
            }));
            ['trans', 'rear', 'tires'].forEach((slot) => assert.ok(g.shopStock.some((id) => L.PARTS[id].slot === slot), slot));
            assert.ok(g.shopStock.length < all.length, 'some parts sell out');
        }
    });
});

test('the stock rotates weekly and the better classes are scarcer', () => {
    const count = [0, 0, 0, 0];
    const g = L.newGame();
    for (let w = 0; w < 200; w++) {
        L.newWeek(g);
        g.shopStock.forEach((id) => count[L.PARTS[id].cls]++);
    }
    assert.ok(count[1] > count[2] && count[2] > count[3], count.join());
});

test('installing parts takes hours, and an engine swap brings its own bolt-ons', () => {
    const g = garage('ford48', { carb: 'carb_flat_2' }, 80, 60);
    L.buyPart(g, 'tires_2');
    assert.strictEqual(L.installPart(g, 0), null);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - L.JOB_HOURS.tires);
    assert.deepStrictEqual(g.inventory, ['tires_0']);         // the old stock tires go on the shelf
    const cash = g.cash;
    L.sellPart(g, 0);                                          // and sell for half their junkyard price
    assert.strictEqual(g.cash - cash, L.WEAR.tires.junk / 2);
    assert.deepStrictEqual(g.inventory, []);

    L.buyPart(g, 'carb_small_1');
    assert.match(L.installPart(g, 0), /small-block/);          // doesn't fit the flathead
    L.buyPart(g, 'v8_327');
    assert.strictEqual(L.installPart(g, 1), null);
    const c = L.activeCar(g);
    assert.strictEqual(c.parts.engine, 'v8_327');
    assert.strictEqual(c.parts.carb, 'carb_small_0');
    assert.strictEqual(c.engineCondition, 100);
    assert.ok(g.inventory.includes('carb_flat_2'), 'the old flathead dual quads go on the shelf');
    assert.strictEqual(L.installPart(g, 0), null);             // now the small-block carb fits
    assert.strictEqual(c.parts.carb, 'carb_small_1');
});

test('the week runs out of hours, and Friday night closes the garage', () => {
    const g = garage('ford48', null, 80, 10);
    g.hours = L.REBUILD_HOURS - 1;
    assert.match(L.repair(g), /hours/);
    g.hours = L.HOURS_PER_WEEK;
    L.goFriday(g);
    assert.match(L.repair(g), /Friday/);
    L.newWeek(g);
    assert.strictEqual(L.repair(g), null);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - L.REBUILD_HOURS);
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

test('buying a car from the classifieds', () => {
    const g = L.newGame();
    g.ads[0] = { body: 'ford48', condition: 60, engineCondition: 80, price: 500, note: '' };
    assert.strictEqual(L.buyAd(g, 0), null);
    assert.strictEqual(g.cash, L.START_CASH - 500);
    assert.strictEqual(L.activeCar(g).body, 'ford48');
});

test('settling races: cash races bet your cash up to $1,000, pink slips are for the cars, and every race wears the car', () => {
    const g = garage('ford48', null, 90, 90);
    g.cash = 2000;
    L.goFriday(g);
    g.rivals = [{ name: 'A', tier: 1, skill: 0.5, body: 'ford50', engineCondition: 90 },
                { name: 'B', tier: 1, skill: 0.5, body: 'merc49', engineCondition: 90 },
                { name: 'C', tier: 1, skill: 0.5, body: 'chevy55', engineCondition: 90 },
                { name: 'D', tier: 1, skill: 0.5, body: 'chevy55', engineCondition: 90 }];
    assert.strictEqual(L.cashBet(g), 1000);                   // capped at $1,000
    L.settleRace(g, 0, 'cash', 'win', 5);
    assert.strictEqual(g.cash, 3000);
    const c = L.activeCar(g);
    assert.strictEqual(c.engineCondition, 85);
    assert.ok(c.condition < 90 && c.condition >= 87, 'the body wears a little');
    assert.ok(L.partCondition(c, 'tires') <= 98);
    L.settleRace(g, 0, 'pinks', 'win', 0);
    assert.strictEqual(g.cash, 3000);                         // pinks are for the cars only
    assert.strictEqual(g.cars.length, 2);
    assert.strictEqual(g.cars[1].body, 'merc49');
    L.settleRace(g, 0, 'pinks', 'foul', 0);
    assert.strictEqual(g.cars.length, 1);
    assert.strictEqual(g.cars[0].body, 'merc49');
    assert.strictEqual(g.cash, 3000);
    g.cash = 400;                                             // under $1,000, you bet it all
    assert.strictEqual(L.cashBet(g), 400);
    L.settleRace(g, 0, 'cash', 'lose', 0);
    assert.strictEqual(g.cash, 0);
    assert.deepStrictEqual([g.wins, g.losses], [2, 2]);
    g.cash = L.MIN_BET - 1;
    assert.match(L.canRace(g, { tier: 1 }, 'cash'), /at least/);
});

test('a week of classifieds has five different cars', () => {
    for (let i = 0; i < 20; i++) {
        const g = L.newGame();
        assert.strictEqual(new Set(g.ads.map((ad) => ad.body)).size, 5);
    }
});

test('restoring a cheap flathead car in fair shape pays too', () => {
    let profit = 0;
    for (let i = 0; i < 200; i++) {
        profit += L.potential({ body: 'ford48', condition: 40, engineCondition: 55, parts: {}, price: 280 }).margin;
    }
    assert.ok(profit / 200 > 0, 'a $280 Ford restores at a profit: ' + profit / 200);
});

test('a restored car sells for more than it cost to buy and fix, and a car bought as is sells for less', () => {
    let profit = 0, dump = 0, n = 0;
    for (let i = 0; i < 30; i++) {
        const g = L.newGame();
        g.ads.forEach((ad) => {
            const car = L.makeCar(g, ad.body, null, ad.condition, ad.engineCondition, ad.parts);
            profit += L.restoredValue(car) - ad.price - L.fixAll(car).cost;
            dump += L.carValue(car) - ad.price;
            n++;
        });
    }
    assert.ok(profit / n > 100, 'restoring pays on average: ' + profit / n);
    assert.ok(dump / n < 0, 'flipping without work loses: ' + dump / n);
});

test('stripping a car shelves its speed parts as they are, scraps the shell and takes hours', () => {
    const g = garage('chevy57', null, 50, 70);
    const car = L.activeCar(g);
    car.parts.tires = 'tires_2';
    car.partCondition.tires = 60;
    car.partCondition.carb = 10;                              // shot: binned
    const cash = g.cash;
    const scrap = L.stripValue(car);
    const line = L.stripCar(g, 0);
    assert.match(line, /scrap/);
    assert.strictEqual(g.cars.length, 0);
    assert.strictEqual(g.active, -1);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - L.STRIP_HOURS);
    assert.strictEqual(g.cash, cash + scrap);
    const t = g.inventory.indexOf('tires_2');
    assert.ok(t >= 0 && L.shelfCondition(g, t) === 60, 'worn parts keep their wear');
    assert.ok(g.inventory.includes('v8_283'), 'the engine is kept');
    assert.strictEqual(L.partValue(g, t), Math.floor(L.PARTS.tires_2.price / 2 * 0.6));
});

test('the body has to be at least 75% to race, and bodywork costs money and hours', () => {
    const g = garage('ford48', null, 40, 90);
    const rival = { tier: 0 };
    assert.match(L.canRace(g, rival, 'fun'), /75%/);
    const patch = L.bodyJob(L.activeCar(g), L.MIN_BODY);
    const full = L.bodyJob(L.activeCar(g), 100);
    assert.ok(patch.cost < full.cost && patch.hours < full.hours && patch.spots <= 8 && full.spots <= 8);
    const cash = g.cash;
    assert.strictEqual(L.bodywork(g, L.MIN_BODY), null);
    assert.strictEqual(L.activeCar(g).condition, L.MIN_BODY);
    assert.strictEqual(g.cash, cash - patch.cost);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - patch.hours);
    assert.strictEqual(L.canRace(g, rival, 'fun'), null);
});

test('The King turns up after enough wins, races only for pinks, and pays $10,000 and his car', () => {
    const g = garage('ford48', null, 90, 90);
    assert.ok(!g.rivals.some((r) => r.king));
    g.wins = L.KING_WINS;
    L.newWeek(g);
    const i = g.rivals.findIndex((r) => r.king);
    assert.ok(i >= 0);
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
    const g = garage('ford48', null, 80, 0);
    const rival = { tier: 0 };
    assert.match(L.canRace(g, rival, 'fun'), /blown/);
    assert.strictEqual(L.repair(g), null);
    assert.strictEqual(L.canRace(g, rival, 'fun'), null);
});

test('fixing a worn car: repair, replace a shot part, and the budget adds up', () => {
    const g = garage('ford48', { carb: 'carb_flat_1' }, 40, 50, { carb: 10, intake: 60, cam: 100, exhaust: 96, trans: 40, rear: 70, tires: 30 });
    g.hours = 100;
    const d = Object.fromEntries(L.diagnose(L.activeCar(g)).map((x) => [x.slot, x]));
    assert.strictEqual(d.engine.action, 'repair');
    assert.strictEqual(d.carb.action, 'replace');            // shot
    assert.strictEqual(d.carb.fresh, L.PARTS.carb_flat_1.price);
    assert.strictEqual(d.intake.action, 'repair');
    assert.strictEqual(d.cam.action, 'ok');
    assert.strictEqual(d.tires.action, 'replace');            // tires are replaced, never repaired
    const slow = L.estimate(L.spec(L.activeCar(g))).et;

    const total = L.fixAll(L.activeCar(g));
    const cash = g.cash;
    assert.match(L.repairPart(g, 'carb'), /past fixing/);
    assert.strictEqual(L.replacePart(g, 'carb', 'junk'), null);
    assert.strictEqual(L.activeCar(g).parts.carb, 'carb_flat_0');
    assert.strictEqual(L.partCondition(L.activeCar(g), 'carb'), L.JUNK_CONDITION);
    for (const slot of ['engine', 'intake', 'trans', 'rear']) assert.strictEqual(L.repairPart(g, slot), null, slot);
    assert.strictEqual(L.replacePart(g, 'tires', 'junk'), null);
    assert.strictEqual(L.bodywork(g, 100), null);
    assert.strictEqual(g.cash, cash - total.cost);
    assert.strictEqual(g.hours, 100 - total.hours);
    assert.ok(L.estimate(L.spec(L.activeCar(g))).et < slow);
    assert.ok(L.diagnose(L.activeCar(g)).every((x) => x.action === 'ok' || x.slot === 'carb'));
});

test('a new replacement has to be in stock this week', () => {
    const g = garage('ford48', { intake: 'intake_flat_2' }, 80, 80, { intake: 5 });
    g.shopStock = [];
    assert.match(L.replacePart(g, 'intake', 'new'), /out of those/);
    g.shopStock = ['intake_flat_2'];
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
    const g = garage('ford48', null, 90, 90);
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
    const built = L.makeCar(g, 'ford48', FULL, 90, 100);
    assert.ok(L.odds(junk, rival) < 0.1);
    assert.ok(L.odds(built, rival) > 0.9);
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

test('bodywork rust spots stay on the body and far enough apart to click', () => {
    for (let n = 1; n <= 8; n++) {
        const spots = L.rustSpots(n);
        assert.strictEqual(spots.length, n);
        spots.forEach((a, i) => {
            assert.ok(a.x >= 50 && a.x <= 270 && a.y >= 95 && a.y <= 135, `${a.x},${a.y}`);
            spots.slice(i + 1).forEach((b) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 20));
        });
    }
});

test('the pixel font has every character the canvas draws', () => {
    const names = [].concat(
        Object.values(L.PARTS).map((p) => p.name),
        Object.values(L.BODIES).map((b) => b.name),
        Object.values(L.WRENCH).map((j) => j.title || ''),
        ['RPM 1800', 'GEAR', 'MPH', 'SHIFT', 'SPIN', 'BLOWN!', 'THEM', 'YOU', 'GO!', 'YOU WIN!', 'STAGE', 'DONE', 'Installing: ', 'Bodywork: ']);
    for (const s of names) {
        for (const ch of s.toUpperCase()) assert.ok(L.FONT_CHARS.includes(ch), 'no glyph for "' + ch + '" in ' + s);
    }
    assert.strictEqual(L.textWidth('AB', 2), 22);
});

test('a classified ad shows what the car could become', () => {
    const g = L.newGame();
    for (let w = 0; w < 20; w++) {
        for (const ad of g.ads) {
            const p = L.potential(ad);
            assert.ok(p.fixCost > 0 && p.fixHours > 0, 'a used car always needs something');
            assert.strictEqual(p.margin, p.restored - ad.price - p.fixCost);
            assert.ok(p.asIs >= p.fixedEt - 0.01, `fixing doesn't slow it: ${p.asIs} vs ${p.fixedEt}`);
            assert.ok(p.builtEt < p.fixedEt - 3, `the Bestest parts make a real difference: ${p.builtEt} vs ${p.fixedEt}`);
            assert.ok(p.buildCost > 0 && p.builtHp > 0);
        }
        L.newWeek(g);
    }
});

test('potential leaves the ad alone', () => {
    const g = L.newGame();
    const before = JSON.stringify(g.ads);
    g.ads.forEach((ad) => L.potential(ad));
    assert.strictEqual(JSON.stringify(g.ads), before);
});

test('a full build costs several weeks of cash-race winnings', () => {
    for (const fam of Object.keys(L.FAMILIES)) {
        const top = Object.keys(L.PARTS).filter((id) => L.PARTS[id].slot === 'engine' && L.PARTS[id].fam === fam && L.PARTS[id].cls === 3)[0];
        const parts = L.stockParts(top, { carb: 3, intake: 3, cam: 3, exhaust: 3, trans: 3, rear: 3, tires: 3 });
        const cost = L.SLOTS.reduce((sum, slot) => sum + L.PARTS[parts[slot]].price, 0);
        // A Friday night's three cash races win at most 3 x RIVAL_PRIZE
        assert.ok(cost > 3 * L.RIVAL_PRIZE * L.ERAS[L.FAMILIES[fam].era].money, `${fam} build costs ${cost}`);
    }
    assert.strictEqual(L.repairCost({ parts: { engine: 'v8_427' }, engineCondition: 0 }), Math.ceil(100 * L.REPAIR_PER_POINT * (1 + 1150 / 1000)),
        'an engine rebuild costs what it did before the price rise');
});

test('the paint shop changes the colour and livery for a price, and only on a sound body', () => {
    const g = L.newGame();
    g.cars.push(L.makeCar(g, 'ford48', null, 50, 80));
    g.active = 0;
    g.cash = 10000;
    const car = L.activeCar(g);
    assert.strictEqual(L.carColor(car), L.BODIES.ford48.color);
    assert.match(L.paintCar(g, 'red', 'flames', 'white'), /rust/);
    car.condition = 90;
    assert.strictEqual(L.paintCost(car, 'red', 'flames', 'white'), L.PAINTS.red.price + L.LIVERIES.flames.price);
    assert.strictEqual(L.paintCar(g, 'red', 'flames', 'white'), null);
    assert.strictEqual(g.cash, 10000 - L.PAINTS.red.price - L.LIVERIES.flames.price);
    assert.deepStrictEqual(L.carLook(car), { color: L.PAINTS.red.hex, livery: 'flames', trim: '#f2f2ea', shape: 'coupe' });
    assert.match(L.canPaint(g, null, 'flames', 'white'), /already/);
    // A new stripe colour costs the livery again; the paint stays
    assert.strictEqual(L.paintCost(car, null, 'stripes', 'blue'), L.LIVERIES.stripes.price);
    assert.match(L.canPaint(g, null, 'stripes', null), /colour/);
    g.cash = 10;
    assert.match(L.paintCar(g, 'black', 'none', null), /afford/);
});

test('the garage once-over counts only the build parts a car still needs', () => {
    const g = garage('ford48', null, 40, 50);
    const car = L.activeCar(g);
    const before = L.carPotential(car);
    assert.strictEqual(before.margin, before.restored - L.carValue(car) - before.fixCost);
    car.parts.tires = 'tires_3';
    const after = L.carPotential(car);
    assert.strictEqual(before.buildCost - after.buildCost, L.PARTS.tires_3.price);
    assert.ok(after.asIs < before.asIs || after.asIs === before.asIs);
});

test('an engine swap or a Bestest+ part never makes the built time slower', () => {
    const car = L.activeCar(garage('chevy57', null, 31, 100));
    const stock = L.carPotential(car);
    assert.strictEqual(stock.family, 'Small-block');
    // A Best flathead swapped into a small-block car: the built time stays the small-block build's
    car.parts.engine = 'flat276';
    const swapped = L.carPotential(car);
    assert.strictEqual(swapped.builtEt, stock.builtEt);
    assert.strictEqual(swapped.family, 'Small-block');
    // Bestest+ slicks stay on the build, so it gets quicker and doesn't pay for Bestest slicks
    car.parts.tires = 'tires_4';
    const slicks = L.carPotential(car);
    assert.ok(slicks.builtEt < stock.builtEt, `${slicks.builtEt} vs ${stock.builtEt}`);
    assert.strictEqual(swapped.buildCost - slicks.buildCost, L.PARTS.tires_3.price);
});

test('a part taken off goes on the shelf, unless it is shot', () => {
    const g = garage('ford48', null, 80, 60);
    const car = L.activeCar(g);
    car.partCondition.carb = 47;
    car.partCondition.exhaust = 5;                             // shot
    L.buyPart(g, 'intake_flat_1');
    L.buyPart(g, 'exhaust_flat_1');
    const out = {};
    assert.strictEqual(L.installPart(g, 0, out), null);
    assert.deepStrictEqual(out, { shelved: [L.PARTS.intake_flat_0.name], binned: [] });
    assert.ok(g.inventory.includes('intake_flat_0'));
    assert.strictEqual(L.installPart(g, g.inventory.indexOf('exhaust_flat_1'), out), null);
    assert.deepStrictEqual(out.binned, [L.PARTS.exhaust_flat_0.name]);
    assert.ok(!g.inventory.includes('exhaust_flat_0'));
});

test('a worn part on the shelf can be rebuilt with spare hours, and sells for more', () => {
    const g = garage('ford48', null, 80, 50);
    g.inventory = ['flathead', 'carb_flat_2', 'tires_0', 'cam_flat_0'];
    g.shelfCond = [50, 40, 30, 100];
    const before = L.partValue(g, 1);
    const job = L.shelfRebuild(g, 1);
    assert.deepStrictEqual(job, { cost: Math.ceil(60 * L.WEAR.carb.repair), hours: L.JOB_HOURS.carb });
    assert.strictEqual(L.rebuildShelf(g, 1), null);
    assert.strictEqual(L.shelfCondition(g, 1), 100);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - L.JOB_HOURS.carb);
    assert.ok(L.partValue(g, 1) > before);
    // The engine rebuild costs what the same engine's rebuild costs on a car
    assert.strictEqual(L.shelfRebuild(g, 0).cost, L.repairCost(L.activeCar(g)));
    assert.strictEqual(L.shelfRebuild(g, 0).hours, L.REBUILD_HOURS);
    assert.ok(L.partValue(g, 0) > 0);                          // a stock engine sells too
    assert.strictEqual(L.shelfRebuild(g, 2), null);            // tires can't be rebuilt
    assert.match(L.canRebuildShelf(g, 3), /like new/);
    g.hours = 5;
    assert.ok(L.canRebuildShelf(g, 0));                        // not enough hours left
});

test('records: quickest run and reaction, longest streak, most cash on hand', () => {
    const g = L.newGame();
    assert.deepStrictEqual(L.records(g), { et: null, rt: null, streak: 0, cash: L.START_CASH });
    assert.deepStrictEqual(L.noteRace(g, 'win', 14.2, 0.41), ['et', 'rt']);   // a first win isn't a streak yet
    assert.deepStrictEqual(L.noteRace(g, 'win', 14.5, 0.38), ['streak', 'rt']);
    assert.deepStrictEqual(L.noteRace(g, 'lose', null, 0.6), []);              // blew up: no time
    assert.strictEqual(g.streak, 0);
    assert.deepStrictEqual(L.noteRace(g, 'foul', 13, 0.1), []);                // a jumped light counts for nothing
    L.noteRace(g, 'win', 15, 0.5);
    assert.deepStrictEqual(L.records(g), { et: 14.2, rt: 0.38, streak: 2, cash: L.START_CASH });
    g.cash = 9000; L.save(g); g.cash = 100; L.save(g);
    assert.strictEqual(L.records(g).cash, 9000);
    const old = { cash: 700 };                                                 // a save from before records
    assert.deepStrictEqual(L.records(old), { et: null, rt: null, streak: 0, cash: 700 });
});

test('Bestest+ only just beats Bestest for five times the money; Legendary matches it and widens the shift zone', () => {
    for (const engine of ['ardun296', 'gmc302', 'fuelie', 'v8_427']) {
        const build = (c, eng) => ({ body: 'ford48', condition: 100, engineCondition: 100, partCondition: {},
            parts: L.stockParts(eng, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
        const bestest = L.spec(build(3, engine));
        const plus = L.spec(build(4, engine + '_plus'));
        const legend = L.spec(build(5, engine + '_legend'));
        const gain = L.estimate(bestest).et - L.estimate(plus).et;
        assert.ok(gain > 0 && gain < 0.2, `${engine} gains ${gain}`);
        assert.strictEqual(L.estimate(legend).et, L.estimate(plus).et);
        assert.strictEqual(legend.legends, L.SLOTS.length);
        assert.strictEqual(plus.legends, 0);
        assert.strictEqual(L.PARTS[engine + '_plus'].price, L.PARTS[engine].price * L.PLUS_PRICE);
        assert.strictEqual(L.PARTS[engine + '_legend'].price, L.PARTS[engine + '_plus'].price * L.LEGEND_PRICE);
    }
});

test('Legendary parts only turn up now and then, one at a time', () => {
    const g = L.newGame();
    let weeks = 0;
    for (let w = 0; w < 500; w++) {
        L.newWeek(g);
        const legends = g.shopStock.filter((id) => L.PARTS[id].legend);
        assert.ok(legends.length <= 1);
        if (legends.length) weeks++;
    }
    assert.ok(weeks > 50 && weeks < 160, `${weeks} weeks of 500`);
});

test('a full Bestest V8 build has an even shot at The King, and Bestest+ the edge', () => {
    const king = Object.assign({}, L.KING, { engineCondition: 90 });
    const build = (engine, c) => ({ body: 'ford48', condition: 100, engineCondition: 100, partCondition: {},
        parts: L.stockParts(engine, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
    for (const engine of ['fuelie', 'v8_427']) {
        const odds = L.odds(build(engine, 3), king);
        assert.ok(odds > 0.42 && odds < 0.55, `${engine} Bestest: ${odds}`);
        assert.ok(L.odds(build(engine + '_plus', 4), king) > 0.5);
    }
    assert.ok(L.odds(build('ardun296', 3), king) < 0.35);      // a flathead still needs a V8 swap
});

test('1973: beating The King brings the next era the week after, its cars, parts and rivals joining 1963\'s', () => {
    const g = garage('ford48', FULL, 90, 90);
    g.wins = L.KING_WINS;
    L.newWeek(g);
    const i = g.rivals.findIndex((r) => r.king);
    const cash = g.cash;
    assert.match(L.settleRace(g, i, 'pinks', 'win', 0), /Next week it's 1973/);
    assert.strictEqual(g.cash, cash + L.KING_PRIZE);
    L.newWeek(g);
    assert.strictEqual(L.eraOf(g), 1);
    assert.ok(g.newEra);
    assert.strictEqual(L.eraWins(g), 0);
    assert.ok(g.cars.length === 2 && g.cash >= cash, 'cars and cash come along');
    assert.deepStrictEqual(g.ads.map((ad) => L.BODIES[ad.body].era), [1, 1, 1, 0, 0], 'mostly muscle cars in the paper');
    const now = g.rivals.filter((r) => r.era === 1), then = g.rivals.filter((r) => r.era === 0);
    assert.ok(now.length === 3 && now.every((r) => r.tier === 0 && !r.king), 'the easy 1973 crowd');
    assert.strictEqual(then.length, 1, 'and one from 1963');
    const shop = L.catalogFor(g, L.activeCar(g)).map((x) => L.PARTS[x.id].era);
    assert.ok(shop.includes(0) && shop.includes(1), 'both eras\' parts in the shop');
    assert.strictEqual(L.rivalPrize(g), 2500);
    assert.strictEqual(L.cashBet(g, then[0]), 1000, 'a 1963 rival bets 1963 money');
    assert.strictEqual(L.cashBet(g, now[0]), 2500);
    assert.strictEqual(L.kingPrize(g), 25000);
    assert.strictEqual(L.funPrize(now[0]), 125);
    assert.strictEqual(L.funPrize(then[0]), L.FUN_PRIZE[then[0].tier]);
    // Ten wins in 1973 bring its King, who pays 1973 money and his 'Cuda
    for (let w = 0; w < L.KING_WINS; w++) { L.settleRace(g, 0, 'fun', 'win', 0); g.rivals[0].funDone = false; }
    L.newWeek(g);
    const k = g.rivals.findIndex((r) => r.king);
    assert.ok(k >= 0 && g.rivals[k].name === L.KINGS[1].name);
    const before = g.cash;
    assert.match(L.settleRace(g, k, 'pinks', 'win', 0), /Next week it's 1985/);
    assert.strictEqual(g.cash, before + 25000);
    assert.strictEqual(g.cars[g.cars.length - 1].body, 'cuda70');
    L.newWeek(g);
    assert.strictEqual(L.eraOf(g), 2);
    assert.ok(!g.rivals.some((r) => r.king));
    assert.deepStrictEqual(g.ads.slice(0, 3).map((ad) => L.BODIES[ad.body].era), [2, 2, 2]);
    assert.ok(g.ads.slice(3).every((ad) => L.BODIES[ad.body].era < 2));
    assert.strictEqual(L.kingPrize(g), 40000);
});

test('the last era\'s King is the end of the line: no next era', () => {
    const g = garage('ford48', FULL, 90, 90);
    const last = L.ERAS.length - 1;
    g.era = last; g.eraWins = L.KING_WINS;
    L.newWeek(g);
    const k = g.rivals.findIndex((r) => r.king);
    assert.strictEqual(g.rivals[k].name, L.KINGS[last].name);
    assert.doesNotMatch(L.settleRace(g, k, 'pinks', 'win', 0), /Next week/);
    L.newWeek(g);
    assert.strictEqual(L.eraOf(g), last);
    assert.ok(!g.rivals.some((r) => r.king));
});

test('a save from before eras that already beat The King moves on to 1973', () => {
    const g = garage('ford48', null, 90, 90);
    delete g.era;
    g.kingBeaten = true;
    g.wins = 30;
    L.newWeek(g);
    assert.strictEqual(L.eraOf(g), 1);
    assert.ok(g.rivals.filter((r) => r.era === 1).every((r) => r.tier === 0));
});

test('1973 needs a 1973 build: Bestest muscle has an even shot at its King, and a 1963 Bestest build a slim one', () => {
    const king = Object.assign({}, L.KINGS[1], { engineCondition: 90 });
    const build = (body, engine, c) => ({ body, condition: 100, engineCondition: 100, partCondition: {},
        parts: L.stockParts(engine, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
    for (const body of ['camaro69', 'mustang67', 'charger69']) {
        for (const engine of ['ls6_454', 'boss429', 'hemi426']) {
            const odds = L.odds(build(body, engine, 3), king);
            assert.ok(odds > 0.4 && odds < 0.58, `${body} ${engine}: ${odds}`);
        }
    }
    assert.ok(L.odds(build('ford48', 'v8_427', 3), king) < 0.2);
    let last = Infinity;
    L.ERA_BUILDS[1].forEach((b, tier) => {
        const et = L.estimate(L.spec(car('torino70', L.rivalParts('torino70', tier, 1)))).et;
        assert.ok(et < last, `1973 tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

test('1985 needs a 1985 build: Bestest has close to an even shot at The Turbo King, and a 1973 Bestest build a slim one', () => {
    const king = Object.assign({}, L.KINGS[2], { engineCondition: 90 });
    const build = (body, engine, c) => ({ body, condition: 100, engineCondition: 100, partCondition: {},
        parts: L.stockParts(engine, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
    for (const body of ['fox79', 'irocz85', 'gn84']) {
        for (const engine of ['chevy406', 'ford392', 'stage2']) {
            const odds = L.odds(build(body, engine, 3), king);
            assert.ok(odds > 0.38 && odds < 0.55, `${body} ${engine}: ${odds}`);
            assert.ok(L.odds(build(body, engine + '_plus', 4), king) > odds);
        }
    }
    assert.ok(L.odds(build('camaro69', 'hemi426', 3), king) < 0.2);
    let last = Infinity;
    L.ERA_BUILDS[2].forEach((b, tier) => {
        const et = L.estimate(L.spec(car('montess84', L.rivalParts('montess84', tier, 2)))).et;
        assert.ok(et < last, `1985 tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

test('1995 needs a 1995 build: Bestest has a fair shot at The Import King, and a 1985 Bestest build a slim one', () => {
    const king = Object.assign({}, L.KINGS[3], { engineCondition: 90 });
    const build = (body, engine, c) => ({ body, condition: 100, engineCondition: 100, partCondition: {},
        parts: L.stockParts(engine, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
    for (const body of ['mustang94', 'vette92', 'supra93']) {
        for (const engine of ['lt1_427', 'kennebell', 'twojz_t88']) {
            const odds = L.odds(build(body, engine, 3), king);
            assert.ok(odds > 0.35 && odds < 0.55, `${body} ${engine}: ${odds}`);
            assert.ok(L.odds(build(body, engine + '_plus', 4), king) > odds);
        }
    }
    assert.ok(L.odds(build('irocz85', 'chevy406', 3), king) < 0.2);
    let last = Infinity;
    L.ERA_BUILDS[3].forEach((b, tier) => {
        const et = L.estimate(L.spec(car('camaro93', L.rivalParts('camaro93', tier, 3)))).et;
        assert.ok(et < last, `1995 tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

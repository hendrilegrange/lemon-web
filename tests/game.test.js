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
    L.sellPart(g, 0);                                          // and sell for a share of their junkyard price
    assert.strictEqual(g.cash - cash, Math.floor(L.WEAR.tires.junk * L.PART_RESALE));
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
    const hours = L.repairHours(L.REBUILD_HOURS, 10);      // 11 of 12: an engine at 10% is nearly worn out
    g.hours = hours - 1;
    assert.match(L.repair(g), /hours/);
    g.hours = L.HOURS_PER_WEEK;
    L.goFriday(g);
    assert.match(L.repair(g), /Friday/);
    L.newWeek(g);
    assert.strictEqual(L.repair(g), null);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - hours);
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

test('the garage holds 5 more cars for each era reached', () => {
    const g = L.newGame();
    assert.strictEqual(L.maxCars(g), 10);
    g.era = 2;
    assert.strictEqual(L.maxCars(g), 20);
    g.cash = 100000;
    for (let i = 0; i < 10; i++) g.cars.push(L.makeCar(g, 'ford50', null, 50, 50));
    g.ads[0] = { body: 'ford48', condition: 60, engineCondition: 80, price: 500, note: '' };
    assert.strictEqual(L.buyAd(g, 0), null);                   // an 11th car fits in 1985
    g.era = 99;
    assert.strictEqual(L.maxCars(g), 10 + 5 * (L.ERAS.length - 1));
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
    g.cash = 900;                                             // or pick a smaller bet
    g.rivals = [{ name: 'E', tier: 1, skill: 0.5, body: 'ford50' }, { name: 'F', tier: 1, skill: 0.5, body: 'ford50' }];
    L.settleRace(g, 0, 'cash', 'lose', 0, 250);
    assert.strictEqual(g.cash, 650);
    L.settleRace(g, 0, 'cash', 'win', 0, 5000);               // kept to what you can bet
    assert.strictEqual(g.cash, 1300);
    assert.strictEqual(L.betAmount(g, { tier: 1 }, 10), L.MIN_BET);
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
    assert.strictEqual(L.partValue(g, t), Math.floor(L.PARTS.tires_2.price * L.PART_RESALE * 0.6));
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
    g.kingBeaten = true;      // flames are The King's, yours once you beat him
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
    assert.deepStrictEqual(job, { cost: Math.ceil(60 * L.WEAR.carb.repair), hours: L.repairHours(L.JOB_HOURS.carb * L.REPAIR_SHARE, 40) });
    assert.strictEqual(L.rebuildShelf(g, 1), null);
    assert.strictEqual(L.shelfCondition(g, 1), 100);
    assert.strictEqual(g.hours, L.HOURS_PER_WEEK - job.hours);
    assert.ok(L.partValue(g, 1) > before);
    // The engine rebuild costs what the same engine's rebuild costs on a car
    assert.strictEqual(L.shelfRebuild(g, 0).cost, L.repairCost(L.activeCar(g)));
    assert.strictEqual(L.shelfRebuild(g, 0).hours, L.REBUILD_HOURS / 2);     // half worn, half the hours
    assert.ok(L.partValue(g, 0) > 0);                          // a stock engine sells too
    assert.strictEqual(L.shelfRebuild(g, 2), null);            // tires can't be rebuilt
    assert.match(L.canRebuildShelf(g, 3), /like new/);
    g.hours = 5;
    assert.ok(L.canRebuildShelf(g, 0));                        // not enough hours left
});

test('records: quickest run and reaction, longest streak, most cash on hand', () => {
    const g = L.newGame();
    assert.deepStrictEqual(L.records(g), { et: null, rt: null, streak: 0, cash: L.START_CASH, winsOnly: true });
    assert.deepStrictEqual(L.noteRace(g, 'win', 14.2, 0.41), ['et', 'rt']);   // a first win isn't a streak yet
    assert.deepStrictEqual(L.noteRace(g, 'win', 14.5, 0.38), ['streak', 'rt']);
    assert.deepStrictEqual(L.noteRace(g, 'lose', null, 0.6), []);              // blew up: no time
    assert.deepStrictEqual(L.noteRace(g, 'lose', 13.9, 0.2), []);              // the boards are for winners: a loss counts for nothing
    assert.strictEqual(g.streak, 0);
    assert.deepStrictEqual(L.noteRace(g, 'foul', 13, 0.1), []);                // a jumped light counts for nothing
    L.noteRace(g, 'win', 15, 0.5);
    assert.deepStrictEqual(L.records(g), { et: 14.2, rt: 0.38, streak: 2, cash: L.START_CASH, winsOnly: true });
    g.cash = 9000; L.save(g); g.cash = 100; L.save(g);
    assert.strictEqual(L.records(g).cash, 9000);
    const old = { cash: 700 };                                                 // a save from before records
    assert.deepStrictEqual(L.records(old), { et: null, rt: null, streak: 0, cash: 700, winsOnly: true });
    L.fixSave(g);                                                              // a wins-only save keeps its times
    assert.strictEqual(L.records(g).et, 14.2);
    const lossy = { cars: [], records: { et: 12.7, rt: 0.004, streak: 6, cash: 50000, k0: 20 } };   // from when losses counted
    L.fixSave(lossy);
    assert.deepStrictEqual(lossy.records, { et: null, rt: null, streak: 6, cash: 50000, k0: 20, winsOnly: true });
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
    const line = L.settleRace(g, k, 'pinks', 'win', 0);
    assert.doesNotMatch(line, /Next week/);
    assert.match(line, /you beat every King there was/);
    L.newWeek(g);
    assert.strictEqual(L.eraOf(g), last);
    assert.ok(!g.rivals.some((r) => r.king));
});

test('every King you beat leaves a Legendary part that fits the car you beat him with', () => {
    const g = garage('ford48', FULL, 90, 90);
    g.eraWins = L.KING_WINS;
    L.newWeek(g);
    const shelf = g.inventory.length;
    const line = L.settleRace(g, g.rivals.findIndex((r) => r.king), 'pinks', 'win', 0);
    assert.strictEqual(g.inventory.length, shelf + 1);
    const gift = L.PARTS[g.inventory[shelf]];
    assert.ok(gift.legend && L.fits(g.inventory[shelf], g.cars[0].parts.engine));
    assert.ok(gift.slot !== 'engine' || gift.fam === 'big');
    assert.match(line, /Legendary/);
    assert.ok(!L.beatTheGame(g));
});

test('beating The Last King beats the game: every part but the Legendary ones stays in stock', () => {
    const g = garage('ford48', FULL, 90, 90);
    g.era = L.ERAS.length - 1; g.eraWins = L.KING_WINS;
    L.newWeek(g);
    g.shopStock = [];
    assert.match(L.buyPart(g, 'cam_big_3'), /Sold out/);
    L.settleRace(g, g.rivals.findIndex((r) => r.king), 'pinks', 'win', 0);
    assert.ok(L.beatTheGame(g) && g.celebrate);
    g.cash = 1e7;
    assert.strictEqual(L.buyPart(g, 'cam_big_3'), null);
    assert.strictEqual(L.buyPart(g, 'cam_big_3'), null);       // and never sells out
    assert.ok(!L.inStock(g, 'cam_big_5') || g.shopStock.indexOf('cam_big_5') >= 0);
    const old = garage('ford48', null, 90, 90);                     // a save that beat him before this
    L.records(old)['k' + (L.ERAS.length - 1)] = 300;
    L.fixSave(old);
    assert.ok(L.beatTheGame(old));
});

test('the solo drags only count once you beat the game, and keep a best per car', () => {
    const g = garage('ford48', FULL, 90, 90), a = g.cars[0];
    const b = Object.assign({}, a, { id: a.id + 1 });
    g.cars.push(b);
    assert.strictEqual(L.noteSolo(g, 'sq', 11.5, a), false);
    g.gameBeaten = true;
    assert.deepStrictEqual(L.noteSolo(g, 'sq', 11.5, a), { car: true, overall: true });
    assert.strictEqual(L.noteSolo(g, 'sq', 11.9, a), false);
    assert.deepStrictEqual(L.noteSolo(g, 'sq', 11.9, b), { car: true, overall: false });   // slower, but this car's first
    assert.strictEqual(L.soloBest(g, 'sq', a), 11.5);
    assert.strictEqual(L.soloBest(g, 'sq', b), 11.9);
    assert.strictEqual(L.records(g).solo.sq[b.id].car, L.carName(b));
    assert.deepStrictEqual(L.noteSolo(g, 'sm', 30.25, a), { car: true, overall: true });
    assert.strictEqual(L.records(g).sq, 11.5);
    assert.strictEqual(L.noteSolo(g, 'zz', 1, a), false);
    assert.strictEqual(L.noteSolo(g, 'sq', 10, null), false);
    const s = L.spec(g.cars[0]);
    const q = L.estimate(s).et, h = L.estimate(s, L.soloOf('sh').dist).et, m = L.estimate(s, L.soloOf('sm').dist).et;
    assert.ok(q < h && h < m && m < 60, `${q} ${h} ${m}`);
});

test('a save that beat The Last King before the celebration gets it once', () => {
    const g = garage('ford48', null, 90, 90);
    L.records(g)['k' + (L.ERAS.length - 1)] = 46;
    L.fixSave(g);
    assert.ok(g.gameBeaten && g.celebrate);
    delete g.celebrate;
    L.fixSave(g);
    assert.ok(!g.celebrate);
});

test('swapping in an engine from another family says what comes off first', () => {
    const g = garage('ford48', FULL, 90, 90);
    g.inventory.push('v8_327'); g.inventory.push('cam_small_2'); g.inventory.push('v8_409');
    const smallblock = L.swapPreview(g, 0);
    assert.strictEqual(smallblock.lost.length, 4);                 // the Bestest carb, intake, cam and exhaust
    assert.strictEqual(smallblock.fits, 1);
    assert.ok(smallblock.newEt > smallblock.et);
    assert.strictEqual(L.swapPreview(g, 2), null);                 // another big-block: nothing comes off
    assert.strictEqual(L.swapPreview(g, 1), null);                 // not an engine
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

test('2005 needs a 2005 build: Bestest has a fair shot at The Tuner King, and a 1995 Bestest build a slim one', () => {
    const king = Object.assign({}, L.KINGS[4], { engineCondition: 90 });
    const build = (body, engine, c) => ({ body, condition: 100, engineCondition: 100, partCondition: {},
        parts: L.stockParts(engine, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
    for (const body of ['gto04', 'vette05', 'evo05']) {
        for (const engine of ['ls_tt', 'hemi_whip', 'gt35r']) {
            const odds = L.odds(build(body, engine, 3), king);
            assert.ok(odds > 0.33 && odds < 0.55, `${body} ${engine}: ${odds}`);
            assert.ok(L.odds(build(body, engine + '_plus', 4), king) > odds);
        }
    }
    assert.ok(L.odds(build('supra93', 'twojz_t88', 3), king) < 0.25);
    let last = Infinity;
    L.ERA_BUILDS[4].forEach((b, tier) => {
        const et = L.estimate(L.spec(car('gto04', L.rivalParts('gto04', tier, 4)))).et;
        assert.ok(et < last, `2005 tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

test('2025 needs a 2025 build: Bestest has a fair shot at The Last King, and a 2005 Bestest build a slim one', () => {
    const king = Object.assign({}, L.KINGS[5], { engineCondition: 90 });
    const build = (body, engine, c) => ({ body, condition: 100, engineCondition: 100, partCondition: {},
        parts: L.stockParts(engine, { carb: c, intake: c, cam: c, exhaust: c, trans: c, rear: c, tires: c }) });
    for (const body of ['challenger23', 'mustang24', 'gtr24']) {
        for (const engine of ['lt_tt', 'hemi_jb', 'coyote_tt', 'vr38_alpha']) {
            const odds = L.odds(build(body, engine, 3), king);
            assert.ok(odds > 0.33 && odds < 0.55, `${body} ${engine}: ${odds}`);
            assert.ok(L.odds(build(body, engine + '_plus', 4), king) > odds);
        }
    }
    assert.ok(L.odds(build('vette05', 'ls_tt', 3), king) < 0.25);
    let last = Infinity;
    L.ERA_BUILDS[5].forEach((b, tier) => {
        const et = L.estimate(L.spec(car('camaro24', L.rivalParts('camaro24', tier, 5)))).et;
        assert.ok(et < last, `2025 tier ${tier}: ${et} < ${last}`);
        last = et;
    });
});

test('better parts wear slower: Bestest at half the rate of stock, Legendary slowest', () => {
    const wearAfter = (cls) => {
        const g = garage('chevy55', null, 100, 100);
        const c = L.activeCar(g);
        c.parts = L.stockParts(L.BODIES.chevy55.parts.engine, { carb: cls, intake: cls, cam: cls, exhaust: cls, trans: cls, rear: cls, tires: cls });
        let lost = 0;
        for (let k = 0; k < 400; k++) {
            g.rivals = [{ name: 'A', tier: 0, skill: 0.5, body: 'ford48', engineCondition: 90 }];
            c.partCondition = {}; c.engineCondition = 100;
            L.settleRace(g, 0, 'fun', 'lose', 0);
            lost += 100 - L.partCondition(c, 'tires');
        }
        return lost / 400;
    };
    const stock = wearAfter(0), bestest = wearAfter(3);
    assert.ok(Math.abs(bestest / stock - L.WEAR_RATE[3]) < 0.1, `${bestest} vs ${stock}`);
    assert.ok(L.WEAR_RATE[5] < L.WEAR_RATE[3] && L.WEAR_RATE[1] < 1);
    const g = garage('chevy55', FULL, 100, 100);
    assert.strictEqual(L.wear(L.activeCar(g), 'engine', 10), 10 * L.WEAR_RATE[L.PARTS[L.activeCar(g).parts.engine].cls]);
});

test('beating a King keeps the fewest weeks it took for that era\'s board', () => {
    const g = garage('ford48', FULL, 90, 90);
    g.eraWins = L.KING_WINS; g.week = 14;
    L.newWeek(g);
    const k = g.rivals.findIndex((r) => r.king);
    L.settleRace(g, k, 'pinks', 'win', 0);
    assert.strictEqual(L.records(g).k0, 15);
    g.week = 30; g.era = 0; g.kingBeaten = false; g.rivals = [Object.assign({}, L.KINGS[0], { king: true, engineCondition: 90 })];
    L.settleRace(g, 0, 'pinks', 'win', 0);
    assert.strictEqual(L.records(g).k0, 15);                  // a slower win keeps the best
});

test('a car\'s build is the class most of its parts are, and a King\'s car is his', () => {
    const g = garage('ford48', null, 90, 90);
    const c = L.activeCar(g);
    assert.strictEqual(L.carTier(c), 0);
    c.parts = L.stockParts(c.parts.engine, { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 1, rear: 1, tires: 3 });
    assert.strictEqual(L.carTier(c), 2);
    assert.strictEqual(L.carTier(L.makeCar(g, 'chevy57', FULL, 80, 90)), 3);
    g.eraWins = L.KING_WINS;
    L.newWeek(g);
    const k = g.rivals.findIndex((r) => r.king);
    L.settleRace(g, k, 'pinks', 'win', 0);
    assert.strictEqual(L.carTier(g.cars[g.cars.length - 1]), 'king');
    const old = L.makeCar(g, 'chevy57', L.rivalParts('chevy57', 5, 0), 80, 90);      // won before cars kept it
    assert.strictEqual(L.carTier(old), 'king');
    assert.strictEqual(old.king, 'The King');
});

test("a King's car keeps his black and flames, which you can't buy until you beat a King", () => {
    const g = garage('ford48', null, 90, 90);
    assert.match(L.canPaint(g, null, 'flames', 'white'), /Beat him first/);
    assert.strictEqual(L.canPaint(g, null, 'stripes', 'white'), null);
    g.eraWins = L.KING_WINS;
    L.newWeek(g);
    L.settleRace(g, g.rivals.findIndex((r) => r.king), 'pinks', 'win', 0);
    const won = g.cars[g.cars.length - 1];
    assert.strictEqual(won.paint, 'black');
    assert.strictEqual(won.livery, 'flames');
    assert.strictEqual(L.canPaint(g, null, 'flames', 'white'), null);
});

test('an older save gets its King car painted and loses flames it had no right to, with a refund', () => {
    const g = garage('ford48', null, 90, 90);
    g.cars[0].livery = 'flames';
    g.cars.push(L.makeCar(g, 'chevy55', null, 90, 90));
    g.cars[1].livery = 'flames';
    const cash = g.cash;
    L.fixSave(g);
    assert.strictEqual(g.cars[0].livery, 'none');
    assert.strictEqual(g.cars[1].livery, 'none');
    assert.strictEqual(g.cash, cash + 2 * L.LIVERIES.flames.price);
    assert.match(g.notice, /\$6,000/);
    L.fixSave(g);                                           // runs on every load: nothing more the second time
    assert.strictEqual(g.cash, cash + 2 * L.LIVERIES.flames.price);

    const h = garage('ford48', null, 90, 90);
    h.era = 1;
    h.cars[0].livery = 'flames';
    const king = L.makeCar(h, 'chevy57', L.rivalParts('chevy57', 5, 0), 80, 90);     // won before cars kept his paint
    h.cars.push(king);
    L.fixSave(h);
    assert.strictEqual(h.cars[0].livery, 'flames');
    assert.strictEqual(king.paint, 'black');
    assert.strictEqual(king.livery, 'flames');
    assert.strictEqual(h.notice, undefined);
});

test('repairs take less time the less worn a part is, and replacing takes the full job', () => {
    assert.strictEqual(L.repairHours(12, 99), 1);
    assert.strictEqual(L.repairHours(12, 50), 6);
    assert.strictEqual(L.repairHours(12, 0), 12);
    assert.strictEqual(L.repairHours(2, 74), 1);
    const g = garage('ford48', null, 100, 99, { carb: 74, cam: 10, tires: 30 });
    const d = {};
    L.diagnose(L.activeCar(g)).forEach((x) => { d[x.slot] = x; });
    assert.strictEqual(d.engine.hours, 1);
    assert.strictEqual(d.carb.hours, 1);
    assert.strictEqual(d.cam.action, 'replace');
    assert.strictEqual(d.cam.hours, L.JOB_HOURS.cam);
    assert.strictEqual(d.tires.hours, L.JOB_HOURS.tires);
});

test('Fix all does every job at once, once you have beaten a King', () => {
    const g = garage('ford48', null, 70, 60, { carb: 74, cam: 10 });
    assert.match(L.canFixAll(g), /Beat The King/);
    g.kingBeaten = true;
    const plan = L.fixAllPlan(g);
    assert.strictEqual(plan.jobs.length, 4);              // engine, carb, cam and the body
    const cash = g.cash, hours = g.hours;
    assert.strictEqual(L.fixEverything(g), null);
    const c = L.activeCar(g);
    assert.strictEqual(c.condition, 100);
    assert.strictEqual(c.engineCondition, 100);
    assert.strictEqual(L.partCondition(c, 'carb'), 100);
    assert.ok(L.partCondition(c, 'cam') >= L.JUNK_CONDITION);
    assert.strictEqual(g.cash, cash - plan.cost);
    assert.strictEqual(g.hours, hours - plan.hours);
    assert.deepStrictEqual(L.fixAllPlan(g).jobs, [{ slot: 'cam', how: 'repair' }]);   // the used cam is worn itself
    const h = garage('ford48', null, 20, 20);
    h.era = 1;
    h.hours = 1;
    assert.match(L.canFixAll(h), /hours/);
});

test('the dealership opens once you beat a King and sells every reached era new', () => {
    const g = L.newGame();
    g.cash = 100000;
    assert.match(L.canBuyNew(g, 'chevy57'), /Beat The King/);
    g.kingBeaten = true;
    assert.ok(L.dealerCars(g).every((id) => (L.BODIES[id].era || 0) === 0));
    const price = L.newCarPrice('chevy57');
    assert.ok(price > L.carValue(L.newCar('chevy57')));
    assert.strictEqual(L.buyNew(g, 'chevy57'), null);
    assert.strictEqual(g.cash, 100000 - price);
    const c = g.cars[0];
    assert.strictEqual(g.active, 0);
    assert.strictEqual(c.condition, 100);
    assert.strictEqual(c.engineCondition, 100);
    assert.strictEqual(L.fixAll(c).cost, 0);
    assert.match(L.canBuyNew(g, 'dart69'), /doesn't sell/);     // 1973 isn't open yet
    g.era = 2;
    assert.strictEqual(L.dealerCars(g)[0].length > 0 && L.BODIES[L.dealerCars(g)[0]].era, 2);   // newest first
    assert.strictEqual(L.canBuyNew(g, 'dart69'), null);
    g.cash = 0;
    assert.match(L.canBuyNew(g, 'dart69'), /afford/);
});

test('every car body has its own sprite', () => {
    const seen = {};
    for (const [id, b] of Object.entries(L.BODIES)) {
        assert.ok(L.CAR_SHAPES.includes(b.shape), `${id} has no sprite ${b.shape}`);
        const key = L.carSprite(b.shape).join('\n');
        assert.strictEqual(seen[key], undefined, `${id} looks just like ${seen[key]}`);
        seen[key] = id;
        assert.strictEqual(L.carSprite(b.shape).length, 22);
        L.carSprite(b.shape).forEach(row => assert.strictEqual(row.length, 44));
    }
});

test('a fresh start can beat the first rivals, who drive tired junkers', () => {
    const g = { nextId: 1 }, worn = {};
    L.SLOTS.forEach(s => { if (s !== 'engine') worn[s] = 65; });
    const car = L.makeCar(g, 'ford48', null, 80, 65, worn);           // a typical car from the paper
    const first = L.RIVALS.filter(r => r.era === 0 && r.tier === 0).map(r => Object.assign({}, r, { engineCondition: 60 }));
    const odds = first.map(r => L.odds(car, r));
    assert.ok(odds.reduce((a, b) => a + b) / odds.length > 0.6, odds.join(' '));
    assert.ok(Object.values(L.rivalCar(first[0]).partCondition).every(c => c === 60));
});

test('Dad lends once when you are broke, interest free, until you beat a King', () => {
    const g = L.newGame();
    assert.ok(L.canCallDaddy(g));                 // $600 isn't broke
    g.cash = 100;
    assert.strictEqual(L.callDaddy(g), null);
    assert.strictEqual(g.cash, 100 + L.DADDY_LOAN);
    g.cash = 50;
    assert.ok(L.canCallDaddy(g));                 // not again till he's paid
    for (let i = 0; i < 6; i++) L.newWeek(g);
    assert.strictEqual(g.daddy, L.DADDY_LOAN);    // no interest, no deadline
    assert.ok(!g.over);
    g.cash = 1000;
    assert.strictEqual(L.repay(g, 'daddy', 9999), L.DADDY_LOAN);
    assert.strictEqual(g.daddy, undefined);
    g.cash = 10;
    g.kingBeaten = true;
    assert.ok(L.canCallDaddy(g));                 // the shark's turn now
});

test('the Loan Shark charges 50% a week and ends the game after four weeks unpaid', () => {
    const g = L.newGame();
    assert.ok(L.canBorrowShark(g, 1000));
    g.kingBeaten = true;
    assert.ok(L.canBorrowShark(g, L.sharkRoom(g) + 10));
    assert.strictEqual(L.borrowShark(g, 1000), null);
    assert.strictEqual(g.shark.due, g.week + L.SHARK_WEEKS);
    const due = g.shark.due;
    L.newWeek(g);
    assert.strictEqual(g.shark.owed, 1500);
    L.borrowShark(g, 500);
    assert.strictEqual(g.shark.due, due);         // more money, same deadline
    L.save(g);
    assert.strictEqual(g.records.cash, L.START_CASH);   // borrowed cash isn't a record
    while (g.week < due) L.newWeek(g);
    assert.ok(!g.over);
    L.newWeek(g);
    assert.ok(g.over && g.over.owed > 0);
    // paid off in time, he's gone
    const h = L.newGame();
    h.kingBeaten = true;
    L.borrowShark(h, 2000);
    L.newWeek(h);
    h.cash = 10000;
    L.repay(h, 'shark', 10000);
    assert.strictEqual(h.shark, undefined);
    for (let i = 0; i < 8; i++) L.newWeek(h);
    assert.ok(!h.over);
});

test('the story panels all draw, and every tip Mac gives is written', () => {
    const ctx = { fillRect() {}, clearRect() {}, set fillStyle(v) {}, get fillStyle() { return ''; } };
    assert.ok(L.INTRO.length >= 4);
    L.INTRO.forEach((p, i) => {
        assert.ok(p.text.length > 20, `panel ${i} has no text`);
        [0, 0.7, 2, 5].forEach(t => p.draw(ctx, 320, 120, t));
    });
    for (const key of ['hub-start', 'ads', 'hub-car', 'garage', 'fix', 'parts', 'hub-ready', 'stand', 'result']) {
        assert.ok(typeof L.COACH[key] === 'string' && L.COACH[key].length > 20, key);
    }
});

test('a repair is worth doing: a worn-out part costs real time, and repairing it takes less than a swap', () => {
    const g = garage('ford48', null, 80, 100);
    const car = L.activeCar(g);
    car.partCondition = { carb: 30, rear: 30 };
    const d = Object.fromEntries(L.diagnose(car).map((x) => [x.slot, x]));
    assert.strictEqual(d.carb.action, 'repair');
    assert.strictEqual(d.carb.hours, L.repairHours(L.JOB_HOURS.carb * L.REPAIR_SHARE, 30));
    assert.ok(d.rear.hours < L.JOB_HOURS.rear);
    // Each repair takes a good chunk off the quarter mile, more than a cheap upgrade's worth
    assert.ok(L.jobGain(car, 'carb', 'repair') > 0.2, 'carb ' + L.jobGain(car, 'carb', 'repair'));
    assert.ok(L.jobGain(car, 'rear', 'repair') > 0.3, 'rear ' + L.jobGain(car, 'rear', 'repair'));
    assert.strictEqual(L.jobGain(car, 'cam', 'repair'), 0);   // a part like new gains nothing
});

test('beating a King leaves a victory screen to show, with his car and the Legendary part', () => {
    const g = garage('ford48', null, 90, 90);
    g.wins = L.KING_WINS;
    L.newWeek(g);
    const i = g.rivals.findIndex((r) => r.king);
    L.settleRace(g, i, 'pinks', 'win', 0);
    assert.ok(g.crowned && !g.celebrate, 'the first King gets the victory screen, not the finale');
    assert.strictEqual(g.crowned.era, 0);
    assert.strictEqual(g.crowned.king, L.KING.name);
    assert.strictEqual(g.crowned.cash, L.KING_PRIZE);
    assert.strictEqual(g.crowned.car.id, g.cars[1].id);
    assert.strictEqual(g.crowned.mine, g.cars[0].id);
    assert.ok(g.inventory.includes(g.crowned.part), 'the Legendary part is on the shelf');
});

test('tires are never a Legendary drop, from a King or the speed shop', () => {
    const g = garage('ford48', null, 90, 90);
    for (let n = 0; n < 200; n++) assert.notStrictEqual(L.PARTS[L.kingReward(g, L.activeCar(g))].slot, 'tires');
    const random = L.random;
    L.random = () => 0;      // a Legendary part turns up every week
    try {
        for (let n = 0; n < 50; n++) {
            L.newWeek(g);
            g.shopStock.filter((id) => L.PARTS[id].legend).forEach((id) => assert.notStrictEqual(L.PARTS[id].slot, 'tires'));
        }
    } finally { L.random = random; }
});

test('a dearer part is never slower: every class in the speed shop beats the one below it', () => {
    const group = (id) => id.replace(/_(\d|plus|legend)$/, '');
    const lines = {};
    Object.keys(L.PARTS).forEach((id) => {
        if (L.PARTS[id].slot !== 'engine') (lines[group(id)] = lines[group(id)] || [])[L.PARTS[id].cls] = id;
    });
    for (const body of ['ford48', 'chevy57', 'camaro69', 'cuda70', 'fox79', 'supra93', 'gto04', 'challenger23']) {
        const engine = L.BODIES[body].parts.engine;
        for (const built of [false, true]) {
            const base = { body, condition: 100, engineCondition: 100, partCondition: {},
                parts: built ? L.stockParts(engine, { carb: 3, intake: 3, cam: 3, exhaust: 3, trans: 3, rear: 3, tires: 3 }) : L.stockParts(engine) };
            for (const ids of Object.values(lines)) {
                const slot = L.PARTS[ids[1]].slot;
                if (!L.fits(ids[1], engine)) continue;
                const ets = ids.map((id) => L.estimate(L.spec(Object.assign({}, base, { parts: Object.assign({}, base.parts, { [slot]: id }) }))).et);
                for (let k = 1; k <= 4; k++) {
                    // Bestest+ tires can't do much for a car that never spins them: equal, within a few thousandths
                    const close = slot === 'tires' && k === 4 ? 0.003 : 0;
                    assert.ok(ets[k] < ets[k - 1] + close, `${body}${built ? ' built' : ''}: ${ids[k]} ${ets[k].toFixed(3)} vs ${ids[k - 1]} ${ets[k - 1].toFixed(3)}`);
                }
                assert.strictEqual(ets[5], ets[4]);
            }
        }
    }
});

test("kids' garage: fixing makes the car quicker up to the best part, and the top ten keeps each name's best", () => {
    for (const c of L.KID_CARS) {
        const kc = L.kidNewCar(c.id);
        let et = L.estimate(L.spec(L.kidCar(kc))).et;
        const stars = L.kidStars(kc);
        for (let round = 0; round < 4; round++) {
            for (const [slot] of L.KID_JOBS) {
                if (!L.kidUpgrade(kc, slot)) { assert.ok(L.kidMaxed(kc, slot)); continue; }
                const now = L.estimate(L.spec(L.kidCar(kc))).et;
                assert.ok(now <= et + 0.003, `${c.body} ${slot}: ${now} after ${et}`);
                et = Math.min(et, now);
                assert.ok(L.fits(kc.parts[slot], kc.parts.engine));
            }
        }
        L.KID_JOBS.forEach(([slot]) => assert.ok(L.kidMaxed(kc, slot)));
        assert.strictEqual(L.kidStars(kc), 5);
        assert.ok(stars < 5);
        // A fully fixed car beats Mac
        assert.ok(L.estimate(L.spec(L.kidCar(kc))).et < L.estimate(L.kidRival(kc).spec).et);
    }
    assert.strictEqual(L.kidName('  Sam!!  <b>the   Great</b> '), 'Sam bthe Gre');
    let top = [];
    top = L.kidAddTime(top, { name: 'Sam', car: 'Hot Rod', t: 15 });
    top = L.kidAddTime(top, { name: 'sam', car: 'Cruiser', t: 16 });
    assert.deepStrictEqual(top, [{ name: 'Sam', car: 'Hot Rod', t: 15 }]);
    top = L.kidAddTime(top, { name: 'SAM', car: 'Cruiser', t: 14 });
    assert.deepStrictEqual(top, [{ name: 'SAM', car: 'Cruiser', t: 14 }]);
    for (let i = 0; i < 12; i++) top = L.kidAddTime(top, { name: 'Kid' + i, car: 'Hot Rod', t: 10 + i });
    assert.strictEqual(top.length, 10);
    assert.strictEqual(top[0].t, 10);
    assert.ok(top.some((r) => r.name === 'SAM'));
    assert.ok(!top.some((r) => r.name === 'Kid11'));
});

test('a car lost for pink slips can be bought back from Lemon Motors, as it was, at a markup', () => {
    const g = L.newGame();
    g.cars.push(L.makeCar(g, 'ford48', null, 90, 100), L.makeCar(g, 'chevy55', null, 90, 100));
    g.active = 0;
    L.goFriday(g);
    g.rivals = [{ name: 'A', tier: 1, skill: 0.5, body: 'merc49', engineCondition: 90 }];
    assert.ok(!L.dealerOpen(g));
    const gone = L.activeCar(g);
    L.settleRace(g, 0, 'pinks', 'lose', 0);
    assert.strictEqual(g.cars.length, 1);
    assert.ok(L.dealerOpen(g), 'the dealership opens to sell it back before any King');
    assert.strictEqual(g.lost[0].car, gone);
    const price = L.buybackPrice(gone);
    assert.ok(price > L.carValue(gone));
    g.cash = price - 1;
    assert.ok(L.canBuyBack(g, 0));
    g.cash = price;
    assert.strictEqual(L.buyBack(g, 0), null);
    assert.strictEqual(g.cash, 0);
    assert.strictEqual(g.cars.length, 2);
    assert.strictEqual(g.cars[1], gone);
    assert.strictEqual(g.lost.length, 0);
    assert.ok(!L.dealerOpen(g));
});

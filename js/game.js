// Game state and rules: money, cars, parts, the classifieds and street races.
// No drawing here, so it runs in Node for tests.
(function (L) {
    'use strict';

    var SAVE_KEY = 'lemon.save.v2';

    L.random = Math.random;
    function rand(min, max) { return min + L.random() * (max - min); }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
    function pick(list) { return list[Math.floor(L.random() * list.length)]; }
    function roundTo(n, step) { return Math.round(n / step) * step; }

    L.newGame = function () {
        var g = { cash: L.START_CASH, week: 1, cars: [], active: -1, inventory: [], wins: 0, losses: 0, nextId: 1 };
        L.newWeek(g, true);
        return g;
    };

    L.makeCar = function (g, bodyId, parts, condition, engineCondition, partCondition) {
        return {
            id: g.nextId++,
            body: bodyId,
            parts: Object.assign({}, L.BODIES[bodyId].parts, parts || {}),
            condition: condition,               // body and paint, 0-100: sets the resale value
            engineCondition: engineCondition,   // 0-100: power, and 0 means a blown engine
            partCondition: partCondition || {}  // 0-100 by slot for the other parts; missing means 100
        };
    };

    // How worn a part is, 0-100. The engine's is engineCondition.
    L.partCondition = function (car, slot) {
        if (slot === 'engine') return car.engineCondition;
        var c = car.partCondition && car.partCondition[slot];
        return typeof c === 'number' ? c : 100;
    };

    // Wear on the other parts follows the engine, give or take: a tired car is tired all over
    function wornParts(engineCondition) {
        var worn = {};
        L.SLOTS.forEach(function (slot) {
            if (slot !== 'engine') worn[slot] = randInt(Math.max(5, engineCondition - 40), Math.min(100, engineCondition + 25));
        });
        return worn;
    }

    L.activeCar = function (g) { return g.cars[g.active] || null; };

    L.carName = function (car) { return L.BODIES[car.body].name; };

    // What a dealer pays: the body by condition, plus half of what the parts cost new
    L.carValue = function (car) {
        var body = L.BODIES[car.body];
        var value = body.price * (0.3 + 0.5 * car.condition / 100);
        L.SLOTS.forEach(function (slot) {
            value += (L.PARTS[car.parts[slot]].price || 0) / 2 * (slot === 'engine' ? 1 : L.partCondition(car, slot) / 100);
        });
        value *= 0.5 + 0.5 * car.engineCondition / 100;
        return roundTo(value, 5);
    };

    // A new week: fresh classified ads and fresh rivals at the burger stand
    L.newWeek = function (g, first) {
        if (!first) g.week++;
        g.ads = [];
        var bodies = Object.keys(L.BODIES);
        for (var i = 0; i < 5; i++) {
            var bodyId = pick(bodies);
            var body = L.BODIES[bodyId];
            var condition = randInt(10, 75);        // scrappy used cars: rust, dents and tired engines
            var engineCondition = randInt(25, 90);
            var price = roundTo(body.price * (0.35 + 0.65 * condition / 100) * (0.7 + 0.3 * engineCondition / 100) * rand(0.9, 1.15), 10);
            g.ads.push({ body: bodyId, condition: condition, engineCondition: engineCondition, parts: wornParts(engineCondition), price: price, note: adNote(condition, engineCondition) });
        }
        // There is always a cheap beater, so a broke player can get back on the road
        if (!g.ads.some(function (ad) { return ad.price <= 200; })) {
            var beater = g.ads[4];
            beater.condition = randInt(8, 20);
            beater.engineCondition = randInt(25, 40);
            beater.parts = wornParts(beater.engineCondition);
            beater.price = roundTo(rand(120, 200), 10);
            beater.note = adNote(beater.condition, beater.engineCondition);
        }
        g.rivals = pickRivals(g);
    };

    function adNote(condition, engine) {
        if (engine < 50) return pick(['Runs rough. Needs work.', 'Smokes a little. Make offer.', 'Mechanic special!']);
        if (condition < 40) return pick(['Rusty but solid.', 'Needs paint. Runs good.', 'Project car, priced to sell.']);
        if (condition > 65 && engine > 75) return pick(['Cream puff! Garage kept.', 'Clean, no rust. No tire kickers.', 'One owner, runs strong.']);
        return pick(['Good driver.', 'Runs and drives.', 'Daily driver, must sell.', 'Moving, must sell!']);
    }

    // Three rivals around the player's level: wins unlock the tougher ones. The King joins
    // them once you've won enough races, until you beat him.
    function pickRivals(g) {
        var maxTier = Math.min(4, Math.floor(g.wins / 2));
        var pool = L.RIVALS.filter(function (r) { return r.tier <= maxTier; });
        var chosen = [];
        function add(r) {
            chosen.push({
                name: r.name, tier: r.tier, skill: r.skill, body: r.body, line: r.line,
                king: r === L.KING, funDone: false,
                engineCondition: r.tier === 0 ? randInt(45, 75) : randInt(75, 100)   // the first rivals drive junkers too
            });
        }
        while (chosen.length < 3 && pool.length) add(pool.splice(Math.floor(L.random() * pool.length), 1)[0]);
        if (g.wins >= L.KING_WINS && !g.kingBeaten) add(L.KING);
        return chosen;
    }

    L.rivalCar = function (rival) {
        return {
            body: rival.body,
            parts: Object.assign({}, L.BODIES[rival.body].parts, L.RIVAL_BUILDS[rival.tier]),
            condition: 70,
            engineCondition: rival.engineCondition
        };
    };

    // ── Buying and selling cars ──────────────────────────────────────────

    L.buyAd = function (g, index) {
        var ad = g.ads[index];
        if (!ad) return 'That ad is gone.';
        if (g.cash < ad.price) return "You can't afford it.";
        if (g.cars.length >= L.MAX_CARS) return 'Your garage is full. Sell a car first.';
        g.cash -= ad.price;
        g.cars.push(L.makeCar(g, ad.body, null, ad.condition, ad.engineCondition, ad.parts));
        if (g.active < 0) g.active = g.cars.length - 1;
        g.ads.splice(index, 1);
        return null;
    };

    L.sellCar = function (g, index) {
        var car = g.cars[index];
        if (!car) return 'No such car.';
        g.cash += L.carValue(car);
        g.cars.splice(index, 1);
        if (g.active === index) g.active = g.cars.length ? 0 : -1;
        else if (g.active > index) g.active--;
        return null;
    };

    // ── Parts ─────────────────────────────────────────────────────────────

    L.buyPart = function (g, partId) {
        var part = L.PARTS[partId];
        if (!part || !part.price) return 'Not for sale.';
        if (g.cash < part.price) return "You can't afford it.";
        g.cash -= part.price;
        g.inventory.push(partId);
        return null;
    };

    L.sellPart = function (g, invIndex) {
        var partId = g.inventory[invIndex];
        if (!partId) return 'No such part.';
        g.cash += Math.floor((L.PARTS[partId].price || 0) / 2);
        g.inventory.splice(invIndex, 1);
        return null;
    };

    // Why a shelf part can't go on the active car, or null if it can
    L.canInstall = function (g, invIndex) {
        var car = L.activeCar(g);
        var partId = g.inventory[invIndex];
        if (!car) return 'You need a car first.';
        if (!partId) return 'No such part.';
        var part = L.PARTS[partId];
        if (part.needs && car.parts.intake !== part.needs) {
            return part.name + ' needs a ' + L.PARTS[part.needs].name + ' first.';
        }
        // Taking off the high-rise intake also takes off the carbs that need it
        if (part.slot === 'intake' && L.PARTS[car.parts.carb].needs && L.PARTS[car.parts.carb].needs !== partId) {
            return 'Swap the ' + L.PARTS[car.parts.carb].name + ' for a single carb first.';
        }
        return null;
    };

    // Swap a part from the shelf onto the active car; the old part goes on the shelf
    L.installPart = function (g, invIndex) {
        var err = L.canInstall(g, invIndex);
        if (err) return err;
        var car = L.activeCar(g);
        var partId = g.inventory[invIndex];
        var part = L.PARTS[partId];
        var old = car.parts[part.slot];
        var oldCondition = L.partCondition(car, part.slot);
        car.parts[part.slot] = partId;
        g.inventory.splice(invIndex, 1);
        // Stock parts that came with the car are worth nothing, and a shot part is scrap,
        // so they go in the bin
        if (L.PARTS[old].price && (part.slot === 'engine' || oldCondition >= L.SHOT)) g.inventory.push(old);
        if (part.slot !== 'engine') car.partCondition[part.slot] = 100;
        // A different engine comes with its own condition: new from the catalog
        if (part.slot === 'engine') car.engineCondition = 100;
        return null;
    };

    L.repairCost = function (car) {
        return Math.ceil((100 - car.engineCondition) * L.REPAIR_PER_POINT * (1 + (L.PARTS[car.parts.engine].price || 300) / 1000));
    };

    // ── Fixing the other parts ────────────────────────────────────────────

    // What each part needs: 'ok', 'repair' (rebuild it, at cost) or 'replace' (shot, or tires,
    // which can't be repaired). replace offers a junkyard stock part, or a new one of the same
    // kind if it's an aftermarket part. The engine is always rebuilt, never junked.
    L.diagnose = function (car) {
        return L.SLOTS.map(function (slot) {
            var c = L.partCondition(car, slot);
            var partId = car.parts[slot];
            var d = { slot: slot, part: partId, condition: c, action: 'ok', cost: 0, junk: 0, fresh: 0 };
            if (slot === 'engine') {
                d.cost = L.repairCost(car);
                if (d.cost > 0) d.action = 'repair';
                return d;
            }
            var wear = L.WEAR[slot];
            var replace = wear.repair ? c < L.SHOT : c < 60;   // tires are fine until they're half bald
            if (replace) {
                d.action = 'replace';
                d.junk = wear.junk;
                d.fresh = L.PARTS[partId].price || 0;
            } else if (wear.repair && c < 95) {
                d.action = 'repair';
                d.cost = Math.max(5, Math.ceil((100 - c) * wear.repair));
            }
            return d;
        });
    };

    // Cheapest way to fix everything that needs it
    L.fixAllCost = function (car) {
        return L.diagnose(car).reduce(function (sum, d) {
            if (d.action === 'repair') return sum + d.cost;
            if (d.action === 'replace') return sum + (d.fresh && d.fresh < d.junk ? d.fresh : d.junk);
            return sum;
        }, 0);
    };

    function diagnosis(g, slot) {
        var car = L.activeCar(g);
        if (!car) return { err: 'You need a car first.' };
        var d = L.diagnose(car).filter(function (x) { return x.slot === slot; })[0];
        return d ? { car: car, d: d } : { err: 'No such part.' };
    }

    L.canRepairPart = function (g, slot) {
        if (slot === 'engine') return L.canRepair(g);
        var x = diagnosis(g, slot);
        if (x.err) return x.err;
        if (x.d.action === 'ok') return "It's fine as it is.";
        if (x.d.action === 'replace') return "It's past fixing. Replace it.";
        if (g.cash < x.d.cost) return "You can't afford the repair.";
        return null;
    };

    L.repairPart = function (g, slot) {
        if (slot === 'engine') return L.repair(g);
        var err = L.canRepairPart(g, slot);
        if (err) return err;
        var x = diagnosis(g, slot);
        g.cash -= x.d.cost;
        x.car.partCondition[slot] = 100;
        return null;
    };

    // kind: 'junk' for a used stock part, 'new' for a new one of the same aftermarket part
    L.canReplacePart = function (g, slot, kind) {
        var x = diagnosis(g, slot);
        if (x.err) return x.err;
        if (x.d.action !== 'replace') return "It doesn't need replacing.";
        if (kind === 'new' && !x.d.fresh) return 'That part is only sold used.';
        if (kind === 'junk' && slot === 'intake' && L.PARTS[x.car.parts.carb].needs) {
            return 'The ' + L.PARTS[x.car.parts.carb].name + ' needs the high-rise manifold. Buy a new one.';
        }
        if (g.cash < (kind === 'new' ? x.d.fresh : x.d.junk)) return "You can't afford it.";
        return null;
    };

    L.replacePart = function (g, slot, kind) {
        var err = L.canReplacePart(g, slot, kind);
        if (err) return err;
        var x = diagnosis(g, slot);
        if (kind === 'new') {
            g.cash -= x.d.fresh;
            x.car.partCondition[slot] = 100;
        } else {
            g.cash -= x.d.junk;
            x.car.parts[slot] = L.STOCK_PARTS[slot];
            x.car.partCondition[slot] = L.JUNK_CONDITION;
        }
        return null;
    };

    // ── Engine ────────────────────────────────────────────────────────────

    L.canRepair = function (g) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        var cost = L.repairCost(car);
        if (cost === 0) return 'The engine is in top shape.';
        if (g.cash < cost) return "You can't afford the rebuild.";
        return null;
    };

    L.repair = function (g) {
        var err = L.canRepair(g);
        if (err) return err;
        var car = L.activeCar(g);
        g.cash -= L.repairCost(car);
        car.engineCondition = 100;
        return null;
    };

    // ── Racing ────────────────────────────────────────────────────────────

    // stake: 'cash' for RIVAL_PRIZE, 'pinks' for the cars, 'fun' for a small prize and no risk
    L.canRace = function (g, rival, stake) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        if (car.engineCondition <= 0) return 'Your engine is blown. Rebuild it in the garage.';
        if (rival.king && stake !== 'pinks') return 'The King only races for pink slips.';
        if (stake === 'cash' && g.cash < L.RIVAL_PRIZE) return 'You need $' + L.RIVAL_PRIZE.toLocaleString('en-US') + ' to put up.';
        if (stake === 'fun' && rival.funDone) return rival.name + ' has had enough fun for this week.';
        return null;
    };

    L.funPrize = function (rival) { return L.FUN_PRIZE[rival.tier] || 0; };

    // Your chances against a rival, 0-1: both cars' best times, plus your launch and shifting
    // as an average player's against the rival's skill, with a spread for luck on the night
    L.odds = function (car, rival) {
        var mine = L.estimate(L.spec(car)).et + 0.35 + 0.25;
        var theirs = L.estimate(L.spec(L.rivalCar(rival))).et + 0.2 + (1 - rival.skill) * 0.4 + (1 - rival.skill) * 0.3;
        return 1 / (1 + Math.exp((mine - theirs) / 0.6));
    };

    // Settle a race. result: 'win', 'lose' or 'foul' (jumped the light, which loses).
    // A race for fun pays a small prize for a win and costs nothing to lose; the rival stays
    // at the stand for a real race but won't race for fun again this week. Every race counts
    // on your record. Returns a line for the results screen.
    L.settleRace = function (g, rivalIndex, stake, result, damage) {
        var rival = g.rivals[rivalIndex];
        var car = L.activeCar(g);
        car.engineCondition = Math.max(0, Math.round(car.engineCondition - damage));
        if (!car.partCondition) car.partCondition = {};
        car.partCondition.tires = Math.max(0, L.partCondition(car, 'tires') - randInt(2, 4));   // every launch scrubs the tires
        var blown = car.engineCondition <= 0 ? ' Your engine let go on the way.' : '';
        var why = result === 'foul' ? 'You jumped the light. ' : '';
        if (result === 'win') g.wins++; else g.losses++;

        if (stake === 'fun') {
            rival.funDone = true;
            if (result !== 'win') return why + rival.name + ' wins this one. No money on it.' + blown;
            var prize = L.funPrize(rival);
            g.cash += prize;
            return 'You beat ' + rival.name + ' and won the $' + prize + ' side bet.' + blown;
        }

        g.rivals.splice(rivalIndex, 1);
        var cash = rival.king ? L.KING_PRIZE : L.RIVAL_PRIZE;
        var cashText = '$' + cash.toLocaleString('en-US');
        if (result === 'win') {
            if (rival.king) g.kingBeaten = true;
            if (stake === 'pinks') {
                g.cash += cash;
                var won = L.makeCar(g, rival.body, L.RIVAL_BUILDS[rival.tier], 70, rival.engineCondition, wornParts(rival.engineCondition));
                var crown = rival.king ? ' You are the new King of the strip!' : '';
                if (g.cars.length < L.MAX_CARS) {
                    g.cars.push(won);
                    return 'You won ' + cashText + ' and ' + rival.name + "'s " + L.carName(won) + '!' + crown + blown;
                }
                var value = L.carValue(won);
                g.cash += value;
                return 'You won ' + cashText + ' and ' + rival.name + "'s " + L.carName(won) + ". Your garage is full, so you sold it for $" + value + '.' + crown + blown;
            }
            g.cash += cash;
            return 'You won ' + cashText + ' from ' + rival.name + '.' + blown;
        }
        if (stake === 'pinks') {
            var lost = L.carName(car);
            g.cars.splice(g.active, 1);
            g.active = g.cars.length ? 0 : -1;
            return why + rival.name + ' drives off in your ' + lost + '.';
        }
        g.cash -= cash;
        return why + 'You lost ' + cashText + ' to ' + rival.name + '.' + blown;
    };

    // ── Saving ────────────────────────────────────────────────────────────

    L.save = function (g) {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch (e) { /* private mode: play on unsaved */ }
    };

    L.load = function () {
        try {
            var raw = localStorage.getItem(SAVE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    };

    L.clearSave = function () {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to clear */ }
    };
})(window.Lemon = window.Lemon || {});

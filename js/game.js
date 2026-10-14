// Game state and rules: money, cars, parts, the classifieds and street race bets.
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

    L.makeCar = function (g, bodyId, parts, condition, engineCondition) {
        return {
            id: g.nextId++,
            body: bodyId,
            parts: Object.assign({}, L.BODIES[bodyId].parts, parts || {}),
            condition: condition,               // body and paint, 0-100: sets the resale value
            engineCondition: engineCondition    // 0-100: power, and 0 means a blown engine
        };
    };

    L.activeCar = function (g) { return g.cars[g.active] || null; };

    L.carName = function (car) { return L.BODIES[car.body].name; };

    // What a dealer pays: the body by condition, plus half of what the parts cost new
    L.carValue = function (car) {
        var body = L.BODIES[car.body];
        var value = body.price * (0.3 + 0.5 * car.condition / 100);
        L.SLOTS.forEach(function (slot) { value += (L.PARTS[car.parts[slot]].price || 0) / 2; });
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
            g.ads.push({ body: bodyId, condition: condition, engineCondition: engineCondition, price: price, note: adNote(condition, engineCondition) });
        }
        g.rivals = pickRivals(g);
    };

    function adNote(condition, engine) {
        if (engine < 50) return pick(['Runs rough. Needs work.', 'Smokes a little. Make offer.', 'Mechanic special!']);
        if (condition < 40) return pick(['Rusty but solid.', 'Needs paint. Runs good.', 'Project car, priced to sell.']);
        if (condition > 65 && engine > 75) return pick(['Cream puff! Garage kept.', 'Clean, no rust. No tire kickers.', 'One owner, runs strong.']);
        return pick(['Good driver.', 'Runs and drives.', 'Daily driver, must sell.', 'Moving, must sell!']);
    }

    // Three rivals around the player's level: wins unlock the tougher ones
    function pickRivals(g) {
        var maxTier = Math.min(L.RIVAL_BUILDS.length - 1, Math.floor(g.wins / 2) + 1);
        var pool = L.RIVALS.filter(function (r) { return r.tier <= maxTier; });
        var chosen = [];
        while (chosen.length < 3 && pool.length) {
            var r = pool.splice(Math.floor(L.random() * pool.length), 1)[0];
            var range = L.BET_RANGE[r.tier];
            chosen.push({
                name: r.name, tier: r.tier, skill: r.skill, body: r.body, line: r.line,
                bet: roundTo(rand(range[0], range[1]), 5),
                pinks: r.tier >= 1 && L.random() < 0.4,
                engineCondition: randInt(80, 100)
            });
        }
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
        g.cars.push(L.makeCar(g, ad.body, null, ad.condition, ad.engineCondition));
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
        car.parts[part.slot] = partId;
        g.inventory.splice(invIndex, 1);
        // Stock parts that came with the car are worth nothing, so they go in the bin
        if (L.PARTS[old].price) g.inventory.push(old);
        // A different engine comes with its own condition: new from the catalog
        if (part.slot === 'engine') car.engineCondition = 100;
        return null;
    };

    L.repairCost = function (car) {
        return Math.ceil((100 - car.engineCondition) * L.REPAIR_PER_POINT * (1 + (L.PARTS[car.parts.engine].price || 300) / 1000));
    };

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

    L.canRace = function (g, rival, pinks) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        if (car.engineCondition <= 0) return 'Your engine is blown. Rebuild it in the garage.';
        if (!pinks && g.cash < rival.bet) return "You can't cover the bet.";
        return null;
    };

    // Settle a race. result: 'win', 'lose' or 'foul' (jumped the light, which loses).
    // Returns a line for the results screen.
    L.settleRace = function (g, rivalIndex, pinks, result, damage) {
        var rival = g.rivals[rivalIndex];
        var car = L.activeCar(g);
        car.engineCondition = Math.max(0, Math.round(car.engineCondition - damage));
        var blown = car.engineCondition <= 0 ? ' Your engine let go on the way.' : '';
        g.rivals.splice(rivalIndex, 1);
        if (result === 'win') {
            g.wins++;
            if (pinks) {
                var won = L.makeCar(g, rival.body, L.RIVAL_BUILDS[rival.tier], 70, rival.engineCondition);
                if (g.cars.length < L.MAX_CARS) {
                    g.cars.push(won);
                    return 'You won ' + rival.name + "'s " + L.carName(won) + '!' + blown;
                }
                var value = L.carValue(won);
                g.cash += value;
                return 'You won ' + rival.name + "'s " + L.carName(won) + ". Your garage is full, so you sold it for $" + value + '.' + blown;
            }
            g.cash += rival.bet;
            return 'You won $' + rival.bet + ' from ' + rival.name + '.' + blown;
        }
        g.losses++;
        var why = result === 'foul' ? 'You jumped the light. ' : '';
        if (pinks) {
            var lost = L.carName(car);
            g.cars.splice(g.active, 1);
            g.active = g.cars.length ? 0 : -1;
            return why + rival.name + ' drives off in your ' + lost + '.';
        }
        g.cash -= rival.bet;
        return why + 'You lost $' + rival.bet + ' to ' + rival.name + '.' + blown;
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

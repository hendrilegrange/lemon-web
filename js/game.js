// Game state and rules: money, cars, parts, the classifieds and street races.
// No drawing here, so it runs in Node for tests.
(function (L) {
    'use strict';

    var SAVE_KEY = 'lemon.save.v3';   // v3: parts come in classes per engine family

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

    // How good a car is all over, 0-1: half the body, a third the engine, the rest the other parts
    L.carShape = function (car) {
        var others = L.SLOTS.filter(function (slot) { return slot !== 'engine'; });
        var parts = others.reduce(function (sum, slot) { return sum + L.partCondition(car, slot); }, 0) / others.length;
        return (0.5 * car.condition + 0.3 * car.engineCondition + 0.2 * parts) / 100;
    };

    // What a buyer pays: the body counts for little until the whole car is in shape, then a
    // restored car fetches well over its book price (so buying, restoring and selling pays),
    // plus half of what its speed parts cost new, by their condition
    L.carValue = function (car) {
        var body = L.BODIES[car.body];
        var value = body.price * (L.RESALE.junk + L.RESALE.restored * Math.pow(L.carShape(car), 3));
        L.SLOTS.forEach(function (slot) {
            value += (L.PARTS[car.parts[slot]].price || 0) / 2 * L.partCondition(car, slot) / 100;
        });
        return roundTo(value, 5);
    };

    // What the car would fetch with everything fixed
    L.restoredValue = function (car) {
        var fixed = JSON.parse(JSON.stringify(car));
        fixed.condition = 100;
        fixed.engineCondition = 100;
        fixed.partCondition = {};
        return L.carValue(fixed);
    };

    // What a car in the classifieds could become, so a buyer can tell a gem from a money pit:
    // what fixing everything costs, what it would then fetch, and its quarter mile as it sits,
    // fixed, and built with the Bestest parts for its engine family
    L.potential = function (ad) {
        var body = L.BODIES[ad.body];
        var car = { body: ad.body, parts: Object.assign({}, body.parts), condition: ad.condition,
            engineCondition: ad.engineCondition, partCondition: ad.parts || {} };
        var fixed = { body: ad.body, parts: car.parts, condition: 100, engineCondition: 100, partCondition: {} };
        var fam = L.PARTS[car.parts.engine].fam;
        var top = Object.keys(L.PARTS).filter(function (id) {
            return L.PARTS[id].slot === 'engine' && L.PARTS[id].fam === fam;
        }).sort(function (a, b) { return L.PARTS[b].cls - L.PARTS[a].cls; })[0];
        var builtParts = L.stockParts(top, { carb: 3, intake: 3, cam: 3, exhaust: 3, trans: 3, rear: 3, tires: 3 });
        var built = { body: ad.body, parts: builtParts, condition: 100, engineCondition: 100, partCondition: {} };
        var buildCost = 0;
        L.SLOTS.forEach(function (slot) { buildCost += L.PARTS[builtParts[slot]].price || 0; });
        var fix = L.fixAll(car);
        var restored = L.restoredValue(car);
        function et(c) { return L.estimate(L.spec(c)).et; }
        return {
            fixCost: fix.cost, fixHours: fix.hours, restored: restored,
            margin: restored - ad.price - fix.cost,
            asIs: et(car), fixedEt: et(fixed), builtEt: et(built),
            builtHp: Math.round(L.peakPower(L.spec(built)).hp), buildCost: buildCost,
            family: L.FAMILIES[fam].name, kg: body.kg
        };
    };

    // A new week: fresh classified ads, a restocked speed shop, a week of garage hours and
    // fresh rivals at the burger stand
    L.newWeek = function (g, first) {
        if (!first) g.week++;
        g.hours = L.HOURS_PER_WEEK;
        g.friday = false;
        g.shopStock = L.restock();
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
            parts: L.rivalParts(rival.body, rival.tier),
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

    // Strip a car for parts: the speed parts and any engine worth keeping go on the shelf as
    // they are, worn or not; stock and shot parts go in the bin and the shell goes for scrap
    L.stripValue = function (car) { return roundTo(L.BODIES[car.body].price * L.RESALE.scrap, 5); };

    L.canStrip = function (g, index) {
        if (!g.cars[index]) return 'No such car.';
        return L.needHours(g, L.STRIP_HOURS);
    };

    L.stripCar = function (g, index) {
        var err = L.canStrip(g, index);
        if (err) return err;
        var car = g.cars[index];
        var kept = [];
        L.SLOTS.forEach(function (slot) {
            var id = car.parts[slot];
            var cond = L.partCondition(car, slot);
            if (L.PARTS[id].price && cond >= L.SHOT) {
                shelve(g, id, cond);
                kept.push(L.PARTS[id].name);
            }
        });
        var scrap = L.stripValue(car);
        g.cash += scrap;
        g.hours -= L.STRIP_HOURS;
        dropCar(g, index);
        return (kept.length ? 'On the shelf: ' + kept.join(', ') + '. ' : 'Nothing worth keeping, it was all stock or shot. ') +
            'The shell went for $' + scrap + ' scrap.';
    };

    function dropCar(g, index) {
        g.cars.splice(index, 1);
        if (g.active === index) g.active = g.cars.length ? 0 : -1;
        else if (g.active > index) g.active--;
    }

    L.sellCar = function (g, index) {
        var car = g.cars[index];
        if (!car) return 'No such car.';
        g.cash += L.carValue(car);
        dropCar(g, index);
        return null;
    };

    // ── Time ──────────────────────────────────────────────────────────────

    // Why there isn't time for a job, or null if there is
    L.needHours = function (g, hours) {
        if (g.friday) return "It's Friday night. Garage work waits till next week.";
        if (g.hours < hours) return 'That takes ' + hours + ' hours and you only have ' + g.hours + ' left before Friday.';
        return null;
    };

    // Head to the burger stand: Friday night, and the garage is closed till next week
    L.goFriday = function (g) {
        g.friday = true;
        g.hours = 0;
    };

    // ── Parts ─────────────────────────────────────────────────────────────

    // The shelf: part ids in g.inventory, and each one's condition in g.shelfCond at the same
    // index (missing means new)
    function shelve(g, partId, cond) {
        if (!g.shelfCond) g.shelfCond = [];
        g.inventory.push(partId);
        g.shelfCond[g.inventory.length - 1] = cond;
    }

    function unshelve(g, invIndex) {
        var cond = L.shelfCondition(g, invIndex);
        g.inventory.splice(invIndex, 1);
        if (g.shelfCond) g.shelfCond.splice(invIndex, 1);
        return cond;
    }

    L.shelfCondition = function (g, invIndex) {
        var c = g.shelfCond && g.shelfCond[invIndex];
        return typeof c === 'number' ? c : 100;
    };

    // Half what it costs new, by its condition
    L.partValue = function (g, invIndex) {
        return Math.floor((L.PARTS[g.inventory[invIndex]].price || 0) / 2 * L.shelfCondition(g, invIndex) / 100);
    };

    // The week's shelf: each part by its class's odds, but never a week without something
    // for every engine family in every slot (and every slot that fits anything), so whatever
    // you drive there's an upgrade to buy
    L.restock = function () {
        var ids = Object.keys(L.PARTS).filter(function (id) { return L.PARTS[id].price > 0; });
        var shelf = ids.filter(function (id) { return L.random() < L.IN_STOCK[L.PARTS[id].cls]; });
        var groups = {};
        ids.forEach(function (id) {
            var p = L.PARTS[id], key = p.slot + '/' + (p.fam || '');
            (groups[key] = groups[key] || []).push(id);
        });
        Object.keys(groups).forEach(function (key) {
            var group = groups[key];
            if (group.some(function (id) { return shelf.indexOf(id) >= 0; })) return;
            // Mostly a Better part; a Best or Bestest now and then
            var weights = group.map(function (id) { return L.IN_STOCK[L.PARTS[id].cls]; });
            var r = L.random() * weights.reduce(function (a, w) { return a + w; }, 0);
            for (var i = 0; i < group.length - 1 && r >= weights[i]; i++) r -= weights[i];
            shelf.push(group[i]);
        });
        return shelf;
    };

    L.inStock = function (g, partId) { return (g.shopStock || []).indexOf(partId) >= 0; };

    // Everything the speed shop carries, with whether it's on the shelf this week and whether
    // it fits the car (every part fits when there's no car). Parts for other engine families
    // are for sale too, for a swap later.
    L.catalogFor = function (g, car) {
        return Object.keys(L.PARTS).filter(function (id) {
            return L.PARTS[id].price > 0;
        }).map(function (id) {
            return { id: id, inStock: L.inStock(g, id), fits: !car || L.fits(id, car.parts.engine) };
        });
    };

    L.buyPart = function (g, partId) {
        var part = L.PARTS[partId];
        if (!part || !part.price) return 'Not for sale.';
        if (!L.inStock(g, partId)) return 'Sold out this week.';
        if (g.cash < part.price) return "You can't afford it.";
        g.cash -= part.price;
        g.shopStock.splice(g.shopStock.indexOf(partId), 1);   // one of each on the shelf
        shelve(g, partId, 100);
        return null;
    };

    L.sellPart = function (g, invIndex) {
        var partId = g.inventory[invIndex];
        if (!partId) return 'No such part.';
        g.cash += L.partValue(g, invIndex);
        unshelve(g, invIndex);
        return null;
    };

    // Why a shelf part can't go on the active car, or null if it can
    L.canInstall = function (g, invIndex) {
        var car = L.activeCar(g);
        var partId = g.inventory[invIndex];
        if (!car) return 'You need a car first.';
        if (!partId) return 'No such part.';
        var part = L.PARTS[partId];
        if (!L.fits(partId, car.parts.engine)) {
            return 'That only fits a ' + L.FAMILIES[part.fam].name.toLowerCase() + ' engine.';
        }
        return L.needHours(g, L.JOB_HOURS[part.slot]);
    };

    // Swap a part from the shelf onto the active car; the old part goes on the shelf.
    // An engine from another family comes with its own stock carb, intake, cam and exhaust,
    // and the old ones go on the shelf too.
    L.installPart = function (g, invIndex) {
        var err = L.canInstall(g, invIndex);
        if (err) return err;
        var car = L.activeCar(g);
        var partId = g.inventory[invIndex];
        var part = L.PARTS[partId];
        var cond = unshelve(g, invIndex);
        g.hours -= L.JOB_HOURS[part.slot];
        if (!car.partCondition) car.partCondition = {};
        function takeOff(slot) {
            var old = car.parts[slot];
            var oldCond = L.partCondition(car, slot);
            // Stock parts are worth nothing, and a shot part is scrap, so they go in the bin
            if (L.PARTS[old].price && (slot === 'engine' ? oldCond > 0 : oldCond >= L.SHOT)) shelve(g, old, oldCond);
        }
        takeOff(part.slot);
        if (part.slot === 'engine') {
            if (L.PARTS[car.parts.engine].fam !== part.fam) {
                L.BOLT_ONS.forEach(function (slot) {
                    takeOff(slot);
                    car.parts[slot] = L.stockPart(partId, slot);
                    car.partCondition[slot] = 100;
                });
            }
            car.engineCondition = cond;   // a different engine comes with its own condition
        } else {
            car.partCondition[part.slot] = cond;
        }
        car.parts[part.slot] = partId;
        return null;
    };

    L.repairCost = function (car) {
        return Math.ceil((100 - car.engineCondition) * L.REPAIR_PER_POINT * (1 + (L.PARTS[car.parts.engine].basePrice || 300) / 1000));
    };

    // ── Fixing the other parts ────────────────────────────────────────────

    // What each part needs: 'ok', 'repair' (rebuild it, at cost) or 'replace' (shot, or tires,
    // which can't be repaired). replace offers a junkyard stock part, or a new one of the same
    // kind if it's an aftermarket part and the speed shop has one this week. The engine is
    // always rebuilt, never junked. hours is what the job takes.
    L.diagnose = function (car) {
        return L.SLOTS.map(function (slot) {
            var c = L.partCondition(car, slot);
            var partId = car.parts[slot];
            var d = { slot: slot, part: partId, condition: c, action: 'ok', cost: 0, junk: 0, fresh: 0,
                hours: slot === 'engine' ? L.REBUILD_HOURS : L.JOB_HOURS[slot] };
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

    // Cheapest way to fix everything that needs it, body included: dollars and hours
    L.fixAll = function (car) {
        var total = L.diagnose(car).reduce(function (sum, d) {
            if (d.action === 'repair') { sum.cost += d.cost; sum.hours += d.hours; }
            if (d.action === 'replace') { sum.cost += d.fresh && d.fresh < d.junk ? d.fresh : d.junk; sum.hours += d.hours; }
            return sum;
        }, { cost: 0, hours: 0 });
        var body = L.bodyJob(car, 100);
        total.cost += body.cost;
        total.hours += body.hours;
        return total;
    };
    L.fixAllCost = function (car) { return L.fixAll(car).cost; };

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
        return L.needHours(g, x.d.hours);
    };

    L.repairPart = function (g, slot) {
        if (slot === 'engine') return L.repair(g);
        var err = L.canRepairPart(g, slot);
        if (err) return err;
        var x = diagnosis(g, slot);
        g.cash -= x.d.cost;
        g.hours -= x.d.hours;
        x.car.partCondition[slot] = 100;
        return null;
    };

    // kind: 'junk' for a used stock part, 'new' for a new one of the same aftermarket part
    L.canReplacePart = function (g, slot, kind) {
        var x = diagnosis(g, slot);
        if (x.err) return x.err;
        if (x.d.action !== 'replace') return "It doesn't need replacing.";
        if (kind === 'new' && !x.d.fresh) return 'That part is only sold used.';
        if (kind === 'new' && !L.inStock(g, x.d.part)) return 'The speed shop is out of those this week.';
        if (g.cash < (kind === 'new' ? x.d.fresh : x.d.junk)) return "You can't afford it.";
        return L.needHours(g, x.d.hours);
    };

    L.replacePart = function (g, slot, kind) {
        var err = L.canReplacePart(g, slot, kind);
        if (err) return err;
        var x = diagnosis(g, slot);
        g.hours -= x.d.hours;
        if (kind === 'new') {
            g.cash -= x.d.fresh;
            g.shopStock.splice(g.shopStock.indexOf(x.d.part), 1);
            x.car.partCondition[slot] = 100;
        } else {
            g.cash -= x.d.junk;
            x.car.parts[slot] = L.stockPart(x.car.parts.engine, slot);
            x.car.partCondition[slot] = L.JUNK_CONDITION;
        }
        return null;
    };

    // ── Bodywork ──────────────────────────────────────────────────────────

    // Bringing the body up to target (75 to race, or 100): points, dollars, hours, and how
    // many rust spots the job shows on the bench (1-8)
    L.bodyJob = function (car, target) {
        var points = Math.max(0, target - car.condition);
        return {
            target: target,
            points: points,
            cost: Math.ceil(points * L.BODY_PER_POINT),
            hours: Math.ceil(points / L.BODY_POINTS_PER_HOUR),
            spots: Math.max(1, Math.min(8, Math.ceil(points / 10)))
        };
    };

    L.canBodywork = function (g, target) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        var job = L.bodyJob(car, target);
        if (!job.points) return 'The body is already that good.';
        if (g.cash < job.cost) return "You can't afford the bodywork.";
        return L.needHours(g, job.hours);
    };

    L.bodywork = function (g, target) {
        var err = L.canBodywork(g, target);
        if (err) return err;
        var car = L.activeCar(g);
        var job = L.bodyJob(car, target);
        g.cash -= job.cost;
        g.hours -= job.hours;
        car.condition = target;
        return null;
    };

    // ── Engine ────────────────────────────────────────────────────────────

    L.canRepair = function (g) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        var cost = L.repairCost(car);
        if (cost === 0) return 'The engine is in top shape.';
        if (g.cash < cost) return "You can't afford the rebuild.";
        return L.needHours(g, L.REBUILD_HOURS);
    };

    L.repair = function (g) {
        var err = L.canRepair(g);
        if (err) return err;
        var car = L.activeCar(g);
        g.cash -= L.repairCost(car);
        g.hours -= L.REBUILD_HOURS;
        car.engineCondition = 100;
        return null;
    };

    // ── Racing ────────────────────────────────────────────────────────────

    // A cash race is all your cash, up to RIVAL_PRIZE, against the same from the rival
    L.cashBet = function (g) { return Math.min(Math.max(0, g.cash), L.RIVAL_PRIZE); };

    // stake: 'cash' for cashBet, 'pinks' for the cars only (The King adds KING_PRIZE),
    // 'fun' for a small prize and no risk
    L.canRace = function (g, rival, stake) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        if (car.engineCondition <= 0) return 'Your engine is blown. Rebuild it in the garage.';
        if (car.condition < L.MIN_BODY) return 'Nobody races a rust bucket. Get the body to ' + L.MIN_BODY + '% first.';
        if (rival.king && stake !== 'pinks') return 'The King only races for pink slips.';
        if (stake === 'cash' && L.cashBet(g) < L.MIN_BET) return 'You need at least $' + L.MIN_BET + ' to bet.';
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
        // Every race wears the car a little: the body, each part, and the tires most of all
        if (!car.partCondition) car.partCondition = {};
        car.condition = Math.max(0, car.condition - randInt(1, 3));
        L.SLOTS.forEach(function (slot) {
            if (slot !== 'engine') car.partCondition[slot] = Math.max(0, L.partCondition(car, slot) - (slot === 'tires' ? randInt(2, 4) : randInt(0, 2)));
        });
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
        var cash = stake === 'pinks' ? (rival.king ? L.KING_PRIZE : 0) : L.cashBet(g);
        var cashText = '$' + cash.toLocaleString('en-US');
        if (result === 'win') {
            if (rival.king) g.kingBeaten = true;
            if (stake === 'pinks') {
                g.cash += cash;
                var prize = cash ? cashText + ' and ' : '';
                var won = L.makeCar(g, rival.body, L.rivalParts(rival.body, rival.tier), 80, rival.engineCondition, wornParts(rival.engineCondition));
                var crown = rival.king ? ' You are the new King of the strip!' : '';
                if (g.cars.length < L.MAX_CARS) {
                    g.cars.push(won);
                    return 'You won ' + prize + rival.name + "'s " + L.carName(won) + '!' + crown + blown;
                }
                var value = L.carValue(won);
                g.cash += value;
                return 'You won ' + prize + rival.name + "'s " + L.carName(won) + ". Your garage is full, so you sold it for $" + value + '.' + crown + blown;
            }
            g.cash += cash;
            return 'You won ' + cashText + ' from ' + rival.name + '.' + blown;
        }
        if (stake === 'pinks') {
            var lost = L.carName(car);
            dropCar(g, g.active);
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

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
        var g = { cash: L.START_CASH, week: 1, era: 0, cars: [], active: -1, inventory: [], wins: 0, losses: 0, nextId: 1, streak: 0 };
        L.records(g);
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
        var shape = Math.pow(L.carShape(car), 3);
        var value = body.price * (L.RESALE.junk + L.RESALE.restored * shape) + L.RESALE.classic * shape;
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
        var car = { body: ad.body, parts: Object.assign({}, L.BODIES[ad.body].parts), condition: ad.condition,
            engineCondition: ad.engineCondition, partCondition: ad.parts || {} };
        return outlook(car, ad.price);
    };

    // The same once-over for a car you own: what it costs to fix, what it would fetch then
    // and how much that beats selling it as it is (margin), and its quarter mile now, fixed
    // and built, the build costing only the Bestest parts it doesn't have yet
    L.carPotential = function (car) {
        return outlook(car, L.carValue(car));
    };

    // "Built" is the quickest of two builds: the Bestest parts for the engine family on the car
    // now, and for the family the body came with, so swapping in another engine never makes the
    // built time worse. Parts already on the car that beat Bestest (Bestest+, Legendary) stay.
    function outlook(car, price) {
        var fixed = { body: car.body, parts: car.parts, condition: 100, engineCondition: 100, partCondition: {} };
        function et(c) { return L.estimate(L.spec(c)).et; }
        var fams = [L.PARTS[car.parts.engine].fam, L.PARTS[L.BODIES[car.body].parts.engine].fam];
        var best = null;
        fams.forEach(function (fam) {
            var b = buildFor(car, fam);
            b.et = et(b.car);
            if (!best || b.et < best.et) best = b;
        });
        var built = best.car, buildCost = best.cost, fam = best.fam;
        var fix = L.fixAll(car);
        var restored = L.restoredValue(car);
        return {
            fixCost: fix.cost, fixHours: fix.hours, restored: restored,
            margin: restored - price - fix.cost,
            asIs: et(car), fixedEt: et(fixed), builtEt: best.et,
            builtHp: Math.round(L.peakPower(L.spec(built)).hp), buildCost: buildCost,
            family: L.FAMILIES[fam].name, kg: L.BODIES[car.body].kg
        };
    }

    // A car built with the Bestest parts for an engine family, keeping any Bestest+ or Legendary
    // part on it made from the Bestest it would get, and what the parts it doesn't have yet cost
    function buildFor(car, fam) {
        var top = Object.keys(L.PARTS).filter(function (id) {
            return L.PARTS[id].slot === 'engine' && L.PARTS[id].fam === fam && L.PARTS[id].cls <= 3;
        }).sort(function (a, b) { return L.PARTS[b].cls - L.PARTS[a].cls; })[0];
        var have = L.PARTS[car.parts.engine];
        if (have.fam === fam && have.cls > 3) top = car.parts.engine;
        var parts = L.stockParts(top, { carb: 3, intake: 3, cam: 3, exhaust: 3, trans: 3, rear: 3, tires: 3 });
        var cost = 0;
        L.SLOTS.forEach(function (slot) {
            var mine = car.parts[slot];
            if (slot !== 'engine' && L.PARTS[mine].cls > 3 && mine.replace(/_[45]$/, '') === parts[slot].replace(/_3$/, '')) parts[slot] = mine;
            if (parts[slot] !== mine) cost += L.PARTS[parts[slot]].price || 0;
        });
        return { car: { body: car.body, parts: parts, condition: 100, engineCondition: 100, partCondition: {} }, cost: cost, fam: fam };
    }

    // How a car looks: its paint (the factory colour until the paint shop changes it) and
    // its livery with the livery's trim colour
    L.carColor = function (car) {
        return car.paint && L.PAINTS[car.paint] ? L.PAINTS[car.paint].hex : L.BODIES[car.body].color;
    };
    // How a rival's car looks at the stand and on the strip: the factory paint, a stripe or a
    // number on the quick ones, and The King's black car with flames
    L.rivalLook = function (rival) {
        var shape = L.BODIES[rival.body].shape;
        if (rival.king) return { color: L.PAINTS.black.hex, livery: 'flames', trim: '#f2f2ea', shape: shape };
        var livery = rival.tier >= 4 ? 'number' : rival.tier >= 2 ? 'stripes' : null;
        return { color: L.BODIES[rival.body].color, livery: livery, trim: '#f2f2ea', shape: shape };
    };
    // A King's livery (flames) is locked in the paint shop until you've beaten a King: the
    // game moves past 1963 the week after, and g.kingBeaten covers the week in between
    L.beatAKing = function (g) { return L.eraOf(g) > 0 || !!g.kingBeaten; };
    L.liveryLocked = function (g, livery) { return !!(L.LIVERIES[livery] && L.LIVERIES[livery].king) && !L.beatAKing(g); };
    L.carLook = function (car) {
        var livery = car.livery && L.LIVERIES[car.livery] && car.livery !== 'none' ? car.livery : null;
        return { color: L.carColor(car), livery: livery, trim: L.PAINTS[car.trim] ? L.PAINTS[car.trim].hex : '#f2f2ea', shape: L.BODIES[car.body].shape };
    };

    // What a paint shop job costs: the paint if the colour changes, the livery if it or its
    // trim changes. paint is a L.PAINTS id or null to keep the colour.
    L.paintCost = function (car, paint, livery, trim) {
        var cost = 0;
        if (paint && paint !== car.paint) cost += L.PAINTS[paint].price;
        var oldLivery = car.livery || 'none';
        var trimMatters = livery !== 'none' && !L.LIVERIES[livery].ownColors;
        if (livery !== oldLivery || (trimMatters && trim !== car.trim)) cost += L.LIVERIES[livery].price;
        return cost;
    };

    L.canPaint = function (g, paint, livery, trim) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        if (paint && !L.PAINTS[paint]) return 'No such paint.';
        if (!L.LIVERIES[livery]) return 'No such livery.';
        if (livery !== (car.livery || 'none') && L.liveryLocked(g, livery)) return L.LIVERIES[livery].name + " are The King's. Beat him first.";
        if (livery !== 'none' && !L.LIVERIES[livery].ownColors && !L.PAINTS[trim]) return 'Pick a colour for the ' + L.LIVERIES[livery].name.toLowerCase() + '.';
        if (car.condition < L.MIN_BODY) return "Paint won't stick to rust. Get the body to " + L.MIN_BODY + '% first.';
        var cost = L.paintCost(car, paint, livery, trim);
        if (!cost && (livery === (car.livery || 'none')) && (!paint || paint === car.paint)) return "That's how she looks already.";
        if (g.cash < cost) return "You can't afford that paint job.";
        return null;
    };

    L.paintCar = function (g, paint, livery, trim) {
        var err = L.canPaint(g, paint, livery, trim);
        if (err) return err;
        var car = L.activeCar(g);
        g.cash -= L.paintCost(car, paint, livery, trim);
        if (paint) car.paint = paint;
        car.livery = livery;
        if (livery !== 'none' && !L.LIVERIES[livery].ownColors) car.trim = trim;
        return null;
    };

    // A new week: fresh classified ads, a restocked speed shop, a week of garage hours and
    // fresh rivals at the burger stand. The week after you beat The King, the next era
    // arrives (g.newEra says so once): its cars, its parts and its rivals join the ones
    // already here, its rivals starting from the easy ones again. Your cash, cars and shelf
    // come with you.
    L.newWeek = function (g, first) {
        if (!first) g.week++;
        if (!first && g.kingBeaten && L.ERAS[L.eraOf(g) + 1]) {
            g.era = L.eraOf(g) + 1;
            g.kingBeaten = false;
            g.eraWins = 0;
            g.newEra = true;
        }
        var era = L.eraOf(g);
        g.hours = L.HOURS_PER_WEEK;
        g.friday = false;
        g.shopStock = L.restock(era);
        g.ads = [];
        // Five different cars, so a week's paper isn't all one kind: mostly this era's, and
        // two from earlier eras once there are any
        var now = Object.keys(L.BODIES).filter(function (id) { return L.BODIES[id].era === era; });
        var older = Object.keys(L.BODIES).filter(function (id) { return L.BODIES[id].era < era; });
        for (var i = 0; i < 5; i++) {
            var from = older.length && i >= 3 ? older : now;
            var bodyId = from.splice(Math.floor(L.random() * from.length), 1)[0];
            var body = L.BODIES[bodyId];
            var condition = randInt(10, 75);        // scrappy used cars: rust, dents and tired engines
            var engineCondition = randInt(25, 90);
            var price = roundTo(body.price * (0.35 + 0.65 * condition / 100) * (0.7 + 0.3 * engineCondition / 100) * rand(0.8, 1.4), 10);
            g.ads.push({ body: bodyId, condition: condition, engineCondition: engineCondition, parts: wornParts(engineCondition), price: price, note: adNote(condition, engineCondition) });
        }
        // There is always a cheap beater, so a broke player can get back on the road
        var m = L.ERAS[era].money;
        if (!g.ads.some(function (ad) { return ad.price <= 200 * m; })) {
            var beater = g.ads[4];
            beater.condition = randInt(8, 20);
            beater.engineCondition = randInt(25, 40);
            beater.parts = wornParts(beater.engineCondition);
            beater.price = roundTo(rand(120, 200) * m, 10);
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

    // Wins in this era: they unlock its rivals and its King. A game from before eras counts
    // every win.
    L.eraWins = function (g) { return typeof g.eraWins === 'number' ? g.eraWins : g.wins; };

    // What an era's money makes of a 1963 dollar amount
    function eraMoney(era, dollars) { return Math.round(dollars * L.ERAS[era || 0].money / 50) * 50 || dollars; }
    // The most a cash race bets: by the rival's era, or the current one
    L.rivalPrize = function (g, rival) { return eraMoney(rival ? rival.era : L.eraOf(g), L.RIVAL_PRIZE); };
    L.kingPrize = function (g) { return eraMoney(L.eraOf(g), L.KING_PRIZE); };

    // Three of this era's rivals around the player's level: wins unlock the tougher ones. Once
    // you're past 1963 one rival from an earlier era hangs around too, any of them. The era's
    // King joins them once you've won enough races in it, until you beat him.
    function pickRivals(g) {
        var era = L.eraOf(g);
        var maxTier = Math.min(4, Math.floor(L.eraWins(g) / 2));
        var pool = L.RIVALS.filter(function (r) { return r.era === era && r.tier <= maxTier; });
        var older = L.RIVALS.filter(function (r) { return r.era < era; });
        var chosen = [];
        function add(r) {
            chosen.push({
                name: r.name, tier: r.tier, skill: r.skill, body: r.body, line: r.line, era: r.era,
                king: r.tier === 5, funDone: false,
                engineCondition: r.tier === 0 ? randInt(45, 75) : randInt(75, 100)   // the first rivals drive junkers too
            });
        }
        while (chosen.length < 3 && pool.length) add(pool.splice(Math.floor(L.random() * pool.length), 1)[0]);
        if (older.length) add(pick(older));
        if (L.eraWins(g) >= L.KING_WINS && !g.kingBeaten) add(L.KINGS[era]);
        return chosen;
    }

    L.rivalCar = function (rival) {
        return {
            body: rival.body,
            parts: L.rivalParts(rival.body, rival.tier, rival.era),
            condition: 70,
            engineCondition: rival.engineCondition
        };
    };

    // ── Buying and selling cars ──────────────────────────────────────────

    // The dealership: every car from the eras you've reached, newest era first, brand new
    // and stock. It opens once you've beaten a King.
    L.dealerCars = function (g) {
        var era = L.eraOf(g);
        return Object.keys(L.BODIES).filter(function (id) { return (L.BODIES[id].era || 0) <= era; })
            .sort(function (a, b) { return (L.BODIES[b].era || 0) - (L.BODIES[a].era || 0) || L.BODIES[a].price - L.BODIES[b].price; });
    };
    L.newCar = function (bodyId) {
        return { body: bodyId, parts: Object.assign({}, L.BODIES[bodyId].parts), condition: 100, engineCondition: 100, partCondition: {} };
    };
    L.newCarPrice = function (bodyId) { return roundTo(L.carValue(L.newCar(bodyId)) * L.NEW_CAR_PRICE, 50); };

    L.canBuyNew = function (g, bodyId) {
        if (!L.beatAKing(g)) return 'Beat The King to open the dealership.';
        if (L.dealerCars(g).indexOf(bodyId) < 0) return "The dealer doesn't sell that one.";
        if (g.cars.length >= L.MAX_CARS) return 'Your garage is full. Sell a car first.';
        if (g.cash < L.newCarPrice(bodyId)) return "You can't afford it.";
        return null;
    };

    L.buyNew = function (g, bodyId) {
        var err = L.canBuyNew(g, bodyId);
        if (err) return err;
        g.cash -= L.newCarPrice(bodyId);
        g.cars.push(L.makeCar(g, bodyId, null, 100, 100));
        if (g.active < 0) g.active = g.cars.length - 1;
        return null;
    };

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

    // Half what it costs new, by its condition. A stock part fetches half its junkyard price.
    L.partValue = function (g, invIndex) {
        var part = L.PARTS[g.inventory[invIndex]];
        var whole = part.price || (part.slot === 'engine' ? L.JUNK_ENGINE : L.WEAR[part.slot].junk);
        return Math.floor(whole / 2 * L.shelfCondition(g, invIndex) / 100);
    };

    // A repair or rebuild takes the job's full hours for a part worn right out, and less the
    // less worn it is: by the condition missing, at least an hour. Swapping a part takes the
    // full hours whatever its state.
    L.repairHours = function (fullHours, condition) {
        return Math.max(1, Math.ceil(fullHours * (100 - condition) / 100));
    };

    // Rebuilding a worn part on the shelf, a way to use spare hours: { cost, hours }, priced
    // like the same job on a car, or null when it can't be (tires, or already like new)
    L.shelfRebuild = function (g, invIndex) {
        var partId = g.inventory[invIndex];
        if (!partId) return null;
        var part = L.PARTS[partId], c = L.shelfCondition(g, invIndex);
        if (c >= 100) return null;
        if (part.slot === 'engine') return { cost: engineRebuildCost(partId, c), hours: L.repairHours(L.REBUILD_HOURS, c) };
        var wear = L.WEAR[part.slot];
        if (!wear.repair) return null;
        return { cost: Math.max(5, Math.ceil((100 - c) * wear.repair)), hours: L.repairHours(L.JOB_HOURS[part.slot], c) };
    };

    L.canRebuildShelf = function (g, invIndex) {
        if (!g.inventory[invIndex]) return 'No such part.';
        var job = L.shelfRebuild(g, invIndex);
        if (!job) return L.shelfCondition(g, invIndex) >= 100 ? "It's like new." : "Tires can't be rebuilt.";
        if (g.cash < job.cost) return "You can't afford the rebuild.";
        return L.needHours(g, job.hours);
    };

    L.rebuildShelf = function (g, invIndex) {
        var err = L.canRebuildShelf(g, invIndex);
        if (err) return err;
        var job = L.shelfRebuild(g, invIndex);
        g.cash -= job.cost;
        g.hours -= job.hours;
        if (!g.shelfCond) g.shelfCond = [];
        g.shelfCond[invIndex] = 100;
        return null;
    };

    // The week's shelf: each part by its class's odds, but never a week without something
    // for every engine family in every slot (and every slot that fits anything), so whatever
    // you drive there's an upgrade to buy
    L.restock = function (era) {
        era = era || 0;
        var ids = Object.keys(L.PARTS).filter(function (id) { return L.PARTS[id].price > 0 && L.PARTS[id].era <= era; });
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
        // Now and then a Legendary part turns up
        if (L.random() < L.LEGEND_ODDS) {
            var legends = ids.filter(function (id) { return L.PARTS[id].legend; });
            shelf.push(legends[Math.floor(L.random() * legends.length)]);
        }
        return shelf;
    };

    L.inStock = function (g, partId) { return (g.shopStock || []).indexOf(partId) >= 0; };

    // Everything the speed shop carries, with whether it's on the shelf this week and whether
    // it fits the car (every part fits when there's no car). Parts for other engine families
    // are for sale too, for a swap later. A Legendary part shows only the week it turns up.
    // The shop carries the parts of every era so far.
    L.catalogFor = function (g, car) {
        var era = L.eraOf(g);
        return Object.keys(L.PARTS).filter(function (id) {
            return L.PARTS[id].price > 0 && L.PARTS[id].era <= era && (!L.PARTS[id].legend || L.inStock(g, id));
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

    // Swap a part from the shelf onto the active car; the old part goes on the shelf, stock or
    // not, so it can go back on or onto another car (a shot part or a blown engine is binned).
    // An engine from another family comes with its own stock carb, intake, cam and exhaust,
    // and the old ones go on the shelf too. out, if given, gets the names of the parts
    // shelved and binned.
    L.installPart = function (g, invIndex, out) {
        var err = L.canInstall(g, invIndex);
        if (err) return err;
        var car = L.activeCar(g);
        var partId = g.inventory[invIndex];
        var part = L.PARTS[partId];
        var cond = unshelve(g, invIndex);
        g.hours -= L.JOB_HOURS[part.slot];
        if (!car.partCondition) car.partCondition = {};
        out = out || {};
        out.shelved = []; out.binned = [];
        function takeOff(slot) {
            var old = car.parts[slot];
            var oldCond = L.partCondition(car, slot);
            if (slot === 'engine' ? oldCond > 0 : oldCond >= L.SHOT) {
                shelve(g, old, oldCond);
                out.shelved.push(L.PARTS[old].name);
            } else {
                out.binned.push(L.PARTS[old].name);
            }
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

    function engineRebuildCost(engineId, condition) {
        return Math.ceil((100 - condition) * L.REPAIR_PER_POINT * (1 + (L.PARTS[engineId].basePrice || 300) / 1000));
    }

    L.repairCost = function (car) { return engineRebuildCost(car.parts.engine, car.engineCondition); };

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
                d.hours = L.repairHours(L.REBUILD_HOURS, c);
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
                d.hours = L.repairHours(d.hours, c);
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

    // Fix all: every job on the active car at once, body restored to 100, skipping the
    // workbench. It's yours once you've beaten a King. A shot part gets a new one when the
    // speed shop has it for less than a used one, or a used stock part. { cost, hours, jobs }
    L.fixAllPlan = function (g) {
        var car = L.activeCar(g);
        var plan = { cost: 0, hours: 0, jobs: [] };
        if (!car) return plan;
        L.diagnose(car).forEach(function (d) {
            if (d.action === 'repair') {
                plan.jobs.push({ slot: d.slot, how: 'repair' });
                plan.cost += d.cost;
            } else if (d.action === 'replace') {
                var fresh = d.fresh && d.fresh < d.junk && L.inStock(g, d.part);
                plan.jobs.push({ slot: d.slot, how: fresh ? 'new' : 'junk' });
                plan.cost += fresh ? d.fresh : d.junk;
            } else return;
            plan.hours += d.hours;
        });
        var body = L.bodyJob(car, 100);
        if (body.points) { plan.jobs.push({ body: true }); plan.cost += body.cost; plan.hours += body.hours; }
        return plan;
    };

    L.canFixAll = function (g) {
        if (!L.activeCar(g)) return 'You need a car first.';
        if (!L.beatAKing(g)) return 'Beat The King to unlock Fix all.';
        var plan = L.fixAllPlan(g);
        if (!plan.jobs.length) return 'Everything is in good shape.';
        if (g.cash < plan.cost) return "You can't afford to fix it all. Pick the jobs that matter.";
        return L.needHours(g, plan.hours);
    };

    L.fixEverything = function (g) {
        var err = L.canFixAll(g);
        if (err) return err;
        var e = null;
        L.fixAllPlan(g).jobs.forEach(function (j) {
            e = e || (j.body ? L.bodywork(g, 100) : j.how === 'repair' ? L.repairPart(g, j.slot) : L.replacePart(g, j.slot, j.how));
        });
        return e;
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
        return L.needHours(g, L.repairHours(L.REBUILD_HOURS, car.engineCondition));
    };

    L.repair = function (g) {
        var err = L.canRepair(g);
        if (err) return err;
        var car = L.activeCar(g);
        g.cash -= L.repairCost(car);
        g.hours -= L.repairHours(L.REBUILD_HOURS, car.engineCondition);
        car.engineCondition = 100;
        return null;
    };

    // ── Racing ────────────────────────────────────────────────────────────

    // A cash race bets what you pick, from MIN_BET up to all your cash or RIVAL_PRIZE in the
    // rival's era's money, whichever is less, against the same from the rival. cashBet is
    // the most you can bet; betStep the slider's step; betAmount a pick kept in bounds.
    L.cashBet = function (g, rival) { return Math.min(Math.max(0, g.cash), L.rivalPrize(g, rival)); };
    L.betStep = function (g, rival) { return Math.max(L.MIN_BET, Math.round(L.rivalPrize(g, rival) / 20 / 50) * 50); };
    L.betAmount = function (g, rival, want) {
        var max = L.cashBet(g, rival);
        if (want == null || isNaN(want)) return max;
        return Math.min(max, Math.max(L.MIN_BET, Math.round(want)));
    };

    // stake: 'cash' for a bet, 'pinks' for the cars only (The King adds KING_PRIZE),
    // 'fun' for a small prize and no risk
    L.canRace = function (g, rival, stake) {
        var car = L.activeCar(g);
        if (!car) return 'You need a car first.';
        if (car.engineCondition <= 0) return 'Your engine is blown. Rebuild it in the garage.';
        if (car.condition < L.MIN_BODY) return 'Nobody races a rust bucket. Get the body to ' + L.MIN_BODY + '% first.';
        if (rival.king && stake !== 'pinks') return 'The King only races for pink slips.';
        if (stake === 'cash' && L.cashBet(g, rival) < L.MIN_BET) return 'You need at least $' + L.MIN_BET + ' to bet.';
        if (stake === 'fun' && rival.funDone) return rival.name + ' has had enough fun for this week.';
        return null;
    };

    L.funPrize = function (rival) { return Math.round((L.FUN_PRIZE[rival.tier] || 0) * L.ERAS[rival.era || 0].money / 5) * 5; };

    // Your chances against a rival, 0-1: both cars' best times, plus your launch and shifting
    // as an average player's against the rival's skill, with a spread for luck on the night
    L.odds = function (car, rival) {
        var mine = L.estimate(L.spec(car)).et + 0.35 + 0.25;
        var theirs = L.estimate(L.spec(L.rivalCar(rival))).et + 0.2 + (1 - rival.skill) * 0.4 + (1 - rival.skill) * 0.3;
        return 1 / (1 + Math.exp((mine - theirs) / 0.6));
    };

    // Wear on a part of this car, slowed by its class (L.WEAR_RATE): points in, points out
    L.wear = function (car, slot, points) {
        var part = L.PARTS[car.parts[slot]];
        return points * (L.WEAR_RATE[part ? part.cls : 0] || 1);
    };

    // A car's build by its parts: the class most of them are (ties go to the better class), so
    // a car on mostly Best parts is a Best car. 'king' for a car won from a King.
    L.carTier = function (car) {
        if (car.king) return 'king';
        // A King's car won before cars kept that: still his own body and parts
        var was = L.KINGS.filter(function (k) {
            if (k.body !== car.body) return false;
            var parts = L.rivalParts(k.body, 5, k.era);
            return L.SLOTS.every(function (slot) { return car.parts[slot] === parts[slot]; });
        })[0];
        if (was) { car.king = was.name; return 'king'; }
        var count = [0, 0, 0, 0, 0, 0];
        L.SLOTS.forEach(function (slot) { var p = L.PARTS[car.parts[slot]]; if (p) count[p.cls]++; });
        var best = 0;
        count.forEach(function (n, cls) { if (n && n >= count[best]) best = cls; });
        return best;
    };

    // Settle a race. result: 'win', 'lose' or 'foul' (jumped the light, which loses).
    // A race for fun pays a small prize for a win and costs nothing to lose; the rival stays
    // at the stand for a real race but won't race for fun again this week. Every race counts
    // on your record. bet is a cash race's stake (all you can bet if left out). Returns a line
    // for the results screen.
    L.settleRace = function (g, rivalIndex, stake, result, damage, bet) {
        var rival = g.rivals[rivalIndex];
        var car = L.activeCar(g);
        car.engineCondition = Math.max(0, Math.round(car.engineCondition - L.wear(car, 'engine', damage)));
        // Every race wears the car a little: the body, each part, and the tires most of all
        if (!car.partCondition) car.partCondition = {};
        car.condition = Math.max(0, car.condition - randInt(1, 3));
        L.SLOTS.forEach(function (slot) {
            if (slot !== 'engine') car.partCondition[slot] = Math.max(0, L.partCondition(car, slot) - Math.floor(L.wear(car, slot, slot === 'tires' ? randInt(2, 4) : randInt(0, 2)) + L.random()));
        });
        var blown = car.engineCondition <= 0 ? ' Your engine let go on the way.' : '';
        var why = result === 'foul' ? 'You jumped the light. ' : '';
        if (result === 'win') { g.wins++; if (typeof g.eraWins === 'number') g.eraWins++; } else g.losses++;

        if (stake === 'fun') {
            rival.funDone = true;
            if (result !== 'win') return why + rival.name + ' wins this one. No money on it.' + blown;
            var prize = L.funPrize(rival);
            g.cash += prize;
            return 'You beat ' + rival.name + ' and won the $' + prize + ' side bet.' + blown;
        }

        g.rivals.splice(rivalIndex, 1);
        var cash = stake === 'pinks' ? (rival.king ? L.kingPrize(g) : 0) : L.betAmount(g, rival, bet);
        var cashText = '$' + cash.toLocaleString('en-US');
        if (result === 'win') {
            if (rival.king) {
                g.kingBeaten = true;
                var rec = L.records(g), kingKey = 'k' + (rival.era || 0);    // fewest weeks to beat this era's King
                if (typeof rec[kingKey] !== 'number' || g.week < rec[kingKey]) rec[kingKey] = g.week;
            }
            if (stake === 'pinks') {
                g.cash += cash;
                var prize = cash ? cashText + ' and ' : '';
                var won = L.makeCar(g, rival.body, L.rivalParts(rival.body, rival.tier, rival.era), 80, rival.engineCondition, wornParts(rival.engineCondition));
                if (rival.king) {                           // a King's car, shown in gold in the garage, in his black and flames
                    won.king = rival.name;
                    won.paint = 'black';
                    won.livery = 'flames';
                }
                var next = L.ERAS[L.eraOf(g) + 1];
                var crown = !rival.king ? '' : ' You are the new King of the strip!' +
                    (next ? ' Next week it\'s ' + next.year + ', and there\'s a new crowd at the burger stand.'
                        : ' From ' + L.ERAS[0].year + ' to ' + L.ERAS[L.eraOf(g)].year + ', you beat every King there was.');
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

    // ── Records ───────────────────────────────────────────────────────────
    // The player's bests for the leaderboards: quickest quarter mile (et) and reaction time
    // (rt) in seconds, longest win streak, the most cash ever on hand, and the fewest weeks
    // from a new game to beating each era's King (k0 to k5, set in settleRace). g.streak is
    // the current run of wins.

    L.records = function (g) {
        if (!g.records) g.records = { et: null, rt: null, streak: 0, cash: g.cash };
        return g.records;
    };

    // After a race: et is the player's quarter mile from the green light (null if they didn't
    // finish or jumped the light), reaction from green to launch. Returns the records it beat.
    L.noteRace = function (g, result, et, reaction) {
        var r = L.records(g), beat = [];
        if (result === 'win') {
            g.streak = (g.streak || 0) + 1;
            if (g.streak > r.streak) { r.streak = g.streak; if (g.streak > 1) beat.push('streak'); }
        } else {
            g.streak = 0;
        }
        if (result !== 'foul') {
            if (typeof et === 'number' && et > 0 && (r.et === null || et < r.et)) { r.et = Math.round(et * 1000) / 1000; beat.push('et'); }
            if (typeof reaction === 'number' && reaction >= 0 && (r.rt === null || reaction < r.rt)) { r.rt = Math.round(reaction * 1000) / 1000; beat.push('rt'); }
        }
        return beat;
    };

    // ── Saving ────────────────────────────────────────────────────────────

    L.save = function (g) {
        var r = L.records(g);
        if (g.cash > r.cash) r.cash = g.cash;
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch (e) { /* private mode: play on unsaved */ }
    };

    L.load = function () {
        try {
            var raw = localStorage.getItem(SAVE_KEY);
            return raw ? L.fixSave(JSON.parse(raw)) : null;
        } catch (e) {
            return null;
        }
    };

    // Brings an older save up to date. A King's car won before it kept his paint gets his
    // black and flames (unless you've painted it since). Flames bought before they were The
    // King's come off any car of a player who hasn't beaten a King, and the paint shop refunds
    // them; g.notice says so once, on the next screen.
    L.fixSave = function (g) {
        if (!g || !g.cars) return g;
        g.cars.forEach(function (c) {
            if (L.carTier(c) === 'king' && !c.paint && !c.livery) { c.paint = 'black'; c.livery = 'flames'; }
        });
        if (!L.beatAKing(g)) {
            var refund = 0;
            g.cars.forEach(function (c) {
                if (c.livery === 'flames' && !c.king) { c.livery = 'none'; refund += L.LIVERIES.flames.price; }
            });
            if (refund) {
                g.cash += refund;
                g.notice = "Flames are The King's now, and you have to beat him to wear them. Sal took yours off and refunded you $" + refund.toLocaleString('en-US') + '.';
            }
        }
        return g;
    };

    L.clearSave = function () {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to clear */ }
    };
})(window.Lemon = window.Lemon || {});

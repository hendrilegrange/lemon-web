// Game data: car bodies, parts and rivals. The game starts in the summer of 1963, and each
// King you beat moves it on to the next era (L.ERAS), with its own cars, parts and rivals at
// that era's prices. Numbers are our own, tuned to feel like the original rather than copied from it.
(function (L) {
    'use strict';

    // Eras: the summer the game is in, a tag for its part ids (none for the first), what its
    // dollars are worth against 1963's (prizes scale by it), and the news when it arrives
    L.ERAS = [
        { year: 1963, tag: '', money: 1, name: 'Summer of 1963' },
        { year: 1973, tag: '70', money: 2.5, name: 'Summer of 1973',
          intro: "It's 1973. The hot rods are gone from the burger stand: now it's muscle cars, big-block V8s and a new King. Your cash and your cars came with you." }
    ];
    L.eraOf = function (g) { return Math.min(g.era || 0, L.ERAS.length - 1); };

    // Every part fills one slot on a car. Engines carry the base torque curve (lb-ft at tqRpm)
    // and redline; bolt-ons multiply torque (tq), move the torque peak (rpm) and redline.
    // Transmissions carry gear ratios, rear ends the final drive, tires the grip (mu).
    L.SLOTS = ['engine', 'carb', 'intake', 'cam', 'exhaust', 'trans', 'rear', 'tires'];

    L.SLOT_NAMES = {
        engine: 'Engine', carb: 'Carburetor', intake: 'Intake', cam: 'Camshaft',
        exhaust: 'Exhaust', trans: 'Transmission', rear: 'Rear end', tires: 'Tires'
    };

    // Every part comes in four classes. Stock is what a car leaves the factory with; the
    // speed shop sells the other three, though not every class is in stock every week.
    // Above those, Bestest+ (class 4) only just beats Bestest for five times the money, and
    // Legendary parts (class 5) turn up now and then: as quick as Bestest+, twice the price
    // again, and each one on the car widens the green shift zone. Both are there to spend
    // the winnings of a car that's already built.
    L.CLASSES = ['Stock', 'Better', 'Best', 'Bestest', 'Bestest+', 'Legendary'];

    // Engines belong to a family, and carbs, intakes, cams and exhausts only fit their own
    // family's engines. Transmissions, rear ends and tires fit anything.
    // Each family belongs to an era; the speed shop only carries the current era's.
    L.FAMILIES = {
        flat:  { name: 'Flathead', price: 0.8, era: 0 },
        six:   { name: 'Chevy six', price: 0.7, era: 0 },
        small: { name: 'Small-block', price: 1, era: 0 },
        big:   { name: 'Big-block', price: 1.4, era: 0 },
        gm70:    { name: 'Chevy V8', price: 1, era: 1 },
        ford70:  { name: 'Ford V8', price: 1, era: 1 },
        mopar70: { name: 'Mopar V8', price: 1.1, era: 1 }
    };
    L.BOLT_ONS = ['carb', 'intake', 'cam', 'exhaust'];

    L.PARTS = {
        // Engines: any engine bolts into any car, as long as you have the hours. Every family
        // has a Better, Best and Bestest engine, so a flathead or six car can go faster and keep
        // its bolt-ons.
        flathead: { slot: 'engine', fam: 'flat', cls: 0, name: 'Ford flathead V8, 239 ci', price: 0, tqLbft: 190, tqRpm: 2000, redline: 4200, kg: 250 },
        flat255:  { slot: 'engine', fam: 'flat', cls: 1, name: 'Mercury flathead V8, 255 ci', price: 180, tqLbft: 215, tqRpm: 2200, redline: 4400, kg: 250 },
        flat276:  { slot: 'engine', fam: 'flat', cls: 2, name: 'Mercury flathead stroker, 276 ci', price: 300, tqLbft: 245, tqRpm: 2400, redline: 4700, kg: 255 },
        ardun296: { slot: 'engine', fam: 'flat', cls: 3, name: 'Ardun overhead-valve flathead, 296 ci', price: 560, tqLbft: 285, tqRpm: 3000, redline: 5400, kg: 265 },
        six235:   { slot: 'engine', fam: 'six', cls: 0, name: 'Chevy 235 six', price: 0, tqLbft: 200, tqRpm: 2000, redline: 4400, kg: 260 },
        six261:   { slot: 'engine', fam: 'six', cls: 1, name: 'Chevy 261 six', price: 160, tqLbft: 220, tqRpm: 2000, redline: 4400, kg: 270 },
        gmc270:   { slot: 'engine', fam: 'six', cls: 2, name: 'GMC 270 six', price: 260, tqLbft: 245, tqRpm: 2000, redline: 4500, kg: 290 },
        gmc302:   { slot: 'engine', fam: 'six', cls: 3, name: 'GMC 302 six, Wayne 12-port head', price: 480, tqLbft: 290, tqRpm: 2600, redline: 5000, kg: 300 },
        v8_283:   { slot: 'engine', fam: 'small', cls: 1, name: 'Chevy 283 V8', price: 340, tqLbft: 285, tqRpm: 2800, redline: 5200, kg: 240 },
        v8_327:   { slot: 'engine', fam: 'small', cls: 2, name: 'Chevy 327 V8', price: 520, tqLbft: 335, tqRpm: 3200, redline: 5800, kg: 245 },
        fuelie:   { slot: 'engine', fam: 'small', cls: 3, name: 'Chevy 327 fuel-injected V8', price: 900, tqLbft: 355, tqRpm: 4400, redline: 6500, kg: 250 },
        v8_348:   { slot: 'engine', fam: 'big', cls: 1, name: 'Chevy 348 V8', price: 560, tqLbft: 330, tqRpm: 3000, redline: 5600, kg: 295 },
        v8_409:   { slot: 'engine', fam: 'big', cls: 2, name: 'Chevy 409 V8', price: 780, tqLbft: 390, tqRpm: 3200, redline: 6000, kg: 300 },
        v8_427:   { slot: 'engine', fam: 'big', cls: 3, name: 'Ford 427 V8', price: 1150, tqLbft: 440, tqRpm: 3600, redline: 6400, kg: 310 },
        // 1973: the muscle car V8s
        chevy307: { slot: 'engine', fam: 'gm70', cls: 0, name: 'Chevy 307 V8', price: 0, tqLbft: 300, tqRpm: 2400, redline: 4800, kg: 230 },
        chevy350: { slot: 'engine', fam: 'gm70', cls: 1, name: 'Chevy 350 V8', price: 850, tqLbft: 380, tqRpm: 3200, redline: 5600, kg: 240 },
        chevy396: { slot: 'engine', fam: 'gm70', cls: 2, name: 'Chevy 396 V8', price: 1300, tqLbft: 430, tqRpm: 3400, redline: 5800, kg: 300 },
        ls6_454:  { slot: 'engine', fam: 'gm70', cls: 3, name: 'Chevy 454 LS6 V8', price: 2250, tqLbft: 500, tqRpm: 3600, redline: 6200, kg: 310 },
        ford302:  { slot: 'engine', fam: 'ford70', cls: 0, name: 'Ford 302 V8', price: 0, tqLbft: 290, tqRpm: 2600, redline: 5000, kg: 225 },
        ford351c: { slot: 'engine', fam: 'ford70', cls: 1, name: 'Ford 351 Cleveland V8', price: 850, tqLbft: 375, tqRpm: 3400, redline: 5800, kg: 250 },
        cj428:    { slot: 'engine', fam: 'ford70', cls: 2, name: 'Ford 428 Cobra Jet V8', price: 1300, tqLbft: 440, tqRpm: 3400, redline: 5800, kg: 315 },
        boss429:  { slot: 'engine', fam: 'ford70', cls: 3, name: 'Ford Boss 429 V8', price: 2250, tqLbft: 495, tqRpm: 3800, redline: 6400, kg: 320 },
        mopar318: { slot: 'engine', fam: 'mopar70', cls: 0, name: 'Mopar 318 V8', price: 0, tqLbft: 300, tqRpm: 2400, redline: 4800, kg: 245 },
        mopar340: { slot: 'engine', fam: 'mopar70', cls: 1, name: 'Mopar 340 V8', price: 900, tqLbft: 370, tqRpm: 3600, redline: 6000, kg: 245 },
        mopar440: { slot: 'engine', fam: 'mopar70', cls: 2, name: 'Mopar 440 Six Pack V8', price: 1400, tqLbft: 450, tqRpm: 3200, redline: 5600, kg: 320 },
        hemi426:  { slot: 'engine', fam: 'mopar70', cls: 3, name: 'Mopar 426 Hemi V8', price: 2450, tqLbft: 495, tqRpm: 4000, redline: 6600, kg: 330 }
    };
    Object.keys(L.PARTS).forEach(function (id) { L.PARTS[id].era = L.FAMILIES[L.PARTS[id].fam].era; });

    // Bolt-ons by class: what each is called, torque multiplier (tq), torque peak shift (rpm),
    // redline shift, and price before the family's price factor
    var BOLT_ON_CLASSES = [{
        carb: [
            { item: '2-barrel', tq: 1, price: 0 },
            { item: 'single 4-barrel', tq: 1.05, rpm: 100, price: 70 },
            { item: 'dual quads', tq: 1.08, rpm: 250, price: 160 },
            { item: 'six-pack (3 x 2-barrel)', tq: 1.09, rpm: 300, price: 190 }
        ],
        intake: [
            { item: 'cast-iron manifold', tq: 1, price: 0 },
            { item: 'aluminum manifold', tq: 1.03, rpm: 100, price: 55 },
            { item: 'high-rise manifold', tq: 1.05, rpm: 250, price: 120 },
            { item: 'tunnel-ram manifold', tq: 1.06, rpm: 350, price: 160 }
        ],
        cam: [
            { item: 'cam', tq: 1, price: 0 },
            { item: 'mild street cam', tq: 1.03, rpm: 150, redline: 200, price: 45 },
            { item: 'hot street cam', tq: 1.05, rpm: 400, redline: 500, price: 85 },
            { item: 'full race cam', tq: 1.07, rpm: 700, redline: 900, price: 140 }
        ],
        exhaust: [
            { item: 'log manifolds', tq: 1, price: 0 },
            { item: 'tube headers', tq: 1.04, rpm: 150, price: 90 },
            { item: 'headers with lakes pipes', tq: 1.06, rpm: 200, price: 130 },
            { item: 'big-tube open headers', tq: 1.07, rpm: 250, price: 170 }
        ]
    }, {
        carb: [
            { item: '2-barrel', tq: 1, price: 0 },
            { item: 'Holley 4-barrel', tq: 1.05, rpm: 100, price: 180 },
            { item: 'Holley double-pumper', tq: 1.08, rpm: 250, price: 400 },
            { item: 'Holley Dominator', tq: 1.09, rpm: 300, price: 480 }
        ],
        intake: [
            { item: 'cast-iron manifold', tq: 1, price: 0 },
            { item: 'dual-plane aluminum manifold', tq: 1.03, rpm: 100, price: 140 },
            { item: 'single-plane high-rise', tq: 1.05, rpm: 250, price: 300 },
            { item: 'cross-ram manifold', tq: 1.06, rpm: 350, price: 400 }
        ],
        cam: [
            { item: 'cam', tq: 1, price: 0 },
            { item: 'hydraulic street cam', tq: 1.03, rpm: 150, redline: 200, price: 110 },
            { item: 'solid-lifter cam', tq: 1.05, rpm: 400, redline: 500, price: 210 },
            { item: 'roller race cam', tq: 1.07, rpm: 700, redline: 900, price: 350 }
        ],
        exhaust: [
            { item: 'exhaust manifolds', tq: 1, price: 0 },
            { item: 'Hooker headers', tq: 1.04, rpm: 150, price: 220 },
            { item: 'tuned headers with an X-pipe', tq: 1.06, rpm: 200, price: 320 },
            { item: 'open zoomie headers', tq: 1.07, rpm: 250, price: 420 }
        ]
    }];

    function round5(n) { return Math.round(n / 5) * 5; }

    Object.keys(L.FAMILIES).forEach(function (fam) {
        var family = L.FAMILIES[fam];
        L.BOLT_ONS.forEach(function (slot) {
            BOLT_ON_CLASSES[family.era][slot].forEach(function (c, cls) {
                L.PARTS[slot + '_' + fam + '_' + cls] = {
                    slot: slot, fam: fam, cls: cls, era: family.era,
                    name: (cls ? family.name + ' ' : 'Stock ' + family.name.toLowerCase() + ' ') + c.item,
                    price: round5(c.price * family.price),
                    tq: c.tq, rpm: c.rpm || 0, redline: c.redline || 0
                };
            });
        });
    });

    // Parts that fit any car, by era: ids like trans_2, or trans_70_2 for 1973's
    var GENERIC = [[
        ['trans', [
            { name: '3-speed manual', price: 0, gears: [2.94, 1.68, 1.0] },
            { name: '4-speed wide ratio', price: 210, gears: [2.54, 1.80, 1.44, 1.0] },
            { name: '4-speed close ratio', price: 260, gears: [2.20, 1.64, 1.28, 1.0] },
            { name: '4-speed close ratio, Hurst shifter', price: 340, gears: [2.20, 1.64, 1.28, 1.0], shift: 0.7 }
        ]],
        ['rear', [
            { name: '3.36 rear gears', price: 0, final: 3.36 },
            { name: '3.73 rear gears', price: 60, final: 3.73 },
            { name: '4.11 rear gears', price: 75, final: 4.11 },
            { name: '4.56 rear gears', price: 90, final: 4.56 }
        ]],
        ['tires', [
            { name: 'Stock bias-ply tires', price: 0, mu: 0.72 },
            { name: 'Wide whitewall street tires', price: 80, mu: 0.85 },
            { name: 'Wide racing tires', price: 120, mu: 0.95 },
            { name: 'Cheater slicks', price: 150, mu: 1.02 }
        ]]
    ], [
        ['trans', [
            { name: '3-speed manual', price: 0, gears: [2.42, 1.61, 1.0] },
            { name: 'Muncie 4-speed wide ratio', price: 520, gears: [2.52, 1.88, 1.46, 1.0] },
            { name: 'Muncie 4-speed close ratio', price: 650, gears: [2.20, 1.64, 1.27, 1.0] },
            { name: 'Muncie "Rock Crusher" 4-speed, Hurst shifter', price: 850, gears: [2.20, 1.64, 1.27, 1.0], shift: 0.7 }
        ]],
        ['rear', [
            { name: '3.08 rear gears', price: 0, final: 3.08 },
            { name: '3.55 rear gears', price: 150, final: 3.55 },
            { name: '4.10 rear gears', price: 190, final: 4.10 },
            { name: '4.56 gears in a Dana 60', price: 230, final: 4.56 }
        ]],
        ['tires', [
            { name: 'F70 bias-ply tires', price: 0, mu: 0.80 },
            { name: 'G60 raised white letter tires', price: 200, mu: 0.95 },
            { name: 'L60 wide tires', price: 300, mu: 1.08 },
            { name: 'Drag slicks', price: 380, mu: 1.22 }
        ]]
    ]];
    GENERIC.forEach(function (rows, era) {
        rows.forEach(function (row) {
            row[1].forEach(function (part, cls) {
                L.PARTS[row[0] + '_' + (era ? L.ERAS[era].tag + '_' : '') + cls] = Object.assign({ slot: row[0], cls: cls, era: era }, part);
            });
        });
    });

    // Speed parts cost PART_PRICE times the prices above, so a full build takes several Friday
    // nights of winnings, not one. One number tunes the whole speed shop; basePrice keeps the
    // price above for the engine rebuild cost, which shouldn't grow with it.
    L.PART_PRICE = 2.5;
    Object.keys(L.PARTS).forEach(function (id) {
        var p = L.PARTS[id];
        p.basePrice = p.price;
        p.price = round5(p.price * L.PART_PRICE);
    });

    // Bestest+ and Legendary: made from each Bestest part, a hair better. Rebuilding one costs
    // what the Bestest's rebuild does (basePrice).
    L.PLUS_PRICE = 5;          // Bestest+ costs this times the Bestest
    L.LEGEND_PRICE = 2;        // and a Legendary part this times the Bestest+
    L.ZONE_PER_LEGEND = 0.3;   // each Legendary part widens the green shift zone by this share
    var PLUS_NAME = { engine: ', blueprinted', trans: ', blueprinted', rear: ' with Positraction', tires: ', hand-trued' };
    var BRANDS = /^(GMC|Chevy|Ford|Ardun|Mopar|Muncie|Holley|Hooker|F70|G60|L60)\b/;
    function better(p) {
        var x = Object.assign({}, p, { cls: 4, price: round5(p.price * L.PLUS_PRICE) });
        x.name = p.name + (PLUS_NAME[p.slot] || ', blueprinted');
        if (p.slot === 'engine') x.tqLbft = Math.round(p.tqLbft * 1.015);
        else if (p.tq) x.tq = Math.round((p.tq + 0.005) * 1000) / 1000;
        if (p.slot === 'trans') x.shift = 0.65;
        if (p.slot === 'rear') x.drive = 1.01;
        if (p.slot === 'tires') x.mu = p.mu + 0.02;
        return x;
    }
    Object.keys(L.PARTS).filter(function (id) { return L.PARTS[id].cls === 3; }).forEach(function (id) {
        var plus = better(L.PARTS[id]);
        var base = id.slice(-2) === '_3' ? id.slice(0, -2) : id;
        L.PARTS[base + (base === id ? '_plus' : '_4')] = plus;
        L.PARTS[base + (base === id ? '_legend' : '_5')] = Object.assign({}, plus, {
            cls: 5, name: 'Legendary ' + (BRANDS.test(L.PARTS[id].name) ? L.PARTS[id].name : L.PARTS[id].name.charAt(0).toLowerCase() + L.PARTS[id].name.slice(1)),
            price: round5(plus.price * L.LEGEND_PRICE), legend: true
        });
    });

    // The stock part for a slot on a car with this engine: its family's bolt-ons, and the
    // transmission, rear end and tires of its era
    L.stockPart = function (engineId, slot) {
        if (L.BOLT_ONS.indexOf(slot) >= 0) return slot + '_' + L.PARTS[engineId].fam + '_0';
        var era = L.PARTS[engineId].era;
        return slot + '_' + (era ? L.ERAS[era].tag + '_' : '') + '0';
    };

    // A class of part for a slot on a car with this engine
    L.partOfClass = function (engineId, slot, cls) {
        return L.stockPart(engineId, slot).replace(/_0$/, '_' + cls);
    };

    // Does this part fit a car with this engine?
    L.fits = function (partId, engineId) {
        var part = L.PARTS[partId];
        return !part.fam || part.slot === 'engine' || part.fam === L.PARTS[engineId].fam;
    };

    // Chance a class is on the speed shop's shelf in a given week. Legendary parts don't come
    // in by the week: LEGEND_ODDS is the chance one turns up, at random.
    L.IN_STOCK = [0, 0.8, 0.55, 0.3, 0.15, 0];
    L.LEGEND_ODDS = 0.2;

    function stock(engine, classes) {
        var parts = { engine: engine };
        L.SLOTS.forEach(function (slot) {
            if (slot !== 'engine') parts[slot] = L.partOfClass(engine, slot, (classes && classes[slot]) || 0);
        });
        return parts;
    }
    L.stockParts = stock;

    // Car bodies by era, the used cars of the day: mass without engine (kg), drag area (Cd x
    // frontal m²), and the parts they come with. Price is for a good one; the classifieds
    // discount for condition. shape picks the sprite: the 1963 coupe unless it says otherwise.
    L.BODIES = {
        ford48:  { name: "'48 Ford coupe", kg: 1000, cdA: 0.78, price: 500, color: '#d7263d', parts: stock('flathead') },
        merc49:  { name: "'49 Mercury coupe", kg: 1120, cdA: 0.76, price: 550, color: '#5c415d', parts: stock('flathead') },
        ford50:  { name: "'50 Ford Custom", kg: 1040, cdA: 0.76, price: 520, color: '#1b998b', parts: stock('flathead') },
        chevy52: { name: "'52 Chevy Styleline", kg: 1120, cdA: 0.74, price: 450, color: '#2e86ab', parts: stock('six235') },
        chevy55: { name: "'55 Chevy 210", kg: 1160, cdA: 0.70, price: 700, color: '#f4a259', parts: stock('six235') },
        chevy57: { name: "'57 Chevy Bel Air", kg: 1220, cdA: 0.70, price: 1100, color: '#3bb273', parts: stock('v8_283', { carb: 1 }) },
        chevy60: { name: "'60 Chevy Biscayne", kg: 1280, cdA: 0.72, price: 900, color: '#c9c9c9', parts: stock('six235') },
        // 1973: late-60s and early-70s muscle
        dart69:     { era: 1, name: "'69 Dodge Dart", kg: 1250, cdA: 0.66, price: 1500, color: '#d9a404', parts: stock('mopar318') },
        nova68:     { era: 1, name: "'68 Chevy Nova", kg: 1270, cdA: 0.66, price: 1600, color: '#2b6cb0', parts: stock('chevy307') },
        mustang67:  { era: 1, name: "'67 Ford Mustang fastback", kg: 1230, cdA: 0.63, price: 2200, color: '#b7322c', parts: stock('ford302') },
        torino70:   { era: 1, name: "'70 Ford Torino", kg: 1500, cdA: 0.64, price: 1900, color: '#3f7f4f', parts: stock('ford302') },
        chevelle70: { era: 1, name: "'70 Chevy Chevelle", kg: 1480, cdA: 0.66, price: 2300, color: '#e6e2d6', parts: stock('chevy307') },
        camaro69:   { era: 1, name: "'69 Chevy Camaro", kg: 1380, cdA: 0.62, price: 2800, color: '#f07a28', parts: stock('chevy350', { carb: 1 }) },
        charger69:  { era: 1, name: "'69 Dodge Charger", kg: 1560, cdA: 0.64, price: 2600, color: '#2a2a32', parts: stock('mopar318') },
        cuda70:     { era: 1, name: "'70 Plymouth 'Cuda", kg: 1430, cdA: 0.63, price: 3200, color: '#7a2fa0', parts: stock('mopar340', { carb: 1 }) }
    };
    Object.keys(L.BODIES).forEach(function (id) {
        var b = L.BODIES[id];
        b.era = b.era || 0;
        b.shape = b.shape || (b.era ? 'muscle' : 'coupe');
    });

    // Rival builds by tier: an engine swap (or none) and the class of each other part
    L.RIVAL_BUILDS = [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'v8_283', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'v8_327', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'v8_409', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        // The King: a 427 on Best bolt-ons, so a full Bestest build is an even fight and Bestest+ edges it
        { engine: 'v8_427', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 3, tires: 3 } }
    ];

    // 1973's rivals build the same way on the muscle car V8s
    L.ERA_BUILDS = [L.RIVAL_BUILDS, [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'chevy350', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'cj428', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'mopar440', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        { engine: 'hemi426', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 3, tires: 3 } }
    ]];

    // The parts a rival of this tier and era runs in this body
    L.rivalParts = function (bodyId, tier, era) {
        var build = L.ERA_BUILDS[era || 0][tier];
        return stock(build.engine || L.BODIES[bodyId].parts.engine, build.classes);
    };

    // Rivals hang around the strip. Tier sets their build, skill their launch and shifting.
    L.RIVALS = [
        { name: 'Skeeter Haines', tier: 0, skill: 0.3, body: 'merc49', line: "My old Merc'll eat you alive, kid." },
        { name: 'Donna Ruiz', tier: 0, skill: 0.5, body: 'chevy52', line: 'Loser buys the burgers.' },
        { name: 'Wendell Pike', tier: 0, skill: 0.2, body: 'chevy60', line: "It's my granddad's car. Go easy on it." },
        { name: 'Patsy Greer', tier: 0, skill: 0.4, body: 'ford48', line: 'Two bits says you stall it.' },
        { name: 'Bud Kowalski', tier: 1, skill: 0.4, body: 'chevy55', line: "Heard you've been running your mouth." },
        { name: 'Lefty Marsh', tier: 1, skill: 0.6, body: 'ford50', line: "Sure, I'll take your money." },
        { name: 'Ray "Gasket" Doyle', tier: 2, skill: 0.5, body: 'chevy57', line: 'Bring cash. Lots of it.' },
        { name: 'June Calloway', tier: 2, skill: 0.75, body: 'ford48', line: "Don't cry when I leave you at the line." },
        { name: 'Tommy Vance', tier: 3, skill: 0.7, body: 'chevy57', line: "You're out of your league." },
        { name: 'Earl "Big Block" Pruett', tier: 4, skill: 0.85, body: 'ford50', line: "Nobody's beaten this car in two summers." },
        // 1973
        { era: 1, name: 'Dewey Lusk', tier: 0, skill: 0.3, body: 'dart69', line: "Slant six? No sir, this here's a V8." },
        { era: 1, name: 'Linda Faye Tucker', tier: 0, skill: 0.5, body: 'nova68', line: 'Winner picks the eight-track.' },
        { era: 1, name: 'Boone Hatfield', tier: 0, skill: 0.25, body: 'torino70', line: "Daddy's car. Don't tell him." },
        { era: 1, name: 'Marco Delgado', tier: 0, skill: 0.4, body: 'mustang67', line: "Pony car, pony money. Let's go." },
        { era: 1, name: 'Vinnie "Vibes" Russo', tier: 1, skill: 0.45, body: 'chevelle70', line: "Can you dig it? Didn't think so." },
        { era: 1, name: 'Sharon Kolb', tier: 1, skill: 0.6, body: 'mustang67', line: 'Your old ride belongs in a museum.' },
        { era: 1, name: 'Duke Rawlins', tier: 2, skill: 0.55, body: 'camaro69', line: 'Bring cash. And a tow truck.' },
        { era: 1, name: 'Tina "Torque" Alvarez', tier: 2, skill: 0.75, body: 'nova68', line: "I don't lift. Ever." },
        { era: 1, name: 'Clyde Barnett', tier: 3, skill: 0.7, body: 'torino70', line: 'Cobra Jet. Look it up.' },
        { era: 1, name: 'Rusty "Six Pack" Sorensen', tier: 4, skill: 0.85, body: 'charger69', line: 'Six barrels, no mercy.' }
    ];
    L.RIVALS.forEach(function (r) { r.era = r.era || 0; });

    // The King of the strip: shows up once you've won KING_WINS races, and only races for pinks
    L.KING = { era: 0, name: 'The King', tier: 5, skill: 0.9, body: 'chevy57', line: 'You want my crown? Put up your car.' };
    L.KINGS = [L.KING,
        { era: 1, name: 'The Hemi King', tier: 5, skill: 0.9, body: 'cuda70', line: "Four-twenty-six cubes say you're done." }];
    L.KING_WINS = 10;

    // Prizes, in 1963 dollars (later eras pay their era's money times these). A race just for
    // fun costs nothing and pays by the rival's tier. A cash race bets all your cash up to
    // RIVAL_PRIZE (at least MIN_BET); a pink slip race is for the cars only. The King races for
    // pinks only and pays KING_PRIZE with his car.
    L.FUN_PRIZE = [50, 100, 100, 200, 200, 200];
    L.RIVAL_PRIZE = 1000;
    L.MIN_BET = 50;
    L.KING_PRIZE = 10000;

    // What a car fetches, times its body's price: a wreck is worth `junk`, and a car in shape
    // all over up to junk + restored (see L.carValue), plus `classic` dollars, since any old car
    // done right draws collectors, so even a cheap Ford can pay. Stripped, the shell goes for `scrap`.
    L.RESALE = { junk: 0.25, restored: 1.2, classic: 150, scrap: 0.12 };
    L.STRIP_HOURS = 6;

    // The paint shop: a new colour, a livery over it, or both, done by the shop while you
    // wait (no garage hours). Looks only: the car's value and speed don't change. A metallic
    // or candy paint costs more. A livery's trim colour comes from the same list.
    L.PAINTS = {
        red:       { name: 'Candy apple red', hex: '#c8102e', price: 250 },
        black:     { name: 'Tuxedo black', hex: '#2a2a32', price: 150 },
        white:     { name: 'Ermine white', hex: '#e6e2d6', price: 150 },
        turquoise: { name: 'Tropical turquoise', hex: '#2fb8ac', price: 150 },
        seafoam:   { name: 'Seafoam green', hex: '#8fd1b0', price: 150 },
        yellow:    { name: 'Canary yellow', hex: '#f2c230', price: 150 },
        tangerine: { name: 'Tangerine', hex: '#f07a28', price: 150 },
        blue:      { name: 'Harbor blue', hex: '#2f5d9e', price: 150 },
        pink:      { name: 'Dusk pink', hex: '#e88aa8', price: 150 },
        silver:    { name: 'Silver blue metallic', hex: '#8aa0b8', price: 250 },
        copper:    { name: 'Copper metallic', hex: '#b5653a', price: 250 },
        cherry:    { name: 'Black cherry', hex: '#5a1a3a', price: 250 }
    };
    // Liveries are for showing off: priced to soak up the winnings of a car that's already built
    L.LIVERIES = {
        none:      { name: 'Plain', price: 0 },
        pinstripe: { name: 'Pinstripe', price: 800 },
        stripes:   { name: 'Racing stripe', price: 1200 },
        twotone:   { name: 'Two-tone roof', price: 2000 },
        scallops:  { name: 'Scallops', price: 2400 },
        flames:    { name: 'Flames', price: 3000, ownColors: true },
        number:    { name: 'Racing number', price: 600, ownColors: true }
    };

    L.START_CASH = 600;     // enough for one scrappy car and a few repairs
    L.MAX_CARS = 10;
    L.REPAIR_PER_POINT = 2;   // dollars per point of engine condition restored

    // Wear on the other parts. A part under SHOT is past fixing and must be replaced.
    // repair: dollars per point of condition restored (tires can't be repaired, only replaced);
    // junk: a used stock part from the junkyard, which goes on at JUNK_CONDITION.
    // Time: the hours you can spend in the garage each week before Friday night's races,
    // and what each job takes. Repairing or replacing a part takes its slot's hours; an engine
    // swap the engine's; a rebuild REBUILD_HOURS; bodywork an hour per BODY_POINTS_PER_HOUR.
    L.HOURS_PER_WEEK = 30;
    L.JOB_HOURS = { engine: 10, carb: 2, intake: 3, cam: 5, exhaust: 3, trans: 6, rear: 4, tires: 1 };
    L.REBUILD_HOURS = 12;

    // Bodywork: the body must be at least MIN_BODY to race. Each point restored costs
    // BODY_PER_POINT dollars.
    L.MIN_BODY = 75;
    L.BODY_PER_POINT = 2.5;
    L.BODY_POINTS_PER_HOUR = 8;

    L.JUNK_ENGINE = 150;   // a used stock engine at the junkyard; a used stock part sells for half its junk price
    L.SHOT = 20;
    L.JUNK_CONDITION = 75;
    L.WEAR = {
        carb:    { repair: 0.6, junk: 25 },
        intake:  { repair: 0.3, junk: 15 },
        cam:     { repair: 0.8, junk: 30 },
        exhaust: { repair: 0.5, junk: 25 },
        trans:   { repair: 1.0, junk: 60 },
        rear:    { repair: 0.7, junk: 40 },
        tires:   { repair: 0, junk: 30 }
    };
})(window.Lemon = window.Lemon || {});

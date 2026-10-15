// Game data: car bodies, parts and rivals. Prices are in 1963 dollars, the summer the game
// is set in. Numbers are our own, tuned to feel like the original rather than copied from it.
(function (L) {
    'use strict';

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
    L.CLASSES = ['Stock', 'Better', 'Best', 'Bestest'];

    // Engines belong to a family, and carbs, intakes, cams and exhausts only fit their own
    // family's engines. Transmissions, rear ends and tires fit anything.
    L.FAMILIES = {
        flat:  { name: 'Flathead', price: 0.8 },
        six:   { name: 'Chevy six', price: 0.7 },
        small: { name: 'Small-block', price: 1 },
        big:   { name: 'Big-block', price: 1.4 }
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
        v8_427:   { slot: 'engine', fam: 'big', cls: 3, name: 'Ford 427 V8', price: 1150, tqLbft: 440, tqRpm: 3600, redline: 6400, kg: 310 }
    };

    // Bolt-ons by class: what each is called, torque multiplier (tq), torque peak shift (rpm),
    // redline shift, and price before the family's price factor
    var BOLT_ON_CLASSES = {
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
    };

    function round5(n) { return Math.round(n / 5) * 5; }

    Object.keys(L.FAMILIES).forEach(function (fam) {
        var family = L.FAMILIES[fam];
        L.BOLT_ONS.forEach(function (slot) {
            BOLT_ON_CLASSES[slot].forEach(function (c, cls) {
                L.PARTS[slot + '_' + fam + '_' + cls] = {
                    slot: slot, fam: fam, cls: cls,
                    name: (cls ? family.name + ' ' : 'Stock ' + family.name.toLowerCase() + ' ') + c.item,
                    price: round5(c.price * family.price),
                    tq: c.tq, rpm: c.rpm || 0, redline: c.redline || 0
                };
            });
        });
    });

    // Parts that fit any car
    [
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
    ].forEach(function (row) {
        row[1].forEach(function (part, cls) {
            L.PARTS[row[0] + '_' + cls] = Object.assign({ slot: row[0], cls: cls }, part);
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

    // The stock part for a slot on a car with this engine
    L.stockPart = function (engineId, slot) {
        if (L.BOLT_ONS.indexOf(slot) >= 0) return slot + '_' + L.PARTS[engineId].fam + '_0';
        return slot + '_0';
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

    // Chance a class is on the speed shop's shelf in a given week
    L.IN_STOCK = [0, 0.8, 0.55, 0.3];

    function stock(engine, classes) {
        var parts = { engine: engine };
        L.SLOTS.forEach(function (slot) {
            if (slot !== 'engine') parts[slot] = L.partOfClass(engine, slot, (classes && classes[slot]) || 0);
        });
        return parts;
    }
    L.stockParts = stock;

    // Car bodies, late-40s to early-60s used cars: mass without engine (kg), drag area (Cd x frontal m²), and the parts they
    // come with. Price is for a good one; the classifieds discount for condition.
    L.BODIES = {
        ford48:  { name: "'48 Ford coupe", kg: 1000, cdA: 0.78, price: 500, color: '#d7263d', parts: stock('flathead') },
        merc49:  { name: "'49 Mercury coupe", kg: 1120, cdA: 0.76, price: 550, color: '#5c415d', parts: stock('flathead') },
        ford50:  { name: "'50 Ford Custom", kg: 1040, cdA: 0.76, price: 520, color: '#1b998b', parts: stock('flathead') },
        chevy52: { name: "'52 Chevy Styleline", kg: 1120, cdA: 0.74, price: 450, color: '#2e86ab', parts: stock('six235') },
        chevy55: { name: "'55 Chevy 210", kg: 1160, cdA: 0.70, price: 700, color: '#f4a259', parts: stock('six235') },
        chevy57: { name: "'57 Chevy Bel Air", kg: 1220, cdA: 0.70, price: 1100, color: '#3bb273', parts: stock('v8_283', { carb: 1 }) },
        chevy60: { name: "'60 Chevy Biscayne", kg: 1280, cdA: 0.72, price: 900, color: '#c9c9c9', parts: stock('six235') }
    };

    // Rival builds by tier: an engine swap (or none) and the class of each other part
    L.RIVAL_BUILDS = [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'v8_283', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'v8_327', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'v8_409', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        { engine: 'v8_427', classes: { carb: 3, intake: 2, cam: 3, exhaust: 2, trans: 3, rear: 3, tires: 3 } }
    ];

    // The parts a rival of this tier runs in this body
    L.rivalParts = function (bodyId, tier) {
        var build = L.RIVAL_BUILDS[tier];
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
        { name: 'Earl "Big Block" Pruett', tier: 4, skill: 0.85, body: 'ford50', line: "Nobody's beaten this car in two summers." }
    ];

    // The King of the strip: shows up once you've won KING_WINS races, and only races for pinks
    L.KING = { name: 'The King', tier: 5, skill: 0.9, body: 'chevy57', line: 'You want my crown? Put up your car.' };
    L.KING_WINS = 10;

    // Prizes. A race just for fun costs nothing and pays by the rival's tier. A cash race
    // bets all your cash up to RIVAL_PRIZE (at least MIN_BET); a pink slip race is for the
    // cars only. The King races for pinks only and pays KING_PRIZE with his car.
    L.FUN_PRIZE = [50, 100, 100, 200, 200, 200];
    L.RIVAL_PRIZE = 1000;
    L.MIN_BET = 50;
    L.KING_PRIZE = 10000;

    // What a car fetches, times its body's price: a wreck is worth `junk`, and a car in shape
    // all over up to junk + restored (see L.carValue). Stripped, the shell goes for `scrap`.
    L.RESALE = { junk: 0.25, restored: 1.2, scrap: 0.12 };
    L.STRIP_HOURS = 6;

    L.START_CASH = 600;     // enough for one scrappy car and a few repairs
    L.MAX_CARS = 3;
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

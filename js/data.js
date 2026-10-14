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

    L.PARTS = {
        // Engines
        flathead: { slot: 'engine', name: 'Ford flathead V8, 239 ci', price: 0, tqLbft: 190, tqRpm: 2000, redline: 4200, kg: 250 },
        six235:   { slot: 'engine', name: 'Chevy 235 six', price: 0, tqLbft: 200, tqRpm: 2000, redline: 4400, kg: 260 },
        v8_283:   { slot: 'engine', name: 'Chevy 283 V8', price: 340, tqLbft: 285, tqRpm: 2800, redline: 5200, kg: 240 },
        v8_327:   { slot: 'engine', name: 'Chevy 327 V8', price: 520, tqLbft: 335, tqRpm: 3200, redline: 5800, kg: 245 },
        v8_409:   { slot: 'engine', name: 'Chevy 409 V8', price: 780, tqLbft: 390, tqRpm: 3200, redline: 6000, kg: 300 },
        v8_427:   { slot: 'engine', name: 'Ford 427 V8', price: 1150, tqLbft: 440, tqRpm: 3600, redline: 6400, kg: 310 },

        // Carburetors
        carb_stock: { slot: 'carb', name: 'Stock 2-barrel', price: 0, tq: 1 },
        carb_4bbl:  { slot: 'carb', name: 'Single 4-barrel', price: 70, tq: 1.05, rpm: 100 },
        carb_dual:  { slot: 'carb', name: 'Dual quads', price: 160, tq: 1.08, rpm: 250, needs: 'intake_hi' },
        carb_six:   { slot: 'carb', name: 'Six-pack (3 x 2-barrel)', price: 190, tq: 1.09, rpm: 300, needs: 'intake_hi' },

        // Intakes
        intake_stock: { slot: 'intake', name: 'Stock cast-iron manifold', price: 0, tq: 1 },
        intake_alu:   { slot: 'intake', name: 'Aluminum manifold', price: 55, tq: 1.03, rpm: 100 },
        intake_hi:    { slot: 'intake', name: 'High-rise multi-carb manifold', price: 120, tq: 1.05, rpm: 250 },

        // Camshafts: more top end, less bottom end
        cam_stock: { slot: 'cam', name: 'Stock cam', price: 0, tq: 1 },
        cam_mild:  { slot: 'cam', name: 'Mild street cam', price: 45, tq: 1.03, rpm: 150, redline: 200 },
        cam_hot:   { slot: 'cam', name: 'Hot street cam', price: 85, tq: 1.05, rpm: 400, redline: 500 },
        cam_race:  { slot: 'cam', name: 'Full race cam', price: 140, tq: 1.07, rpm: 700, redline: 900 },

        // Exhaust
        exhaust_stock: { slot: 'exhaust', name: 'Stock log manifolds', price: 0, tq: 1 },
        exhaust_hdr:   { slot: 'exhaust', name: 'Tube headers', price: 90, tq: 1.04, rpm: 150 },
        exhaust_open:  { slot: 'exhaust', name: 'Headers, open lakes pipes', price: 130, tq: 1.06, rpm: 200 },

        // Transmissions
        trans_3:     { slot: 'trans', name: '3-speed manual', price: 0, gears: [2.94, 1.68, 1.0] },
        trans_4wide: { slot: 'trans', name: '4-speed wide ratio', price: 210, gears: [2.54, 1.80, 1.44, 1.0] },
        trans_4cr:   { slot: 'trans', name: '4-speed close ratio', price: 260, gears: [2.20, 1.64, 1.28, 1.0] },

        // Rear ends
        rear_336: { slot: 'rear', name: '3.36 rear gears', price: 0, final: 3.36 },
        rear_373: { slot: 'rear', name: '3.73 rear gears', price: 60, final: 3.73 },
        rear_411: { slot: 'rear', name: '4.11 rear gears', price: 75, final: 4.11 },
        rear_456: { slot: 'rear', name: '4.56 rear gears', price: 90, final: 4.56 },

        // Tires
        tires_bias:  { slot: 'tires', name: 'Stock bias-ply', price: 0, mu: 0.72 },
        tires_wide:  { slot: 'tires', name: 'Wide whitewall street tires', price: 80, mu: 0.85 },
        tires_cheat: { slot: 'tires', name: 'Cheater slicks', price: 150, mu: 1.02 }
    };

    // The parts catalog sells everything with a price
    L.CATALOG = Object.keys(L.PARTS).filter(function (id) { return L.PARTS[id].price > 0; });

    var STOCK = {
        carb: 'carb_stock', intake: 'intake_stock', cam: 'cam_stock', exhaust: 'exhaust_stock',
        trans: 'trans_3', rear: 'rear_336', tires: 'tires_bias'
    };

    function stock(engine, extra) {
        var parts = Object.assign({ engine: engine }, STOCK);
        return Object.assign(parts, extra || {});
    }

    // Car bodies: mass without engine (kg), drag area (Cd x frontal m²), and the parts they
    // come with. Price is for a good one; the classifieds discount for condition.
    L.BODIES = {
        ford32:  { name: "'32 Ford roadster", kg: 760, cdA: 0.80, price: 750, color: '#d7263d', parts: stock('flathead') },
        ford34:  { name: "'34 Ford 3-window coupe", kg: 830, cdA: 0.78, price: 700, color: '#1b998b', parts: stock('flathead') },
        ford40:  { name: "'40 Ford coupe", kg: 960, cdA: 0.74, price: 600, color: '#2e86ab', parts: stock('flathead') },
        merc49:  { name: "'49 Mercury coupe", kg: 1180, cdA: 0.76, price: 550, color: '#5c415d', parts: stock('flathead') },
        chevy55: { name: "'55 Chevy 210", kg: 1240, cdA: 0.70, price: 800, color: '#f4a259', parts: stock('six235') },
        chevy57: { name: "'57 Chevy Bel Air", kg: 1300, cdA: 0.70, price: 1250, color: '#3bb273', parts: stock('v8_283', { carb: 'carb_4bbl' }) }
    };

    // Rival builds by tier: the parts beyond stock that a tier's cars carry
    L.RIVAL_BUILDS = [
        {},
        { carb: 'carb_4bbl', exhaust: 'exhaust_hdr' },
        { engine: 'v8_283', carb: 'carb_4bbl', intake: 'intake_alu', exhaust: 'exhaust_hdr', rear: 'rear_373', tires: 'tires_wide' },
        { engine: 'v8_327', carb: 'carb_dual', intake: 'intake_hi', cam: 'cam_hot', exhaust: 'exhaust_hdr', trans: 'trans_4wide', rear: 'rear_411', tires: 'tires_wide' },
        { engine: 'v8_409', carb: 'carb_dual', intake: 'intake_hi', cam: 'cam_hot', exhaust: 'exhaust_open', trans: 'trans_4cr', rear: 'rear_411', tires: 'tires_cheat' }
    ];

    // Rivals hang around the strip. Tier sets their build, skill their launch and shifting.
    L.RIVALS = [
        { name: 'Skeeter Haines', tier: 0, skill: 0.3, body: 'merc49', line: "My old Merc'll eat you alive, kid." },
        { name: 'Donna Ruiz', tier: 0, skill: 0.5, body: 'ford40', line: 'Loser buys the burgers.' },
        { name: 'Bud Kowalski', tier: 1, skill: 0.4, body: 'chevy55', line: "Heard you've been running your mouth." },
        { name: 'Lefty Marsh', tier: 1, skill: 0.6, body: 'ford34', line: "Sure, I'll take your money." },
        { name: 'Ray "Gasket" Doyle', tier: 2, skill: 0.5, body: 'chevy57', line: 'Bring cash. Lots of it.' },
        { name: 'June Calloway', tier: 2, skill: 0.75, body: 'ford32', line: "Don't cry when I leave you at the line." },
        { name: 'Tommy Vance', tier: 3, skill: 0.7, body: 'chevy57', line: "You're out of your league." },
        { name: 'Earl "Big Block" Pruett', tier: 4, skill: 0.85, body: 'ford40', line: "Nobody's beaten this car in two summers." }
    ];

    // Bets by rival tier: [smallest, largest]
    L.BET_RANGE = [[25, 75], [50, 150], [100, 300], [200, 500], [400, 900]];

    L.START_CASH = 1500;
    L.MAX_CARS = 3;
    L.REPAIR_PER_POINT = 3;   // dollars per point of engine condition restored
})(window.Lemon = window.Lemon || {});

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
          intro: "It's 1973. Muscle cars, big-block V8s and a new King have come to the burger stand, and the old hot rods are still around. Your cash and your cars came with you." },
        { year: 1985, tag: '85', money: 4, name: 'Summer of 1985',
          intro: "It's 1985. Fuel injection, five-speeds and turbo Buicks have rolled up to the burger stand, with a new King in a black Grand National. The old crowd is still around, and your cash and your cars came with you." },
        { year: 1995, tag: '95', money: 5.5, name: 'Summer of 1995',
          intro: "It's 1995. Twin-turbo imports and LT1 V8s line up at the burger stand, and a new King waits in a black Supra. The old crowd is still around, and your cash and your cars came with you." },
        { year: 2005, tag: '05', money: 7, name: 'Summer of 2005',
          intro: "It's 2005. LS V8s, Hemis and turbo fours with big wings have taken over the burger stand, and a new King waits in a black Evo. The old crowd is still around, and your cash and your cars came with you." },
        { year: 2025, tag: '25', money: 9, name: 'Summer of 2025',
          intro: "It's 2025. Supercharged Hellcats, GT500s and twin-turbo GT-Rs run nines on street tires, and the last King waits in a black GT-R. The old crowd is still around, and your cash and your cars came with you." }
    ];
    L.eraOf = function (g) { return Math.min(g.era || 0, L.ERAS.length - 1); };

    // Every part fills one slot on a car. Engines carry the base torque curve (lb-ft at tqRpm)
    // and redline; bolt-ons multiply torque (tq), move the torque peak (rpm) and redline.
    // Transmissions carry gear ratios, rear ends the final drive, tires the grip (mu).
    L.SLOTS = ['engine', 'carb', 'intake', 'cam', 'exhaust', 'trans', 'rear', 'tires'];

    L.SLOT_NAMES = {
        engine: 'Engine', carb: 'Fuel system', intake: 'Intake', cam: 'Camshaft',
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
        mopar70: { name: 'Mopar V8', price: 1.1, era: 1 },
        gm85:    { name: 'Chevy TPI V8', price: 1, era: 2 },
        ford85:  { name: 'Ford 5.0', price: 1, era: 2 },
        buick85: { name: 'Buick turbo V6', price: 1.2, era: 2, items: {
            carb: ['stock injectors', 'hot chip and bigger injectors', 'race chip and 50 lb injectors', 'race chip, big injectors and alky injection'],
            intake: ['stock intercooler', 'front-mount intercooler', 'big front-mount intercooler', 'race intercooler and throttle body'],
            exhaust: ['stock downpipe', 'big downpipe', 'downpipe and turbo-back exhaust', 'big turbo-back exhaust, no cats'] } },
        gm95:    { name: 'Chevy LT1 V8', price: 1, era: 3 },
        ford95:  { name: 'Ford Cobra V8', price: 1, era: 3 },
        jdm95:   { name: 'Import turbo six', price: 1.2, era: 3, items: {
            intake: ['stock intercooler', 'front-mount intercooler', 'big front-mount intercooler', 'race intercooler and intake manifold'],
            exhaust: ['stock downpipe', 'turbo-back exhaust', 'big turbo-back exhaust', 'race manifold and open dump'] } },
        ls05:    { name: 'Chevy LS V8', price: 1, era: 4 },
        hemi05:  { name: 'Chrysler Hemi V8', price: 1.05, era: 4 },
        turbo05: { name: 'Turbo four', price: 1.15, era: 4, items: {
            intake: ['stock intercooler', 'front-mount intercooler', 'big front-mount intercooler', 'race intercooler and intake manifold'],
            exhaust: ['stock downpipe', 'turbo-back exhaust', 'big turbo-back exhaust', 'tubular manifold and open dump'] } },
        lt25:     { name: 'Chevy LT V8', price: 1, era: 5 },
        hemi25:   { name: 'Hellcat Hemi V8', price: 1.05, era: 5 },
        ford25:   { name: 'Ford Coyote V8', price: 1, era: 5 },
        vr25:     { name: 'Nissan twin-turbo V6', price: 1.2, era: 5, items: {
            intake: ['stock intercoolers', 'bigger intercoolers', 'race intercoolers and intake pipes', 'race intercoolers and billet plenum'],
            exhaust: ['stock downpipes', 'turbo-back exhaust', 'big turbo-back exhaust', 'race manifolds and open dumps'] } }
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
        hemi426:  { slot: 'engine', fam: 'mopar70', cls: 3, name: 'Mopar 426 Hemi V8', price: 2450, tqLbft: 495, tqRpm: 4000, redline: 6600, kg: 330 },
        // 1985: fuel injection, strokers and turbos
        chevy305:  { slot: 'engine', fam: 'gm85', cls: 0, name: 'Chevy 305 V8', price: 0, tqLbft: 250, tqRpm: 2800, redline: 5000, kg: 215 },
        tpi350:    { slot: 'engine', fam: 'gm85', cls: 1, name: 'Chevy 350 Tuned Port V8', price: 1500, tqLbft: 340, tqRpm: 3200, redline: 5600, kg: 225 },
        chevy383:  { slot: 'engine', fam: 'gm85', cls: 2, name: 'Chevy 383 stroker V8', price: 2400, tqLbft: 450, tqRpm: 3800, redline: 6200, kg: 230 },
        chevy406:  { slot: 'engine', fam: 'gm85', cls: 3, name: 'Chevy 406 small-block V8', price: 4000, tqLbft: 545, tqRpm: 4200, redline: 6800, kg: 235 },
        ford50ho:  { slot: 'engine', fam: 'ford85', cls: 0, name: 'Ford 5.0 HO V8', price: 0, tqLbft: 270, tqRpm: 3000, redline: 5200, kg: 210 },
        ford351w:  { slot: 'engine', fam: 'ford85', cls: 1, name: 'Ford 351 Windsor V8', price: 1500, tqLbft: 345, tqRpm: 3400, redline: 5800, kg: 235 },
        ford347:   { slot: 'engine', fam: 'ford85', cls: 2, name: 'Ford 347 stroker V8', price: 2400, tqLbft: 445, tqRpm: 4000, redline: 6400, kg: 215 },
        ford392:   { slot: 'engine', fam: 'ford85', cls: 3, name: 'Ford 392 Windsor stroker V8', price: 4000, tqLbft: 540, tqRpm: 4200, redline: 6800, kg: 240 },
        buick38t:  { slot: 'engine', fam: 'buick85', cls: 0, name: 'Buick 3.8 turbo V6', price: 0, tqLbft: 300, tqRpm: 2600, redline: 5000, kg: 195 },
        buick38ic: { slot: 'engine', fam: 'buick85', cls: 1, name: 'Buick 3.8 turbo V6, intercooled', price: 1600, tqLbft: 360, tqRpm: 3000, redline: 5400, kg: 200 },
        buick38bt: { slot: 'engine', fam: 'buick85', cls: 2, name: 'Buick 3.8 big-turbo V6', price: 2600, tqLbft: 460, tqRpm: 3400, redline: 5800, kg: 205 },
        stage2:    { slot: 'engine', fam: 'buick85', cls: 3, name: 'Buick Stage II turbo V6', price: 4300, tqLbft: 550, tqRpm: 3800, redline: 6400, kg: 210 },
        // 1995: LT1s, superchargers and twin-turbo imports
        lt1:       { slot: 'engine', fam: 'gm95', cls: 0, name: 'Chevy LT1 V8', price: 0, tqLbft: 330, tqRpm: 4000, redline: 5800, kg: 210 },
        lt4:       { slot: 'engine', fam: 'gm95', cls: 1, name: 'Chevy LT4 V8', price: 2200, tqLbft: 380, tqRpm: 4400, redline: 6300, kg: 210 },
        lt1_383:   { slot: 'engine', fam: 'gm95', cls: 2, name: 'Chevy 383 LT1 stroker V8', price: 3500, tqLbft: 490, tqRpm: 4600, redline: 6600, kg: 215 },
        lt1_427:   { slot: 'engine', fam: 'gm95', cls: 3, name: 'Chevy 427 LT1 stroker V8', price: 5800, tqLbft: 600, tqRpm: 4800, redline: 7000, kg: 220 },
        gt40:      { slot: 'engine', fam: 'ford95', cls: 0, name: 'Ford 5.0 GT-40 V8', price: 0, tqLbft: 300, tqRpm: 3600, redline: 5800, kg: 205 },
        cobra50:   { slot: 'engine', fam: 'ford95', cls: 1, name: 'Ford 5.0 Cobra V8', price: 2200, tqLbft: 360, tqRpm: 3800, redline: 6000, kg: 205 },
        vortech:   { slot: 'engine', fam: 'ford95', cls: 2, name: 'Ford 5.0, Vortech supercharger', price: 3500, tqLbft: 490, tqRpm: 4400, redline: 6200, kg: 215 },
        kennebell: { slot: 'engine', fam: 'ford95', cls: 3, name: 'Ford 5.0, Kenne Bell twin-screw blower', price: 5800, tqLbft: 615, tqRpm: 4800, redline: 6600, kg: 225 },
        twojz:     { slot: 'engine', fam: 'jdm95', cls: 0, name: 'Toyota 2JZ twin-turbo six', price: 0, tqLbft: 320, tqRpm: 4000, redline: 6800, kg: 230 },
        rb26:      { slot: 'engine', fam: 'jdm95', cls: 1, name: 'Nissan RB26 twin-turbo six', price: 2400, tqLbft: 370, tqRpm: 4400, redline: 7200, kg: 230 },
        twojz_big: { slot: 'engine', fam: 'jdm95', cls: 2, name: 'Toyota 2JZ, big single turbo', price: 3800, tqLbft: 500, tqRpm: 5000, redline: 7400, kg: 230 },
        twojz_t88: { slot: 'engine', fam: 'jdm95', cls: 3, name: 'Toyota 2JZ, T88 turbo and built bottom end', price: 6200, tqLbft: 610, tqRpm: 5400, redline: 7800, kg: 235 },
        // 2005: LS V8s, new Hemis and turbo fours
        ls1:       { slot: 'engine', fam: 'ls05', cls: 0, name: 'Chevy LS1 V8', price: 0, tqLbft: 360, tqRpm: 4400, redline: 6000, kg: 200 },
        ls2:       { slot: 'engine', fam: 'ls05', cls: 1, name: 'Chevy LS2 V8', price: 3000, tqLbft: 410, tqRpm: 4400, redline: 6500, kg: 200 },
        ls7:       { slot: 'engine', fam: 'ls05', cls: 2, name: 'Chevy LS7 7.0 V8', price: 4800, tqLbft: 530, tqRpm: 4800, redline: 7000, kg: 205 },
        ls_tt:     { slot: 'engine', fam: 'ls05', cls: 3, name: 'Chevy LS 427, twin turbos', price: 8000, tqLbft: 660, tqRpm: 5000, redline: 7200, kg: 230 },
        hemi57:    { slot: 'engine', fam: 'hemi05', cls: 0, name: 'Chrysler 5.7 Hemi V8', price: 0, tqLbft: 390, tqRpm: 4000, redline: 5800, kg: 255 },
        hemi61:    { slot: 'engine', fam: 'hemi05', cls: 1, name: 'Chrysler 6.1 SRT Hemi V8', price: 3000, tqLbft: 430, tqRpm: 4800, redline: 6400, kg: 255 },
        hemi64:    { slot: 'engine', fam: 'hemi05', cls: 2, name: 'Chrysler 6.4 Hemi stroker V8', price: 4800, tqLbft: 535, tqRpm: 4800, redline: 6600, kg: 260 },
        hemi_whip: { slot: 'engine', fam: 'hemi05', cls: 3, name: 'Chrysler Hemi with a Whipple blower', price: 8000, tqLbft: 670, tqRpm: 5000, redline: 6800, kg: 275 },
        sr4g63:    { slot: 'engine', fam: 'turbo05', cls: 0, name: 'Mitsubishi 4G63 turbo four', price: 0, tqLbft: 290, tqRpm: 3500, redline: 7000, kg: 160 },
        ej257:     { slot: 'engine', fam: 'turbo05', cls: 1, name: 'Subaru EJ257 turbo flat four', price: 3200, tqLbft: 330, tqRpm: 4000, redline: 7000, kg: 165 },
        big4g63:   { slot: 'engine', fam: 'turbo05', cls: 2, name: 'Mitsubishi 4G63, big turbo', price: 5000, tqLbft: 450, tqRpm: 5000, redline: 7800, kg: 165 },
        gt35r:     { slot: 'engine', fam: 'turbo05', cls: 3, name: 'Mitsubishi 4G63 built, GT35R turbo', price: 8400, tqLbft: 580, tqRpm: 5600, redline: 8400, kg: 170 },
        // 2025: superchargers from the factory and a twin-turbo V6 from Japan
        lt1_25:    { slot: 'engine', fam: 'lt25', cls: 0, name: 'Chevy 6.2 LT1 V8', price: 0, tqLbft: 470, tqRpm: 4600, redline: 6500, kg: 210 },
        lt4_25:    { slot: 'engine', fam: 'lt25', cls: 1, name: 'Chevy 6.2 LT4 supercharged V8', price: 3900, tqLbft: 620, tqRpm: 4400, redline: 6500, kg: 225 },
        lt4_big:   { slot: 'engine', fam: 'lt25', cls: 2, name: 'Chevy LT4, ported blower and small pulley', price: 6200, tqLbft: 780, tqRpm: 4800, redline: 6800, kg: 225 },
        lt_tt:     { slot: 'engine', fam: 'lt25', cls: 3, name: 'Chevy LT 427, twin turbos', price: 10300, tqLbft: 1005, tqRpm: 5200, redline: 7200, kg: 240 },
        hemi392:   { slot: 'engine', fam: 'hemi25', cls: 0, name: 'Chrysler 392 Hemi V8', price: 0, tqLbft: 475, tqRpm: 4300, redline: 6400, kg: 265 },
        hellcat:   { slot: 'engine', fam: 'hemi25', cls: 1, name: 'Hellcat 6.2 supercharged Hemi', price: 3900, tqLbft: 630, tqRpm: 4800, redline: 6200, kg: 285 },
        demon:     { slot: 'engine', fam: 'hemi25', cls: 2, name: 'Demon 6.2 supercharged Hemi', price: 6200, tqLbft: 790, tqRpm: 4800, redline: 6500, kg: 285 },
        hemi_jb:   { slot: 'engine', fam: 'hemi25', cls: 3, name: 'Hemi 426 stroker, 3.0 blower on E85', price: 10300, tqLbft: 1080, tqRpm: 5000, redline: 6800, kg: 300 },
        coyote:    { slot: 'engine', fam: 'ford25', cls: 0, name: 'Ford 5.0 Coyote V8', price: 0, tqLbft: 420, tqRpm: 4900, redline: 7500, kg: 200 },
        predator:  { slot: 'engine', fam: 'ford25', cls: 1, name: 'Ford 5.2 Predator supercharged V8', price: 3900, tqLbft: 620, tqRpm: 5000, redline: 7500, kg: 215 },
        predator_big: { slot: 'engine', fam: 'ford25', cls: 2, name: 'Ford Predator, ported blower and small pulley', price: 6200, tqLbft: 780, tqRpm: 5200, redline: 7600, kg: 215 },
        coyote_tt: { slot: 'engine', fam: 'ford25', cls: 3, name: 'Ford 5.0 Coyote built, twin turbos', price: 10300, tqLbft: 985, tqRpm: 5600, redline: 7800, kg: 225 },
        vr38:      { slot: 'engine', fam: 'vr25', cls: 0, name: 'Nissan VR38 twin-turbo V6', price: 0, tqLbft: 465, tqRpm: 3600, redline: 7000, kg: 180 },
        vr38_t:    { slot: 'engine', fam: 'vr25', cls: 1, name: 'Nissan VR38, tune and bigger turbos', price: 4100, tqLbft: 620, tqRpm: 4200, redline: 7100, kg: 180 },
        vr38_big:  { slot: 'engine', fam: 'vr25', cls: 2, name: 'Nissan VR38 built, big turbos', price: 6500, tqLbft: 780, tqRpm: 5000, redline: 7600, kg: 185 },
        vr38_alpha: { slot: 'engine', fam: 'vr25', cls: 3, name: 'Nissan VR38 4.1 stroker, huge turbos', price: 10800, tqLbft: 1000, tqRpm: 5600, redline: 8000, kg: 190 }
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
    }, {
        carb: [
            { item: 'stock fuel injection', tq: 1, price: 0 },
            { item: 'bigger injectors', tq: 1.05, rpm: 100, price: 290 },
            { item: 'chip, injectors and fuel pump', tq: 1.08, rpm: 250, price: 640 },
            { item: 'race chip and big throttle body', tq: 1.09, rpm: 300, price: 770 }
        ],
        intake: [
            { item: 'stock intake', tq: 1, price: 0 },
            { item: 'ported intake', tq: 1.03, rpm: 100, price: 225 },
            { item: 'big-runner intake', tq: 1.05, rpm: 250, price: 480 },
            { item: 'race intake and plenum', tq: 1.06, rpm: 350, price: 640 }
        ],
        cam: [
            { item: 'cam', tq: 1, price: 0 },
            { item: 'street roller cam', tq: 1.03, rpm: 150, redline: 200, price: 175 },
            { item: 'hot roller cam', tq: 1.05, rpm: 400, redline: 500, price: 335 },
            { item: 'race roller cam', tq: 1.07, rpm: 700, redline: 900, price: 560 }
        ],
        exhaust: [
            { item: 'stock exhaust', tq: 1, price: 0 },
            { item: 'shorty headers', tq: 1.04, rpm: 150, price: 350 },
            { item: 'long-tube headers', tq: 1.06, rpm: 200, price: 510 },
            { item: 'long-tubes with open exhaust', tq: 1.07, rpm: 250, price: 670 }
        ]
    }, {
        carb: [
            { item: 'stock fuel system', tq: 1, price: 0 },
            { item: 'injectors and fuel pump', tq: 1.05, rpm: 100, price: 400 },
            { item: 'tuned ECU and fuel system', tq: 1.08, rpm: 250, price: 880 },
            { item: 'standalone race ECU', tq: 1.09, rpm: 300, price: 1060 }
        ],
        intake: [
            { item: 'stock intake', tq: 1, price: 0 },
            { item: 'cold air intake', tq: 1.03, rpm: 100, price: 310 },
            { item: 'ported intake manifold', tq: 1.05, rpm: 250, price: 660 },
            { item: 'race intake manifold', tq: 1.06, rpm: 350, price: 880 }
        ],
        cam: [
            { item: 'cams', tq: 1, price: 0 },
            { item: 'street cams', tq: 1.03, rpm: 150, redline: 200, price: 240 },
            { item: 'hot cams', tq: 1.05, rpm: 400, redline: 500, price: 460 },
            { item: 'race cams', tq: 1.07, rpm: 700, redline: 900, price: 770 }
        ],
        exhaust: [
            { item: 'stock exhaust', tq: 1, price: 0 },
            { item: 'cat-back exhaust', tq: 1.04, rpm: 150, price: 480 },
            { item: 'long-tube headers', tq: 1.06, rpm: 200, price: 700 },
            { item: 'race headers, open exhaust', tq: 1.07, rpm: 250, price: 920 }
        ]
    }, {
        carb: [
            { item: 'stock fuel system', tq: 1, price: 0 },
            { item: 'tune and injectors', tq: 1.05, rpm: 100, price: 560 },
            { item: 'E85 tune and fuel system', tq: 1.08, rpm: 250, price: 1230 },
            { item: 'flex-fuel race ECU', tq: 1.09, rpm: 300, price: 1480 }
        ],
        intake: [
            { item: 'stock intake', tq: 1, price: 0 },
            { item: 'cold air intake', tq: 1.03, rpm: 100, price: 430 },
            { item: 'ported intake and throttle body', tq: 1.05, rpm: 250, price: 920 },
            { item: 'race intake and big throttle body', tq: 1.06, rpm: 350, price: 1230 }
        ],
        cam: [
            { item: 'cam', tq: 1, price: 0 },
            { item: 'street cam', tq: 1.03, rpm: 150, redline: 200, price: 340 },
            { item: 'hot cam and springs', tq: 1.05, rpm: 400, redline: 500, price: 640 },
            { item: 'race cam and valvetrain', tq: 1.07, rpm: 700, redline: 900, price: 1080 }
        ],
        exhaust: [
            { item: 'stock exhaust', tq: 1, price: 0 },
            { item: 'cat-back exhaust', tq: 1.04, rpm: 150, price: 670 },
            { item: 'long-tube headers', tq: 1.06, rpm: 200, price: 980 },
            { item: 'race headers, straight pipes', tq: 1.07, rpm: 250, price: 1290 }
        ]
    }, {
        carb: [
            { item: 'stock fuel system', tq: 1, price: 0 },
            { item: 'tune and injectors', tq: 1.05, rpm: 100, price: 730 },
            { item: 'E85 tune and fuel system', tq: 1.08, rpm: 250, price: 1600 },
            { item: 'flex-fuel race ECU and fuel pumps', tq: 1.09, rpm: 300, price: 1920 }
        ],
        intake: [
            { item: 'stock intake', tq: 1, price: 0 },
            { item: 'cold air intake', tq: 1.03, rpm: 100, price: 560 },
            { item: 'ported intake and throttle body', tq: 1.05, rpm: 250, price: 1200 },
            { item: 'race intake and big throttle body', tq: 1.06, rpm: 350, price: 1600 }
        ],
        cam: [
            { item: 'cam', tq: 1, price: 0 },
            { item: 'street cam', tq: 1.03, rpm: 150, redline: 200, price: 440 },
            { item: 'hot cam and springs', tq: 1.05, rpm: 400, redline: 500, price: 830 },
            { item: 'race cam and valvetrain', tq: 1.07, rpm: 700, redline: 900, price: 1400 }
        ],
        exhaust: [
            { item: 'stock exhaust', tq: 1, price: 0 },
            { item: 'cat-back exhaust', tq: 1.04, rpm: 150, price: 870 },
            { item: 'long-tube headers', tq: 1.06, rpm: 200, price: 1270 },
            { item: 'race headers, straight pipes', tq: 1.07, rpm: 250, price: 1680 }
        ]
    }];

    function round5(n) { return Math.round(n / 5) * 5; }

    Object.keys(L.FAMILIES).forEach(function (fam) {
        var family = L.FAMILIES[fam];
        L.BOLT_ONS.forEach(function (slot) {
            BOLT_ON_CLASSES[family.era][slot].forEach(function (c, cls) {
                var item = family.items && family.items[slot] ? family.items[slot][cls] : c.item;   // a family's own names for the same parts
                L.PARTS[slot + '_' + fam + '_' + cls] = {
                    slot: slot, fam: fam, cls: cls, era: family.era,
                    name: (cls ? family.name + ' ' : 'Stock ' + family.name.toLowerCase() + ' ') + item,
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
    ], [
        ['trans', [
            { name: 'T-5 5-speed', price: 0, gears: [2.95, 1.94, 1.34, 1.0, 0.73] },
            { name: 'T-5 World Class 5-speed', price: 840, gears: [3.35, 1.93, 1.29, 1.0, 0.68] },
            { name: 'Richmond close-ratio 5-speed', price: 1040, gears: [2.58, 1.82, 1.36, 1.0, 0.80] },
            { name: 'Doug Nash 5-speed, Hurst shifter', price: 1360, gears: [2.58, 1.82, 1.36, 1.0, 0.80], shift: 0.7 }
        ]],
        ['rear', [
            { name: '2.73 rear gears', price: 0, final: 2.73 },
            { name: '3.27 rear gears', price: 240, final: 3.27 },
            { name: '3.73 rear gears', price: 300, final: 3.73 },
            { name: '4.10 gears in a Ford 9-inch', price: 360, final: 4.10 }
        ]],
        ['tires', [
            { name: 'P225/60 radials', price: 0, mu: 0.88 },
            { name: 'Gatorback radials', price: 320, mu: 1.04 },
            { name: 'Mickey Thompson street tires', price: 480, mu: 1.22 },
            { name: 'Mickey Thompson slicks', price: 610, mu: 1.45 }
        ]]
    ], [
        ['trans', [
            { name: 'T-56 6-speed', price: 0, gears: [2.66, 1.78, 1.30, 1.0, 0.74, 0.50] },
            { name: 'Getrag 6-speed', price: 1150, gears: [3.83, 2.36, 1.69, 1.31, 1.0, 0.79] },
            { name: 'Tremec close-ratio 6-speed', price: 1430, gears: [2.97, 2.07, 1.43, 1.0, 0.84, 0.62] },
            { name: 'G-Force dog-ring 5-speed', price: 1870, gears: [2.97, 2.07, 1.43, 1.0, 0.84], shift: 0.7 }
        ]],
        ['rear', [
            { name: '3.08 rear gears', price: 0, final: 3.08 },
            { name: '3.42 rear gears', price: 330, final: 3.42 },
            { name: '3.73 rear gears', price: 410, final: 3.73 },
            { name: '4.10 gears in a Strange 9-inch', price: 500, final: 4.10 }
        ]],
        ['tires', [
            { name: 'Z-rated street radials', price: 0, mu: 0.95 },
            { name: 'BFGoodrich drag radials', price: 440, mu: 1.18 },
            { name: 'Nitto drag radials', price: 660, mu: 1.45 },
            { name: 'Hoosier slicks', price: 840, mu: 1.78 }
        ]]
    ], [
        ['trans', [
            { name: '6-speed manual', price: 0, gears: [2.97, 2.07, 1.43, 1.0, 0.84, 0.56] },
            { name: 'Tremec T-56 Magnum 6-speed', price: 1600, gears: [2.66, 1.78, 1.30, 1.0, 0.80, 0.63] },
            { name: 'Tremec TR-6060 close-ratio 6-speed', price: 2000, gears: [2.26, 1.58, 1.20, 1.0, 0.80, 0.63] },
            { name: 'Liberty-built 6-speed, short shifter', price: 2600, gears: [2.26, 1.58, 1.20, 1.0, 0.80, 0.63], shift: 0.7 }
        ]],
        ['rear', [
            { name: '3.27 rear gears', price: 0, final: 3.27 },
            { name: '3.73 rear gears', price: 460, final: 3.73 },
            { name: '4.10 rear gears', price: 570, final: 4.10 },
            { name: '4.30 gears and a race diff', price: 700, final: 4.30 }
        ]],
        ['tires', [
            { name: 'Summer performance tires', price: 0, mu: 1.02 },
            { name: 'Nitto NT555R drag radials', price: 620, mu: 1.30 },
            { name: 'Mickey Thompson ET Street Radials', price: 920, mu: 1.7 },
            { name: 'Hoosier drag slicks', price: 1180, mu: 2.15 }
        ]]
    ], [
        ['trans', [
            { name: '6-speed manual', price: 0, gears: [2.66, 1.78, 1.30, 1.0, 0.74, 0.50] },
            { name: 'Tremec TR-6060 6-speed', price: 2080, gears: [2.97, 2.07, 1.43, 1.0, 0.84, 0.56] },
            { name: 'Tremec 7-speed dual-clutch', price: 2600, gears: [3.13, 2.20, 1.62, 1.24, 1.0, 0.82, 0.66] },
            { name: 'Tremec dual-clutch, race clutch packs and paddles', price: 3380, gears: [3.13, 2.20, 1.62, 1.24, 1.0, 0.82, 0.66], shift: 0.7 }
        ]],
        ['rear', [
            { name: '3.55 rear gears', price: 0, final: 3.55 },
            { name: '3.73 rear gears', price: 600, final: 3.73 },
            { name: '4.10 rear gears', price: 740, final: 4.10 },
            { name: '4.30 gears and a race diff', price: 910, final: 4.30 }
        ]],
        ['tires', [
            { name: 'Michelin Pilot Sport tires', price: 0, mu: 1.15 },
            { name: 'Nitto NT555RII drag radials', price: 800, mu: 1.55 },
            { name: 'Mickey Thompson ET Street R radials', price: 1200, mu: 2.05 },
            { name: 'Hoosier Quick Time Pro drag slicks', price: 1530, mu: 2.6 }
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
    var BRANDS = /^(GMC|Chevy|Ford|Ardun|Mopar|Muncie|Holley|Hooker|F70|G60|L60|Buick|T-5|Richmond|Doug|Gatorback|Mickey|P225|Toyota|Nissan|Getrag|Tremec|BFGoodrich|Nitto|Hoosier|Z-rated|Mitsubishi|Subaru|Chrysler|Liberty-built|Summer|Michelin|Hemi|Hellcat|Demon)\b/;
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
        cuda70:     { era: 1, name: "'70 Plymouth 'Cuda", kg: 1430, cdA: 0.63, price: 3200, color: '#7a2fa0', parts: stock('mopar340', { carb: 1 }) },
        // 1985: Fox bodies, F-bodies and G-bodies
        fox79:      { era: 2, name: "'79 Ford Mustang", kg: 1220, cdA: 0.58, price: 2400, color: '#c9b458', parts: stock('ford50ho') },
        transam81:  { era: 2, name: "'81 Pontiac Trans Am", kg: 1480, cdA: 0.55, price: 3200, color: '#2a2a32', parts: stock('chevy305') },
        camaro82:   { era: 2, name: "'82 Chevy Camaro Z28", kg: 1420, cdA: 0.52, price: 3600, color: '#c8102e', parts: stock('chevy305') },
        montess84:  { era: 2, name: "'84 Chevy Monte Carlo SS", kg: 1500, cdA: 0.58, price: 4200, color: '#e6e2d6', parts: stock('chevy305') },
        mustang84:  { era: 2, name: "'84 Ford Mustang GT", kg: 1320, cdA: 0.55, price: 4800, color: '#2f5d9e', parts: stock('ford50ho', { carb: 1 }) },
        regal84:    { era: 2, name: "'84 Buick Regal T-Type", kg: 1460, cdA: 0.55, price: 4600, color: '#8aa0b8', parts: stock('buick38t') },
        irocz85:    { era: 2, name: "'85 Chevy Camaro IROC-Z", kg: 1450, cdA: 0.50, price: 6800, color: '#e88aa8', parts: stock('chevy305', { carb: 1 }) },
        gn84:       { era: 2, name: "'84 Buick Grand National", kg: 1480, cdA: 0.55, price: 6400, color: '#16161c', parts: stock('buick38t', { carb: 1 }) },
        // 1995: LT1 F-bodies, SN95s and Japanese twin-turbos
        mustang94:  { era: 3, name: "'94 Ford Mustang GT", kg: 1480, cdA: 0.48, price: 9000, color: '#c8102e', parts: stock('gt40') },
        camaro93:   { era: 3, name: "'93 Chevy Camaro Z28", kg: 1520, cdA: 0.44, price: 10000, color: '#2f5d9e', parts: stock('lt1') },
        firebird94: { era: 3, name: "'94 Pontiac Firebird Formula", kg: 1540, cdA: 0.43, price: 9500, color: '#2fb8ac', parts: stock('lt1') },
        impala94:   { era: 3, name: "'94 Chevy Impala SS", kg: 1900, cdA: 0.50, price: 9500, color: '#1c1c24', parts: stock('lt1') },
        cobra93:    { era: 3, name: "'93 Ford Mustang Cobra", kg: 1450, cdA: 0.48, price: 12000, color: '#e6e2d6', parts: stock('gt40', { carb: 1 }) },
        vette92:    { era: 3, name: "'92 Chevy Corvette", kg: 1440, cdA: 0.34, price: 15000, color: '#f2c230', parts: stock('lt1') },
        supra93:    { era: 3, name: "'93 Toyota Supra Turbo", kg: 1560, cdA: 0.41, price: 18000, color: '#f07a28', parts: stock('twojz') },
        gtr91:      { era: 3, name: "'91 Nissan Skyline GT-R", kg: 1430, cdA: 0.42, price: 19000, color: '#8aa0b8', parts: stock('rb26') },
        // 2005: LS-swapped everything, SRT Hemis and rally-bred turbo fours
        srt4_04:    { era: 4, name: "'04 Dodge Neon SRT-4", kg: 1290, cdA: 0.42, price: 12000, color: '#f2c230', parts: stock('sr4g63') },
        c300_05:    { era: 4, name: "'05 Chrysler 300C", kg: 1820, cdA: 0.38, price: 17000, color: '#e6e2d6', parts: stock('hemi57') },
        magnum05:   { era: 4, name: "'05 Dodge Magnum R/T", kg: 1850, cdA: 0.40, price: 16000, color: '#c8102e', parts: stock('hemi57') },
        gto04:      { era: 4, name: "'04 Pontiac GTO", kg: 1680, cdA: 0.38, price: 18000, color: '#2fb8ac', parts: stock('ls1') },
        ctsv04:     { era: 4, name: "'04 Cadillac CTS-V", kg: 1760, cdA: 0.36, price: 22000, color: '#8aa0b8', parts: stock('ls1', { carb: 1 }) },
        sti05:      { era: 4, name: "'05 Subaru WRX STI", kg: 1480, cdA: 0.40, price: 24000, color: '#2f5d9e', parts: stock('ej257') },
        evo05:      { era: 4, name: "'05 Mitsubishi Lancer Evolution", kg: 1420, cdA: 0.40, price: 25000, color: '#c9c9c9', parts: stock('sr4g63', { carb: 1 }) },
        vette05:    { era: 4, name: "'05 Chevy Corvette", kg: 1400, cdA: 0.30, price: 30000, color: '#d7263d', parts: stock('ls2') },
        // 2025: two tons of supercharged muscle, and Godzilla
        charger23:  { era: 5, name: "'23 Dodge Charger Scat Pack", kg: 1970, cdA: 0.40, price: 22000, color: '#5a1a3a', parts: stock('hemi392') },
        mustang24:  { era: 5, name: "'24 Ford Mustang GT", kg: 1730, cdA: 0.36, price: 22000, color: '#2f5d9e', parts: stock('coyote') },
        camaro24:   { era: 5, name: "'24 Chevy Camaro SS", kg: 1720, cdA: 0.36, price: 22000, color: '#f2c230', parts: stock('lt1_25') },
        vette24:    { era: 5, name: "'24 Chevy Corvette Stingray", kg: 1660, cdA: 0.30, price: 34000, color: '#c8102e', parts: stock('lt1_25') },
        challenger23: { era: 5, name: "'23 Dodge Challenger Hellcat", kg: 2000, cdA: 0.40, price: 38000, color: '#f07a28', parts: stock('hellcat') },
        zl1_24:     { era: 5, name: "'24 Chevy Camaro ZL1", kg: 1790, cdA: 0.36, price: 36000, color: '#e6e2d6', parts: stock('lt4_25') },
        gt500_22:   { era: 5, name: "'22 Ford Mustang Shelby GT500", kg: 1880, cdA: 0.36, price: 42000, color: '#2fb8ac', parts: stock('predator') },
        gtr24:      { era: 5, name: "'24 Nissan GT-R", kg: 1750, cdA: 0.36, price: 48000, color: '#8aa0b8', parts: stock('vr38') }
    };
    Object.keys(L.BODIES).forEach(function (id) {
        var b = L.BODIES[id];
        b.era = b.era || 0;
        b.shape = b.shape || ['coupe', 'muscle', 'eighties', 'nineties', 'aughts', 'modern'][b.era];
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
    ], [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'tpi350', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'ford347', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'buick38bt', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        // The Turbo King: Bestest where it counts, so a full Bestest build is close to an even fight
        { engine: 'stage2', classes: { carb: 3, intake: 2, cam: 3, exhaust: 2, trans: 3, rear: 3, tires: 3 } }
    ], [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'lt4', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'vortech', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'twojz_big', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        { engine: 'twojz_t88', classes: { carb: 3, intake: 2, cam: 3, exhaust: 2, trans: 2, rear: 3, tires: 3 } }
    ], [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'ls2', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'hemi64', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'big4g63', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        { engine: 'gt35r', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 3, tires: 3 } }
    ], [
        { classes: {} },
        { classes: { carb: 1, exhaust: 1 } },
        { engine: 'lt4_25', classes: { carb: 1, intake: 1, exhaust: 1, rear: 1, tires: 1 } },
        { engine: 'demon', classes: { carb: 2, intake: 2, cam: 2, exhaust: 1, trans: 1, rear: 2, tires: 1 } },
        { engine: 'vr38_big', classes: { carb: 2, intake: 2, cam: 2, exhaust: 2, trans: 2, rear: 2, tires: 3 } },
        { engine: 'vr38_alpha', classes: { carb: 3, intake: 2, cam: 3, exhaust: 2, trans: 2, rear: 3, tires: 3 } }
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
        { era: 1, name: 'Rusty "Six Pack" Sorensen', tier: 4, skill: 0.85, body: 'charger69', line: 'Six barrels, no mercy.' },
        // 1985
        { era: 2, name: 'Chad Whitaker', tier: 0, skill: 0.3, body: 'montess84', line: "My dad's lawyer says I can't lose." },
        { era: 2, name: 'Tammy Jo Pruitt', tier: 0, skill: 0.5, body: 'fox79', line: 'Hold my Tab.' },
        { era: 2, name: 'Rick "Mullet" Haskins', tier: 0, skill: 0.25, body: 'transam81', line: 'Business up front, party at the finish line.' },
        { era: 2, name: 'Dana Okafor', tier: 0, skill: 0.4, body: 'camaro82', line: 'Totally tubular. You, not so much.' },
        { era: 2, name: 'Scotty Brennan', tier: 1, skill: 0.45, body: 'mustang84', line: 'Five-point-oh, no.' },
        { era: 2, name: 'Gina Castellano', tier: 1, skill: 0.6, body: 'regal84', line: "Don't let the grandma Buick fool you." },
        { era: 2, name: 'Troy "Turbo" Lindqvist', tier: 2, skill: 0.55, body: 'irocz85', line: 'Gag me with a slow car.' },
        { era: 2, name: 'Raquel Vance', tier: 2, skill: 0.75, body: 'mustang84', line: "Tommy Vance was my uncle. I'm quicker." },
        { era: 2, name: 'Jerome "Boost" Carter', tier: 3, skill: 0.7, body: 'fox79', line: 'Stroked, ported, and bad.' },
        { era: 2, name: 'Vic Santangelo', tier: 4, skill: 0.85, body: 'regal84', line: 'Hear that whistle? That means goodbye.' },
        // 1995
        { era: 3, name: 'Kyle Dempsey', tier: 0, skill: 0.3, body: 'impala94', line: "It's a cop car. Kinda. Whatever." },
        { era: 3, name: 'Jen Nakamura', tier: 0, skill: 0.5, body: 'mustang94', line: "As if. You're so not winning." },
        { era: 3, name: 'Dwayne "Dub" Mitchell', tier: 0, skill: 0.25, body: 'firebird94', line: 'Pager says I got somewhere to be.' },
        { era: 3, name: 'Brandon Kowalski', tier: 0, skill: 0.4, body: 'camaro93', line: "My grandpa Bud raced here. He'd hate your car." },
        { era: 3, name: 'Alicia Reyes', tier: 1, skill: 0.45, body: 'cobra93', line: "Cobra. Snake. Bite. Get it?" },
        { era: 3, name: 'Trevor Hollis', tier: 1, skill: 0.6, body: 'vette92', line: 'Mid-life crisis? Nah, early one.' },
        { era: 3, name: 'Hiro Tanaka', tier: 2, skill: 0.55, body: 'gtr91', line: 'Godzilla is hungry.' },
        { era: 3, name: 'Kim "Spool" Pham', tier: 2, skill: 0.75, body: 'supra93', line: 'Wait for the boost. Then cry.' },
        { era: 3, name: 'Darnell Brooks', tier: 3, skill: 0.7, body: 'mustang94', line: 'Blown five-oh. Literally.' },
        { era: 3, name: 'Luis "Ten Second" Ortega', tier: 4, skill: 0.85, body: 'supra93', line: "Ten-second car. You're not ready." },
        // 2005
        { era: 4, name: 'Tyler Brandt', tier: 0, skill: 0.3, body: 'c300_05', line: 'Dude, it has a Hemi.' },
        { era: 4, name: 'Ashley Moreau', tier: 0, skill: 0.5, body: 'srt4_04', line: 'Neon. Yeah. Laugh it up.' },
        { era: 4, name: 'Cody Ruiz', tier: 0, skill: 0.25, body: 'magnum05', line: 'Hold on, I gotta text my girl.' },
        { era: 4, name: 'Priya Desai', tier: 0, skill: 0.4, body: 'gto04', line: "Goat's hungry." },
        { era: 4, name: 'Jake "Wing" Harlan', tier: 1, skill: 0.45, body: 'sti05', line: 'The wing adds ten horsepower. Minimum.' },
        { era: 4, name: 'Monique Grant', tier: 1, skill: 0.6, body: 'ctsv04', line: "My Caddy's got a Corvette heart." },
        { era: 4, name: 'Danny "NOS" Kowalczyk', tier: 2, skill: 0.55, body: 'evo05', line: 'I live my life a quarter mile at a time. Ha.' },
        { era: 4, name: 'Mei Lin Chou', tier: 2, skill: 0.75, body: 'vette05', line: "Don't blink." },
        { era: 4, name: 'Brett Sandoval', tier: 3, skill: 0.7, body: 'c300_05', line: "Grandma's sedan. Grandma's not driving." },
        { era: 4, name: 'Andre "Anti-Lag" Fontaine', tier: 4, skill: 0.85, body: 'evo05', line: 'Hear the pops? That is the sound of losing.' },
        // 2025
        { era: 5, name: 'Brayden Cole', tier: 0, skill: 0.3, body: 'charger23', line: "Hold up, I'm going live." },
        { era: 5, name: 'Zoe Albright', tier: 0, skill: 0.5, body: 'mustang24', line: 'Loser posts the L.' },
        { era: 5, name: 'Jaxon "Burnout" Price', tier: 0, skill: 0.25, body: 'camaro24', line: 'Watch the burnout. That part I can do.' },
        { era: 5, name: 'Nadia Haddad', tier: 0, skill: 0.4, body: 'vette24', line: 'Engine in the middle. You in my mirror.' },
        { era: 5, name: 'Logan Pike', tier: 1, skill: 0.45, body: 'challenger23', line: 'My great-granddad Wendell raced here. Go easy on me.' },
        { era: 5, name: 'Sofia Marquez', tier: 1, skill: 0.6, body: 'gt500_22', line: 'Seven hundred sixty horsepower and no patience.' },
        { era: 5, name: 'Ethan "Pulley" Wu', tier: 2, skill: 0.55, body: 'zl1_24', line: 'Smaller pulley, bigger problem. Yours.' },
        { era: 5, name: 'Keisha Monroe', tier: 2, skill: 0.75, body: 'gtr24', line: 'Launch control does the rest.' },
        { era: 5, name: 'Dominic Russo', tier: 3, skill: 0.7, body: 'challenger23', line: "My grandpa Vinnie raced here. Can you dig it? Didn't think so." },
        { era: 5, name: 'Ray "Nine Flat" Okafor', tier: 4, skill: 0.85, body: 'gt500_22', line: 'Nine flat on street tires. Your turn.' }
    ];
    L.RIVALS.forEach(function (r) { r.era = r.era || 0; });

    // The King of the strip: shows up once you've won KING_WINS races, and only races for pinks
    L.KING = { era: 0, name: 'The King', tier: 5, skill: 0.9, body: 'chevy57', line: 'You want my crown? Put up your car.' };
    L.KINGS = [L.KING,
        { era: 1, name: 'The Hemi King', tier: 5, skill: 0.9, body: 'cuda70', line: "Four-twenty-six cubes say you're done." },
        { era: 2, name: 'The Turbo King', tier: 5, skill: 0.9, body: 'gn84', line: "Darth Vader's car. And I'm Darth Vader." },
        { era: 3, name: 'The Import King', tier: 5, skill: 0.9, body: 'supra93', line: 'Sixty pounds of boost. Bring a lunch.' },
        { era: 4, name: 'The Tuner King', tier: 5, skill: 0.9, body: 'evo05', line: 'Four cylinders. Nine seconds. Your move.' },
        { era: 5, name: 'The Last King', tier: 5, skill: 0.9, body: 'gtr24', line: "Sixty years of Kings, and I'm the last. Prove me wrong." }];
    L.KING_WINS = 10;

    // Prizes, in 1963 dollars (later eras pay their era's money times these). A race just for
    // fun costs nothing and pays by the rival's tier. A cash race bets what you pick, from
    // MIN_BET up to all your cash or RIVAL_PRIZE; a pink slip race is for the cars only. The King races for
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

// Pixel art for the canvas: shaded boxes, discs and tubes drawn a whole pixel at a time in a
// VGA-style palette, the cars, the garage wall and floor, the parts on the workbench and the
// bolts. Nothing here knows the game's rules; race.js, wrench.js and main.js call it.
(function (L) {
    'use strict';

    // ── Colors ────────────────────────────────────────────────────────────

    function rgb(hex) {
        var n = parseInt(hex.slice(1), 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }

    function mix(hex, toward, t) {
        var a = rgb(hex), b = rgb(toward);
        return '#' + a.map(function (v, i) {
            return ('0' + Math.round(v + (b[i] - v) * t).toString(16)).slice(-2);
        }).join('');
    }

    // Five shades of one color, darkest first: outline, shadow, base, light, highlight
    L.ramp = function (base) {
        return [mix(base, '#000000', 0.62), mix(base, '#000000', 0.3), base, mix(base, '#ffffff', 0.28), mix(base, '#ffffff', 0.6)];
    };

    // Materials for a part that's been on the car for years, and for one out of the box
    var OLD = {
        paint:  ['#2a1408', '#5a2e14', '#7a4426', '#94603e', '#ad7c58'],
        iron:   ['#1e1612', '#3e2e24', '#5e4a3a', '#7c6652', '#9a826a'],
        alum:   ['#2c2a26', '#55524a', '#7a766a', '#9a9586', '#b5b0a0'],
        chrome: ['#2a2622', '#5a5248', '#857a6c', '#a69a88', '#c0b4a0'],
        steel:  ['#1e1e1e', '#3a3632', '#57514a', '#746c62', '#8f867a'],
        pipe:   ['#2a1208', '#5c2a10', '#8b4513', '#a8642e', '#c48450'],
        rubber: ['#121212', '#262626', '#3a3a38', '#504e4a', '#686460']
    };
    var NEW = {
        paint:  ['#5a1e05', '#a33a0c', '#e0601e', '#f08a4a', '#ffc090'],
        iron:   ['#16191e', '#30363f', '#4e5866', '#76828f', '#a8b4c0'],
        alum:   ['#3a4048', '#7a8490', '#b0bac4', '#d8e0e8', '#ffffff'],
        chrome: ['#2a2e38', '#5a6070', '#a0a8b8', '#e0e6f0', '#ffffff'],
        steel:  ['#1c2026', '#3a424e', '#66707e', '#9aa4b2', '#d0d8e2'],
        pipe:   ['#2a2e38', '#5a6070', '#a0a8b8', '#e0e6f0', '#ffffff'],
        rubber: ['#050505', '#141414', '#202020', '#383838', '#585858']
    };

    // ── Pixel primitives (whole pixels only, so nothing blurs when scaled) ─

    function rect(ctx, x, y, w, h, color) {
        if (w <= 0 || h <= 0) return;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    function disc(ctx, cx, cy, r, color) {
        ctx.fillStyle = color;
        cx = Math.round(cx); cy = Math.round(cy);
        for (var dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
            var w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
            ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
        }
    }

    function ring(ctx, cx, cy, r, thick, color) {
        ctx.fillStyle = color;
        cx = Math.round(cx); cy = Math.round(cy);
        for (var dy = -r; dy <= r; dy++) {
            for (var dx = -r; dx <= r; dx++) {
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d <= r + 0.4 && d > r - thick + 0.4) ctx.fillRect(cx + dx, cy + dy, 1, 1);
            }
        }
    }

    // A box lit from the top left: outline, light top and left edges, shadow bottom and right
    function box(ctx, x, y, w, h, c) {
        rect(ctx, x, y, w, h, c[0]);
        rect(ctx, x + 1, y + 1, w - 2, h - 2, c[2]);
        rect(ctx, x + 1, y + 1, w - 2, 1, c[3]);
        rect(ctx, x + 1, y + 1, 1, h - 2, c[3]);
        rect(ctx, x + 1, y + h - 3, w - 2, 2, c[1]);
        rect(ctx, x + w - 2, y + 2, 1, h - 3, c[1]);
        rect(ctx, x + 2, y + 2, Math.min(8, w - 5), 1, c[4]);
    }

    // A round part lit from the top left
    function ball(ctx, cx, cy, r, c) {
        disc(ctx, cx, cy, r, c[0]);
        disc(ctx, cx, cy, r - 1, c[1]);
        disc(ctx, cx - 1, cy - 1, r - 2, c[2]);
        if (r > 6) disc(ctx, cx - r * 0.35, cy - r * 0.35, r * 0.3, c[3]);
        rect(ctx, cx - r * 0.45, cy - r * 0.5, 2, 1, c[4]);
    }

    // A pipe: bands of shade across it, lit from above (or from the left when it stands up)
    function tube(ctx, x, y, w, h, c, upright) {
        var n = upright ? w : h;
        var bands = [0, 3, 4, 2, 2, 2, 1, 1, 0];
        for (var i = 0; i < n; i++) {
            var k = bands[Math.min(bands.length - 1, Math.floor(i * bands.length / n))];
            if (i === n - 1) k = 0;
            if (upright) rect(ctx, x + i, y, 1, h, c[k]); else rect(ctx, x, y + i, w, 1, c[k]);
        }
    }

    // Cooling fins or ribs: a shadow line with a lit line beside it
    function ribs(ctx, x, y, w, h, step, c, across) {
        for (var i = step; i < (across ? h : w) - 1; i += step) {
            if (across) { rect(ctx, x, y + i, w, 1, c[1]); rect(ctx, x, y + i + 1, w, 1, c[3]); }
            else { rect(ctx, x + i, y, 1, h, c[1]); rect(ctx, x + i + 1, y, 1, h, c[3]); }
        }
    }

    // The same pseudo-random dots every frame, from a seed
    function speckle(ctx, x, y, w, h, seed, colors, density, inside) {
        var s = seed;
        var count = Math.round(w * h * density);
        for (var i = 0; i < count; i++) {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            var px = x + s % w;
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            var py = y + s % h;
            if (inside && !inside(px, py)) continue;
            rect(ctx, px, py, 1 + (s >> 8) % 2, 1, colors[(s >> 4) % colors.length]);
        }
    }

    L.art = { rect: rect, disc: disc, ring: ring, box: box, ball: ball, tube: tube, ribs: ribs, speckle: speckle, mix: mix };

    // ── Cars ──────────────────────────────────────────────────────────────

    // A late-40s coupe side-on, facing right, 44 x 22 pixels
    var CAR = [
        '.............ooooooooooooooo................',
        '...........oohhhhhhhhhhhhhhhoo..............',
        '..........olwgwwwwwwlwgwwwwwwlo.............',
        '.........omwwwgwwwwwmwwgwwwwwwmo............',
        '.........omwwwwwwwwwmwwwgwwwwwwmo...........',
        '........omwwwwwwwwwwmwwwwwwwwwwwmccccc......',
        '.......ommmmmmmmmmmmmmmmmmmmmmmmmCCCCC......',
        '..ooooollllllllllllldlllllllllllllloooooo...',
        '.olllllllhllllllllhldllllllhllldllllhlllloo.',
        'rmmmmmmmmmmmmmmmmmmmdmccmmmmmmmdmmmmmmmmmmyy',
        'rmmmmmmmmmmmmmmmmmmmdmmmmmmmmmmdmmmmmmmmmmmo',
        'ommmccccccccccccccccdccccccccccdccccccccmmmo',
        'cmmmmmmkkkkkmmmmmmmmdmmmmmmmmmmdmmkkkkkmmmmc',
        'cmmmmmkkkttkkmmmmmmmdmmmmmmmmmmdmkkktkkkmmmc',
        'cddddkkTTttttkddddddddddddddddddkkTTtttkkddc',
        '.oddkkTtttttttkddddddddddddddddkktttttttkko.',
        '..ookkttttctttkooooooooooooooookktttctttkk..',
        '.....ttttccCttt.................tttccCttt...',
        '......ttttCttt...................tttCttt....',
        '......tttttttt...................ttttttt....',
        '.......tttttt.....................ttttt.....',
        '.........tt.........................t.......'
    ];
    // A late-60s muscle car on the same chassis: a low fastback roof, a spoiler on the deck and
    // a scoop on the hood, so the liveries and the bodywork's rust spots land on it the same way
    var MUSCLE = [
        '............................................',
        '............................................',
        '.............ooooooooooooo..................',
        '..........oooohhhhhhhhhhhhoo................',
        'oo......oolwwwgwwwwwwlwwgwwwwlo.............',
        'ohoo..oomwwwwwwgwwwwwmwwwwgwwwwmoo...oooo...',
        'odmmoommmmmmmmmmmmmmmmmmmmmmmmmmmmmmohhhhoo.',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A mid-80s coupe: a flat, square roof and a long low wedge front to back
    var EIGHTIES = [
        '............................................',
        '............................................',
        '..............ooooooooooooo.................',
        '............oolhhhhhhhhhhhoo................',
        '..........oolwwwwgwwwwlwwwgwwwloo...........',
        '.oooooooommwwwwwwwgwwwwlwwwwgwwwwmmoooooooo.',
        'ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmoo',
        MUSCLE[7]
    ].concat(CAR.slice(8));
    // A mid-90s coupe: a rounded bubble roof, a sloping nose and a wing on the trunk
    var NINETIES = [
        '............................................',
        '............................................',
        '................ooooooooo...................',
        '.oooo.........oohhhhhhhhhoo.................',
        '..oo........oolwwwgwwwwlwwwgwoo.............',
        '..oo.....ooomwwwwwgwwwwwlwwwwgwwmoooo.......',
        '.ommmmoommmmmmmmmmmmmmmmmmmmmmmmmmmmmmoooo..',
        MUSCLE[7]
    ].concat(CAR.slice(8));
    // A mid-2000s sedan: a high beltline, a small chopped greenhouse and a tall wing
    var AUGHTS = [
        '............................................',
        '............................................',
        '................oooooooo....................',
        '..............oohhhhhhhhoo..................',
        '.oooooo.....oolwwgwwwlwwgwoo................',
        '...oo.....oommwwwwgwwwlwwwgwmmoooo..........',
        '.ommmmmooommmmmmmmmmmmmmmmmmmmmmmmmmmmmoooo.',
        MUSCLE[7]
    ].concat(CAR.slice(8));
    // A 2020s coupe: a low fastback roof set well back, a long hood and a ducktail spoiler
    var MODERN = [
        '............................................',
        '............................................',
        '.............oooooooooo.....................',
        '..........ooolhhhhhhhhhoo...................',
        '.oo.....oolwwwwgwwwwlwwwgwoo................',
        '.oooo.oommwwwwwwgwwwwlwwwwgwmmmooo..........',
        'ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmoo.',
        MUSCLE[7]
    ].concat(CAR.slice(8));
    // A late-40s to early-50s sedan: an upright roof with a door pillar and a trunk bustle
    var SEDAN = [
        '............................................',
        '...........ooooooooooooooooooo..............',
        '..........ohhhhhhhhhhhhhhhhhhho.............',
        '.........olwwgwwwwgmwwgwwwwgwlo.............',
        '.........omwwgwwwwgmwwgwwwwgwwmo............',
        '........omwwgwwwwgwmwwgwwwwgwwwmo...........',
        '.oooooommmmmmmmmmmmmmmmmmmmmmmmmmmmmmccccc..',
        '..ooooollllllllllllldlllllllllllllloooooo...'
    ].concat(CAR.slice(8));
    // A late-50s hardtop: a long flat roof, a wraparound windshield and tail fins
    var FINS = [
        '............................................',
        '............................................',
        '............oooooooooooooooooo..............',
        '..........oohhhhhhhhhhhhhhhhhhoo............',
        'oo.......olwwgwwwwgwmwwgwwwwgwwlo...........',
        'ohoo....omwwgwwwwgwwmwwgwwwwgwwwmo..........',
        'ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmccc.',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A muscle-era notchback: a formal roof and a long trunk
    var HARDTOP = [
        '............................................',
        '............................................',
        '.............oooooooooooooo.................',
        '...........oohhhhhhhhhhhhhhoo...............',
        '..........olwwgwwwlwwgwwwwgwlo..............',
        '..oo.....omwwgwwwwmwwgwwwwgwwmoo............',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo.',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A late-60s compact: a tall boxy roof and short ends
    var COMPACT = [
        '............................................',
        '............oooooooooooooooo................',
        '...........ohhhhhhhhhhhhhhhho...............',
        '..........olwwgwwwwmwwgwwwwglo..............',
        '..........omwwgwwwwmwwgwwwwgwmo.............',
        '.........omwwgwwwwgmwwgwwwwgwwmo............',
        '..oooooommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo.',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A Fox body: an upright roof, a hatch and a flat nose
    var FOX = [
        '............................................',
        '............................................',
        '.............ooooooooooooooo................',
        '...........oohhhhhhhhhhhhhhloo..............',
        '.........oolwwgwwwlwwgwwwwgwwloo............',
        '..oooooommwwgwwwwlwwgwwwwgwwwmmoooooo.......',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A G-body: a formal square roof, a long hood and a short trunk
    var GBODY = [
        '............................................',
        '............................................',
        '..........oooooooooooooooo..................',
        '.........ohhhhhhhhhhhhhhhho.................',
        '.........olwwgwwmmwwgwwwwglo................',
        '.........omwwgwwmmwwgwwwwgwmoooooo..........',
        '.ooooooooommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A mid-90s full-size four-door: a long greenhouse and a tall trunk
    var BIGSEDAN = [
        '............................................',
        '............................................',
        '............oooooooooooooooooo..............',
        '..........oohhhhhhhhhhhhhhhhhhoo............',
        '........oolwwgwwwwgwmwwgwwwwgwwloo..........',
        '..ooooommwwgwwwwgwwmwwgwwwwgwwwwmmoooo......',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A mid-90s sports car: a low tapering roof and a big wing
    var SPORTS = [
        '............................................',
        '............................................',
        '............................................',
        'ooooo..........oooooooooooo.................',
        '.ohho.......oolhhhhhhhhhhhloo...............',
        '..oo.....oommwwgwwwlwwgwwwwgmmooo...........',
        '.ommmooommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmoo',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A mid-2000s big sedan: a chopped roof, a high beltline and slit windows
    var CHOPPED = [
        '............................................',
        '............................................',
        '...........oooooooooooooooooooo.............',
        '..........ohhhhhhhhhhhhhhhhhhhho............',
        '.........olwwgwwwwgwwmwwgwwwwgwlo...........',
        '.oooooooommmmmmmmmmmmmmmmmmmmmmmmmmmmoooooo.',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A mid-2000s grand tourer: a low rounded roof and no wing
    var GT = [
        '............................................',
        '............................................',
        '............................................',
        '..............oooooooooooo..................',
        '...........oolhhhhhhhhhhhhloo...............',
        '....oooo.oommwwgwwwlwwgwwwwgmmooo...........',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A 2020s retro muscle car: a flat roof, a square tail and a hood bulge
    var RETRO = [
        '............................................',
        '............................................',
        '............ooooooooooooooo.................',
        '..........oohhhhhhhhhhhhhhhoo...............',
        '.........olwwgwwwwmwwgwwwwgwlo..............',
        '.oooooooommwwgwwwwgmwwgwwwwgwwoo..oooo......',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // A 2020s supercar: the cab set forward, a long tail and a low nose
    var SUPERCAR = [
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        'oooo............oooooooooo..................',
        '.oo.....ooooooommhhhhhhhhhhmoo..............',
        '.ommmmmmmmmmwwgwwlwwgwwwmmmmmmmmmmmmmmmmmmo.',
        '.olllllllllllllllllldlllllllllllllllllllllo.'
    ].concat(CAR.slice(8));
    // The body below the beltline, rows 8 to 21, for the cars after the late-40s fat fenders:
    // a slab side from tail to nose cut by wheel arches, with the era's wheels. p: wheels (the
    // two wheel centres' columns), tire (radius), rim (radius), cy (the wheels' centre row),
    // rocker (the lowest row of body), style ('chrome': a chrome hubcap and bumpers, 'white'
    // the same on whitewalls, 'mag': slotted mags, 'alloy': big five-spoke rims), doors (door
    // lines' columns), nose and tail (rows the ends drop by: a wedge or a tapered tail).
    function lowerBody(p) {
        var B = 8 + DROP, H = 22 - B, Wd = 44, g = [];
        for (var r = 0; r < H; r++) g.push(new Array(Wd).fill('.'));
        function set(col, row, ch) { if (row >= 0 && row < H && col >= 0 && col < Wd) g[row][col] = ch; }
        function at(col, row) { return row >= 0 && row < H && col >= 0 && col < Wd ? g[row][col] : '.'; }
        var top = 0, rocker = p.rocker - B, cy = p.cy - B;
        var chrome = p.style === 'chrome' || p.style === 'white';
        // The slab: rows 0 (row 8) to the rocker, the ends rounded off and dropped by nose/tail
        for (var row = top; row <= rocker; row++) {
            var x0 = 1 + (row > rocker - 1 ? 1 : 0) + (row < (p.tail || 0) ? (p.tail - row) : 0);
            var x1 = 42 - (row > rocker - 1 ? 1 : 0) - (row < (p.nose || 0) ? (p.nose - row) : 0);
            for (var col = x0; col <= x1; col++) set(col, row, row >= rocker - 1 ? 'd' : 'm');
        }
        // Wheel arches, then the wheels in them
        p.wheels.forEach(function (wx) {
            for (var row = 0; row < H; row++) for (var col = wx - p.tire - 2; col <= wx + p.tire + 2; col++) {
                var dx = col - wx, dy = row - cy;
                if (dy <= 0.5 && dx * dx + dy * dy <= (p.tire + 1.4) * (p.tire + 1.4) && row > 1) set(col, row, '.');
                if (dy > 0.5 && Math.abs(dx) <= p.tire + 1 && row <= rocker) set(col, row, '.');
            }
        });
        // Outline: a body pixel next to an empty one
        var out = [];
        for (var r2 = 0; r2 < H; r2++) for (var c2 = 0; c2 < Wd; c2++) {
            if ('mld'.indexOf(at(c2, r2)) < 0) continue;
            if ([[1, 0], [-1, 0], [0, 1]].some(function (d) { return at(c2 + d[0], r2 + d[1]) === '.'; }) || (r2 > 0 && at(c2, r2 - 1) === '.' && r2 > 1)) out.push([c2, r2]);
        }
        out.forEach(function (q) { set(q[0], q[1], 'o'); });
        // Door lines, a crease along the side, lights and bumpers
        (p.doors || [20]).forEach(function (dc) { for (var row = 1; row < rocker - 1; row++) if ('ml'.indexOf(at(dc, row)) >= 0) set(dc, row, 'd'); });
        for (var cc = 3; cc < 41; cc++) if (at(cc, 2) === 'm') set(cc, 2, 'l');
        set(1, 1, 'r'); set(1, 2, 'r');
        set(42 - (p.nose ? 0 : 0), 1, 'y');
        if (chrome) {
            for (var br = 3; br <= 5; br++) { set(0, br, 'c'); set(43, br, 'c'); }
            set(1, 4, 'C'); set(42, 4, 'C');
        }
        // Wheels: a tire, its rim, and the style's details
        p.wheels.forEach(function (wx) {
            for (var row = 0; row < H; row++) for (var col = wx - p.tire - 1; col <= wx + p.tire + 1; col++) {
                var dx = col - wx, dy = row - cy, d = Math.sqrt(dx * dx + dy * dy);
                if (d <= p.tire + 0.45) {
                    var ch = 't';
                    if (d > p.tire - 0.6 && dx < 0 && dy < 0) ch = 'T';
                    if (p.style === 'white' && d > p.rim + 0.3 && d <= p.rim + 1.2) ch = 'y';
                    if (d <= p.rim + 0.45) {
                        if (p.style === 'alloy') ch = (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && d > 0.5 ? 'c' : d <= 0.5 ? 'k' : 'C';
                        else if (p.style === 'mag') ch = d <= 0.5 ? 'k' : (Math.abs(dx) + Math.abs(dy)) % 2 ? 'C' : 'c';
                        else ch = d <= 0.5 ? 'k' : d > p.rim - 0.6 ? 'C' : 'c';
                    }
                    set(col, row, ch);
                }
            }
        });
        return g.map(function (r) { return r.join(''); });
    }
    // Each body's wheels and stance by era, on its own roof: 1963's whitewalls and chrome,
    // 1973's mags, and from 1985 on smaller tires on bigger alloy rims, lower to the ground
    // The roof sits DROP rows lower than the 40s coupe's, so the body side isn't a wall of
    // paint; liveries and rust spots shift down with it (L.shapeDrop)
    var DROP = 3, BLANK = new Array(45).join('.');
    function body(top, p) { return [BLANK, BLANK, BLANK].concat(top.slice(0, 8), lowerBody(p)); }
    var FIFTIES = { wheels: [9, 35], tire: 4, rim: 2, cy: 17, rocker: 16, style: 'white', doors: [20] };
    var SIXTIES = { wheels: [9, 35], tire: 4, rim: 2, cy: 17, rocker: 16, style: 'mag', doors: [21] };
    var EIGHTIES_W = { wheels: [9, 35], tire: 4, rim: 2, cy: 17, rocker: 16, style: 'alloy', doors: [22], nose: 2 };
    var MODERN_W = { wheels: [9, 35], tire: 4, rim: 3, cy: 17, rocker: 17, style: 'alloy', doors: [22] };
    function era(base, more) { return Object.assign({}, base, more); }
    var SHAPES = {
        coupe: CAR,
        sedan: body(SEDAN, era(FIFTIES, { style: 'chrome', doors: [20, 30] })),
        fins: body(FINS, era(FIFTIES, { wheels: [10, 35] })),
        muscle: body(MUSCLE, era(SIXTIES, {})),
        hardtop: body(HARDTOP, era(SIXTIES, { wheels: [9, 36] })),
        compact: body(COMPACT, era(SIXTIES, { style: 'chrome', wheels: [10, 34], tire: 3, rim: 2, cy: 18, rocker: 16 })),
        eighties: body(EIGHTIES, era(EIGHTIES_W, {})),
        fox: body(FOX, era(EIGHTIES_W, { nose: 0, wheels: [10, 34] })),
        gbody: body(GBODY, era(EIGHTIES_W, { nose: 0, style: 'mag', wheels: [9, 35] })),
        nineties: body(NINETIES, era(MODERN_W, { nose: 2, tire: 4, rim: 2 })),
        bigsedan: body(BIGSEDAN, era(MODERN_W, { doors: [19, 29], rim: 2 })),
        sports: body(SPORTS, era(MODERN_W, { nose: 3, tail: 1, cy: 18, rocker: 17 })),
        aughts: body(AUGHTS, era(MODERN_W, { nose: 1, doors: [20, 29] })),
        chopped: body(CHOPPED, era(MODERN_W, { doors: [20, 30], wheels: [9, 36] })),
        gt: body(GT, era(MODERN_W, { nose: 2, cy: 18, rocker: 17 })),
        modern: body(MODERN, era(MODERN_W, { nose: 1 })),
        retro: body(RETRO, era(MODERN_W, { wheels: [9, 36] })),
        supercar: body(SUPERCAR, era(MODERN_W, { nose: 3, tail: 1, cy: 18, rocker: 17, wheels: [10, 35] }))
    };
    L.CAR_SHAPES = Object.keys(SHAPES);
    // How many rows lower than the 40s coupe a shape's body sits
    L.shapeDrop = function (shape) { return SHAPES[shape] && SHAPES[shape] !== CAR ? DROP : 0; };
    var GLASS = { w: '#4a7aa8', g: '#cfe8ff', c: '#d8d8e0', C: '#7a7a86', t: '#141414', T: '#3a3a3a', k: '#060606', r: '#e02020', y: '#fff3b0' };
    var PAINT = { o: 0, d: 1, m: 2, l: 3, h: 4 };

    // Liveries from the paint shop, laid over the paint (and, for a racing number, the chrome).
    // Each gives a car pixel's colour: a shade of the trim colour (0-4, like PAINT), a colour,
    // or nothing to leave the paint showing. shade is the paint's shade at that pixel.
    var FLAME_TIPS = { 8: 31, 9: 25, 10: 29, 11: 23, 12: 27, 13: 32, 14: 35 };
    var LIVERY = {
        pinstripe: function (col, row) { return row === 8 && col >= 2 && col <= 40 ? 4 : null; },
        stripes: function (col, row, shade) { return (row === 9 || row === 10) && col >= 1 && col <= 42 ? shade : null; },
        twotone: function (col, row, shade) { return row <= 6 ? shade : null; },
        scallops: function (col, row, shade) {
            // Two spears running back from the nose, outlined at their points
            var tip = { 8: 24, 9: 16, 10: 24, 12: 30, 13: 22, 14: 30 }[row];
            if (tip === undefined || col < tip || col > 40) return null;
            return col === tip ? 0 : shade;
        },
        flames: function (col, row) {
            var tip = FLAME_TIPS[row];
            if (tip === undefined || col < tip) return null;
            var d = col - tip;
            return d < 2 ? '#c81e1e' : d < 4 ? '#f07a28' : '#ffd23f';
        },
        number: function (col, row) {
            // A white roundel on the door with a black 7
            var dx = col - 25, dy = row - 11;
            if (dx * dx + dy * dy > 6) return null;
            return [[24, 10], [25, 10], [26, 10], [26, 11], [25, 12], [25, 13]].some(function (p) { return p[0] === col && p[1] === row; })
                ? '#141414' : '#f2f2ea';
        }
    };
    L.LIVERY_ART = LIVERY;

    // A car's look: a paint colour, or { color, livery, trim } from L.carLook
    L.lookColor = function (look) { return typeof look === 'string' ? look : look.color; };

    // Draws a car with its roof at (x, y). look: a paint colour or { color, livery, trim, shape }.
    // opts: smoke, scale (whole pixels per car pixel), clip (only the part left of this x),
    // shape (the body's sprite, when look is only a colour)
    L.drawCar = function (ctx, x, y, look, opts) {
        opts = opts || {};
        var s = opts.scale || 1;
        var name = opts.shape || (typeof look === 'object' && look.shape);
        var CAR = SHAPES[name] || SHAPES.coupe;
        var drop = L.shapeDrop(name);
        var c = L.ramp(L.lookColor(look));
        var livery = typeof look === 'object' && look.livery ? LIVERY[look.livery] : null;
        var t = livery ? L.ramp(look.trim || '#f2f2ea') : null;
        x = Math.round(x); y = Math.round(y);
        for (var row = 0; row < CAR.length; row++) {
            var line = CAR[row];
            for (var col = 0; col < line.length; col++) {
                var ch = line[col];
                if (ch === '.') continue;
                var px = x + col * s;
                if (opts.clip !== undefined && px + s > opts.clip) continue;
                var fill = ch in PAINT ? c[PAINT[ch]] : GLASS[ch];
                if (livery && (ch in PAINT || (ch === 'c' && look.livery === 'number'))) {
                    var v = livery(col, row - drop, ch in PAINT ? PAINT[ch] : 3);
                    if (typeof v === 'number') fill = t[v];
                    else if (v) fill = v;
                }
                ctx.fillStyle = fill;
                ctx.fillRect(px, y + row * s, s, s);
            }
        }
        if (opts.smoke) {
            for (var i = 0; i < 4; i++) {
                var sx = x - 5 - i * 7, sy = y + 16 - (i % 2) * 3;
                disc(ctx, sx, sy, 3 - (i > 1 ? 1 : 0), '#9a9aa4');
                disc(ctx, sx - 1, sy - 1, 1.5, '#d8d8e0');
            }
        }
    };

    // ── The garage: pegboard wall, tools and the concrete floor ──────────

    L.drawGarage = function (ctx, W, H) {
        rect(ctx, 0, 0, W, 160, '#16162a');
        rect(ctx, 4, 20, W - 8, 132, '#1f1f38');                     // pegboard
        rect(ctx, 4, 20, W - 8, 1, '#2c2c50');
        rect(ctx, 4, 151, W - 8, 1, '#101020');
        for (var x = 10; x < W - 6; x += 10) {
            for (var y = 26; y < 150; y += 10) {
                rect(ctx, x, y, 1, 1, '#0c0c1a');
                rect(ctx, x + 1, y + 1, 1, 1, '#2a2a4a');
            }
        }
        // A combination wrench and a screwdriver hanging on the left, a hammer on the right
        var st = NEW.steel;
        rect(ctx, 18, 34, 2, 4, st[1]); tube(ctx, 16, 38, 6, 52, st, true);
        ring(ctx, 19, 34, 5, 2, st[3]); disc(ctx, 19, 94, 5, st[2]); rect(ctx, 17, 94, 4, 6, '#16162a');
        tube(ctx, 28, 46, 3, 30, NEW.chrome, true); box(ctx, 26, 76, 7, 22, ['#3a0a0a', '#7a1414', '#c02828', '#e05050', '#ff9090']);
        tube(ctx, 298, 40, 4, 50, ['#2a1a0a', '#5a3a1a', '#8a6034', '#a87a48', '#c89a68'], true);
        box(ctx, 290, 32, 20, 10, st);
        // Concrete floor with a lip, a crack and oil stains
        rect(ctx, 0, 160, W, H - 160, '#3a3a3e');
        rect(ctx, 0, 160, W, 1, '#55555c');
        rect(ctx, 0, 161, W, 1, '#2a2a2e');
        speckle(ctx, 0, 163, W, H - 163, 7, ['#444448', '#323236'], 0.03);
        ctx.fillStyle = '#2a2a2e';
        [[60, 170], [61, 171], [62, 172], [63, 172], [64, 173], [65, 174], [66, 174]].forEach(function (p) { ctx.fillRect(p[0], p[1], 1, 1); });
        disc(ctx, 40, 190, 3, '#26262a'); rect(ctx, 32, 189, 18, 3, '#26262a');
        disc(ctx, 260, 194, 2, '#26262a'); rect(ctx, 252, 193, 14, 2, '#26262a');
    };

    // ── The hub: your garage on a summer night, your car in the driveway ──

    // A small seeded random, so the stars and bricks land in the same place every time
    function seeded(seed) {
        return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    }

    // Draws the hub's 320x120 scene. color: the parked car's paint, or null for an empty
    // driveway. friday lights the burger stand's sign down the street.
    L.drawHubScene = function (ctx, W, H, look, friday) {
        var rnd = seeded(1963);
        // Night sky in bands, dithered where they meet
        var sky = ['#0a0a22', '#10102e', '#18183c', '#22204a', '#2e2652'];
        for (var b = 0; b < sky.length; b++) rect(ctx, 0, b * 16, W, 16, sky[b]);
        rect(ctx, 0, 80, W, 8, sky[4]);
        for (b = 1; b < sky.length; b++) {
            for (var x = (b % 2); x < W; x += 2) rect(ctx, x, b * 16 - 1, 1, 1, sky[b - 1]);
            for (x = ((b + 1) % 2); x < W; x += 4) rect(ctx, x, b * 16, 1, 1, sky[b - 1]);
        }
        for (var i = 0; i < 46; i++) {
            var sx = Math.floor(rnd() * W), sy = Math.floor(rnd() * 58);
            rect(ctx, sx, sy, 1, 1, rnd() < 0.25 ? '#ffffff' : '#8a8ab8');
        }
        disc(ctx, 262, 16, 7, '#e8e2c0'); disc(ctx, 265, 14, 6, sky[0]);   // a crescent moon
        rect(ctx, 258, 12, 1, 1, '#fff8d8');

        // The town behind: rooftops, a water tower and lit windows
        var town = '#0c0c1e';
        [[150, 66, 30, 22], [178, 58, 22, 30], [198, 70, 40, 18], [236, 62, 18, 26], [252, 72, 70, 16]].forEach(function (r) {
            rect(ctx, r[0], r[1], r[2], r[3], town);
            for (var wy = r[1] + 4; wy < 84; wy += 6) {
                for (var wx = r[0] + 3; wx < r[0] + r[2] - 3; wx += 5) {
                    if (rnd() < 0.3) rect(ctx, wx, wy, 2, 2, rnd() < 0.5 ? '#e0b040' : '#806020');
                }
            }
        });
        rect(ctx, 210, 46, 16, 10, town); rect(ctx, 212, 56, 2, 14, town); rect(ctx, 222, 56, 2, 14, town);
        rect(ctx, 208, 44, 20, 2, town);

        // Down the street, the burger stand's sign: lit on Friday night
        var neon = friday ? '#ff4fa0' : '#5a2a44', neon2 = friday ? '#ffd23f' : '#5a4a2a';
        rect(ctx, 268, 52, 44, 14, '#0c0c1e'); rect(ctx, 288, 66, 3, 22, '#0c0c1e');
        rect(ctx, 268, 52, 44, 1, neon); rect(ctx, 268, 65, 44, 1, neon);
        rect(ctx, 268, 52, 1, 14, neon); rect(ctx, 311, 52, 1, 14, neon);
        L.text(ctx, 'EATS', 290, 63, { color: neon2, align: 'center' });

        // The ground: a sidewalk, the curb and the road with a dashed line
        rect(ctx, 0, 88, W, 6, '#4a4a52'); rect(ctx, 0, 88, W, 1, '#5e5e68');
        rect(ctx, 0, 94, W, 2, '#7a7a84'); rect(ctx, 0, 96, W, 1, '#2a2a30');
        rect(ctx, 0, 97, W, H - 97, '#1e1e24');
        for (x = 4; x < W; x += 24) rect(ctx, x, 110, 12, 2, '#c8a830');

        // The garage: brick, a flat roof with trim, the sign and the open door
        var gx = 6, gy = 28, gw = 150, gh = 60;
        rect(ctx, gx, gy, gw, gh, '#6a2a1e');
        for (var by = gy; by < gy + gh; by += 4) {
            rect(ctx, gx, by, gw, 1, '#4a1a12');
            for (var bx = gx + ((by / 4) % 2 ? 0 : 4); bx < gx + gw; bx += 8) rect(ctx, bx, by + 1, 1, 3, '#4a1a12');
        }
        speckle(ctx, gx, gy, gw, gh, 5, ['#7e3626', '#5a2418'], 0.06);
        rect(ctx, gx - 3, gy - 4, gw + 6, 4, '#3a3a44'); rect(ctx, gx - 3, gy - 4, gw + 6, 1, '#5a5a66');
        rect(ctx, gx - 3, gy, gw + 6, 1, '#1a1a20');
        // The sign board, lit from below
        rect(ctx, 24, 32, 114, 13, '#101018'); rect(ctx, 24, 32, 114, 1, '#2a2a3a');
        L.text(ctx, "LEMON'S GARAGE", 81, 42, { color: '#ffd23f', align: 'center' });
        for (x = 30; x < 136; x += 14) rect(ctx, x, 45, 3, 1, '#fff3b0');
        // The open door: warm light, the pegboard and a workbench
        var dx = 26, dy = 50, dw = 110, dh = 38;
        rect(ctx, dx - 2, dy - 2, dw + 4, 2, '#3a3a44');
        rect(ctx, dx, dy, dw, dh, '#8a6a30');
        rect(ctx, dx, dy, dw, 6, '#5a4420');                     // the door, rolled up
        ribs(ctx, dx, dy, dw, 6, 2, ['#2a2010', '#4a3818', '#5a4420', '#6a5428', '#7a6430']);
        for (x = dx + 4; x < dx + dw - 2; x += 5) {
            for (var y = dy + 9; y < dy + 24; y += 4) rect(ctx, x, y, 1, 1, '#5a4420');
        }
        tube(ctx, dx + 10, dy + 9, 2, 12, NEW.steel, true); ring(ctx, dx + 11, dy + 9, 2, 1, NEW.steel[3]);
        rect(ctx, dx + 18, dy + 10, 8, 3, '#c02828'); rect(ctx, dx + 21, dy + 13, 2, 8, '#a0a8b8');
        box(ctx, dx + 4, dy + 26, 40, 4, ['#2a1a0a', '#5a3a1a', '#8a6034', '#a87a48', '#c89a68']);   // workbench
        rect(ctx, dx + 6, dy + 30, 2, 8, '#3a2410'); rect(ctx, dx + 40, dy + 30, 2, 8, '#3a2410');
        box(ctx, dx + 10, dy + 20, 12, 6, NEW.paint);                // a toolbox
        box(ctx, dx + 74, dy + 24, 14, 14, ['#3a0a0a', '#7a1414', '#c02828', '#e05050', '#ff9090']);  // tool chest
        ribs(ctx, dx + 74, dy + 24, 14, 14, 3, ['#3a0a0a', '#7a1414', '#c02828', '#e05050', '#ff9090']);
        rect(ctx, dx + 52, dy + 1, 10, 2, '#fff3b0'); rect(ctx, dx + 56, dy - 1, 2, 2, '#3a3a44');   // the bulb
        // Light spills out of the door across the driveway
        for (y = 88; y < 97; y++) {
            for (x = dx - (y - 88) * 2; x < dx + dw + (y - 88) * 2; x += 2) {
                if ((x + y) % 2 === 0 && x >= 0) rect(ctx, x, y, 1, 1, y < 94 ? '#7a6a48' : '#9a8a60');
            }
        }

        // A street lamp with its pool of light
        var lx = 258;
        tube(ctx, lx, 30, 3, 66, NEW.iron, true);
        rect(ctx, lx - 6, 28, 12, 3, '#30363f'); rect(ctx, lx - 4, 31, 8, 2, '#fff3b0');
        for (y = 34; y < 97; y++) {
            var half = Math.floor((y - 33) * 0.45);
            for (x = lx - half; x <= lx + half + 2; x++) {
                if ((x + y) % 3 === 0) rect(ctx, x, y, 1, 1, y < 88 ? '#3a3654' : '#6e6a5a');
            }
        }

        // Your car, parked out front
        if (look) {
            L.drawCar(ctx, 160, 52, look, { scale: 2 });
            rect(ctx, 166, 96, 76, 2, '#141418');                   // its shadow on the curb
        }
    };

    // ── Parts on the workbench ────────────────────────────────────────────

    // Each job's part, drawn in its materials. The shapes follow L.WRENCH's rects and circles,
    // so the bolts land on the part.
    var PARTS = {
        engine: function (ctx, m) {
            box(ctx, 105, 70, 110, 60, m.paint);                       // block
            ribs(ctx, 107, 70, 106, 60, 20, m.paint, true);
            ball(ctx, 135, 100, 5, m.alum); ball(ctx, 185, 100, 5, m.alum);   // freeze plugs
            box(ctx, 118, 58, 84, 13, m.chrome);                       // valve cover
            ribs(ctx, 120, 60, 80, 9, 8, m.chrome);
            rect(ctx, 96, 98, 22, 3, '#141414');                      // fan belt
            ball(ctx, 96, 112, 14, m.steel);                           // crank pulley
            ring(ctx, 96, 112, 9, 1, m.steel[1]);
            ball(ctx, 96, 112, 4, m.chrome);
        },
        carb: function (ctx, m) {
            box(ctx, 95, 125, 130, 15, m.paint);                       // intake under it
            box(ctx, 130, 80, 60, 40, m.alum);                         // carburetor body
            box(ctx, 140, 92, 14, 24, m.alum); box(ctx, 166, 92, 14, 24, m.alum);   // float bowls
            tube(ctx, 190, 96, 14, 4, m.chrome);                       // fuel line
            rect(ctx, 154, 112, 12, 3, m.steel[2]);                   // throttle linkage
            ball(ctx, 160, 70, 16, m.chrome);                          // air cleaner
            ring(ctx, 160, 70, 11, 1, m.chrome[1]);
            box(ctx, 154, 68, 12, 4, m.steel); ball(ctx, 160, 70, 2, m.steel);   // wing nut
        },
        intake: function (ctx, m) {
            for (var i = 0; i < 4; i++) box(ctx, 100 + i * 32, 78, 24, 12, m.alum);   // runners
            box(ctx, 90, 85, 140, 30, m.alum);                         // manifold
            box(ctx, 150, 92, 20, 16, m.alum);                         // carburetor pad
            rect(ctx, 154, 96, 4, 4, '#0a0a0a'); rect(ctx, 162, 96, 4, 4, '#0a0a0a');
            rect(ctx, 154, 102, 4, 4, '#0a0a0a'); rect(ctx, 162, 102, 4, 4, '#0a0a0a');
            box(ctx, 90, 132, 140, 16, m.paint);                       // valve cover below
            ribs(ctx, 92, 134, 136, 12, 10, m.paint);
            ball(ctx, 120, 140, 4, m.chrome);                          // oil filler cap
        },
        cam: function (ctx, m) {
            box(ctx, 115, 65, 90, 70, m.paint);                        // timing cover
            ball(ctx, 160, 100, 18, m.steel);                          // cam gear
            for (var k = 0; k < 24; k++) {
                var a = k * Math.PI / 12;
                rect(ctx, 160 + Math.cos(a) * 17 - 1, 100 + Math.sin(a) * 17 - 1, 2, 2, m.steel[0]);
            }
            ring(ctx, 160, 100, 12, 1, m.steel[1]);
            ball(ctx, 160, 100, 6, m.chrome);
            rect(ctx, 159, 84, 2, 4, m.steel[4]);                     // timing mark
        },
        exhaust: function (ctx, m) {
            [100, 140, 172, 212].forEach(function (x) { tube(ctx, x, 90, 8, 50, m.pipe, true); });
            box(ctx, 85, 70, 150, 20, m.steel);                        // head flange
            tube(ctx, 100, 140, 120, 12, m.pipe);                      // collector
            tube(ctx, 220, 142, 18, 8, m.pipe);
        },
        trans: function (ctx, m) {
            tube(ctx, 190, 85, 70, 30, m.iron);                        // tailshaft
            box(ctx, 254, 88, 8, 24, m.steel);                         // output yoke
            box(ctx, 110, 60, 80, 80, m.iron);                         // case
            ribs(ctx, 112, 66, 76, 68, 10, m.iron);
            box(ctx, 140, 52, 20, 10, m.iron);                         // shift tower
            tube(ctx, 148, 30, 4, 24, m.chrome, true);                 // shifter
            ball(ctx, 150, 28, 4, ['#100808', '#3a1010', '#802020', '#c04040', '#ff8080']);
        },
        rear: function (ctx, m) {
            tube(ctx, 40, 92, 75, 16, m.iron); tube(ctx, 205, 92, 75, 16, m.iron);   // axle tubes
            box(ctx, 36, 88, 6, 24, m.steel); box(ctx, 278, 88, 6, 24, m.steel);
            ball(ctx, 160, 100, 45, m.iron);                           // housing
            ball(ctx, 160, 100, 33, m.chrome);                         // cover
            ring(ctx, 160, 100, 25, 1, m.chrome[1]);
            ball(ctx, 160, 116, 3, m.steel);                           // fill plug
        },
        tires: function (ctx, m) {
            ball(ctx, 160, 100, 50, m.rubber);                         // tire
            for (var k = 0; k < 30; k++) {                              // tread blocks
                var a = k * Math.PI / 15;
                rect(ctx, 160 + Math.cos(a) * 47 - 1, 100 + Math.sin(a) * 47 - 1, 3, 3, m.rubber[0]);
            }
            ring(ctx, 160, 100, 38, 1, m.rubber[3]);                   // sidewall bead
            ball(ctx, 160, 100, 30, m.steel);                          // wheel
            ring(ctx, 160, 100, 26, 1, m.steel[1]);
            ball(ctx, 160, 100, 11, m.chrome);                         // hubcap
        },
        rebuild: function (ctx, m) {
            [85, 165].forEach(function (x) {
                box(ctx, x, 72, 70, 56, m.iron);                       // cylinder head
                for (var i = 0; i < 4; i++) {
                    rect(ctx, x + 14 + i * 13, 92, 3, 3, m.chrome[2]);  // rocker studs
                    rect(ctx, x + 14 + i * 13, 100, 3, 3, m.chrome[2]);
                }
                [x + 18, x + 35, x + 52].forEach(function (px) { ball(ctx, px, 112, 3, m.steel); disc(ctx, px, 112, 1, '#0a0a0a'); });
            });
        }
    };

    // Whether a point is on one of a job's shapes
    function onPart(job, x, y) {
        return (job.rects || []).some(function (r) { return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]; }) ||
            (job.circles || []).some(function (c) { return Math.hypot(x - c[0], y - c[1]) < c[2] - 1; });
    }

    // Draws a job's part, worn (with rust and grease) or new (with a glint), lifted by dy
    L.drawPart = function (ctx, jobId, isNew, dy, clock) {
        var job = L.WRENCH[jobId];
        ctx.save();
        ctx.translate(0, Math.round(dy));
        PARTS[jobId](ctx, isNew ? NEW : OLD);
        if (!isNew) {
            speckle(ctx, 30, 20, 260, 140, jobId.length * 97 + 13, ['#8b4513', '#5c2e0e', '#1a1410', '#a0522d'], 0.05,
                function (x, y) { return onPart(job, x, y); });
        } else if (Math.floor((clock || 0) * 2) % 3 === 0) {           // a glint on the fresh part
            var r = job.rects && job.rects[0];
            var c = job.circles && job.circles[0];
            var gx = r ? r[0] + 6 : c[0] - c[2] * 0.5, gy = r ? r[1] + 5 : c[1] - c[2] * 0.5;
            rect(ctx, gx - 2, gy, 5, 1, '#ffffff');
            rect(ctx, gx, gy - 2, 1, 5, '#ffffff');
        }
        ctx.restore();
    };

    // A bracket behind a bolt that holds something else, so it isn't floating in air
    L.drawBracket = function (ctx, x, y) {
        box(ctx, x - 7, y - 7, 15, 15, OLD.steel);
    };

    // ── Bolts ─────────────────────────────────────────────────────────────

    var BOLT = [
        ['..ooooo..', '.ohlllmo.', 'ohlllllmo', 'olllkmmmo', 'ollkkkmdo', 'olmmkmddo', 'ommmmddo.', '.oddddo..', '..oooo...'],
        ['....o....', '..oohoo..', '.ohlllmo.', 'ohllllmmo', 'ollkkkmdo', 'olmmmmddo', '.ommmddo.', '..oddoo..', '....o....']
    ];
    var BOLT_COLORS = {
        steel: { o: '#14141a', h: '#ffffff', l: '#e0e0e8', m: '#b0b0bc', d: '#70707c', k: '#50505a' },
        other: { o: '#101014', h: '#a8a8b0', l: '#8a8a94', m: '#6e6e78', d: '#4a4a52', k: '#3a3a42' },
        wrong: { o: '#300808', h: '#ffc0c0', l: '#ff6060', m: '#e02020', d: '#900000', k: '#600000' }
    };

    // A bolt head centred on (x, y); frame 0 or 1 turns it a twelfth, for spinning
    L.drawBolt = function (ctx, x, y, kind, frame) {
        var sprite = BOLT[frame % 2], pal = BOLT_COLORS[kind];
        x = Math.round(x) - 4; y = Math.round(y) - 4;
        for (var r = 0; r < 9; r++) {
            for (var c = 0; c < 9; c++) {
                var ch = sprite[r][c];
                if (ch === '.' || !ch) continue;
                ctx.fillStyle = pal[ch];
                ctx.fillRect(x + c, y + r, 1, 1);
            }
        }
    };

    // The empty hole a bolt came out of
    L.drawHole = function (ctx, x, y) {
        disc(ctx, x, y, 2.5, '#050505');
        rect(ctx, x + 1, y + 2, 2, 1, '#555560');
    };

    // The pulsing ring around a bolt or spot that still needs doing
    L.drawTarget = function (ctx, x, y, r, clock) {
        ring(ctx, x, y, r, 2, Math.floor(clock * 6) % 2 ? '#ffb000' : '#ff7a00');
    };
})(window.Lemon = window.Lemon || {});

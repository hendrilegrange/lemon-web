// The story that opens a new game, a few pixel-art panels the way the old games set the
// scene, and Mac's tips: the tutorial that walks a new player through the real screens.
// Drawing only; the screens are in ui.js.
(function (L) {
    'use strict';

    var A = L.art, rect = A.rect, disc = A.disc;

    // A night (or dusk) sky in dithered bands, with stars
    function sky(ctx, W, bands, stars) {
        var h = 16;
        for (var b = 0; b < bands.length; b++) rect(ctx, 0, b * h, W, h, bands[b]);
        for (b = 1; b < bands.length; b++) {
            for (var x = b % 2; x < W; x += 2) rect(ctx, x, b * h - 1, 1, 1, bands[b - 1]);
        }
        var s = 7;
        for (var i = 0; i < stars; i++) {
            s = (s * 16807) % 2147483647;
            var sx = s % W;
            s = (s * 16807) % 2147483647;
            rect(ctx, sx, s % 40, 1, 1, i % 4 ? '#8a8ab8' : '#ffffff');
        }
    }

    // Rooftops and a water tower against the sky, lit windows here and there
    function town(ctx, y, color, lit) {
        var blocks = [[0, 14, 34], [30, 8, 24], [52, 18, 40], [90, 4, 22], [110, 12, 46], [154, 20, 30], [182, 10, 26], [206, 16, 48], [252, 6, 30], [280, 14, 40]];
        var s = 3;
        blocks.forEach(function (b) {
            rect(ctx, b[0], y + b[1], b[2], 40, color);
            for (var wy = y + b[1] + 4; wy < y + 34; wy += 6) {
                for (var wx = b[0] + 3; wx < b[0] + b[2] - 3; wx += 5) {
                    s = (s * 16807) % 2147483647;
                    if (lit && s % 10 < 3) rect(ctx, wx, wy, 2, 2, s % 2 ? '#e0b040' : '#806020');
                }
            }
        });
        rect(ctx, 236, y - 6, 16, 10, color); rect(ctx, 234, y - 8, 20, 2, color);
        rect(ctx, 238, y + 4, 2, 14, color); rect(ctx, 248, y + 4, 2, 14, color);
    }

    function road(ctx, W, y, H) {
        rect(ctx, 0, y, W, H - y, '#1e1e24');
        rect(ctx, 0, y, W, 1, '#3a3a44');
        for (var x = 4; x < W; x += 24) rect(ctx, x, y + Math.round((H - y) / 2), 12, 2, '#c8a830');
    }

    // A pixel crown, w wide
    function crown(ctx, x, y) {
        var rows = ['g.....g.....g', 'gg...ggg...gg', 'ggg.ggrgg.ggg', 'ggggggggggggg', 'GGGGGGGGGGGGG', 'gRgggBgggRggg', 'GGGGGGGGGGGGG'];
        var c = { g: '#ffd23f', G: '#c89a20', r: '#d7263d', R: '#d7263d', B: '#4fc3ff' };
        rows.forEach(function (row, dy) {
            for (var dx = 0; dx < row.length; dx++) if (c[row[dx]]) rect(ctx, x + dx * 2, y + dy * 2, 2, 2, c[row[dx]]);
        });
    }

    // The story, one panel at a time. draw(ctx, W, H, t): t in seconds since the panel came up.
    L.INTRO = [
        {
            text: 'Summer, 1963. A small town, a long straight road, and nothing to do on a Friday night but race.',
            draw: function (ctx, W, H, t) {
                sky(ctx, W, ['#2a1840', '#4a2050', '#7a2c4a', '#b8443a', '#e07a30'], 14);
                disc(ctx, 160, 80, 18, '#ffd23f'); disc(ctx, 160, 80, 14, '#ffe680');
                town(ctx, 58, '#1a0e24', false);
                road(ctx, W, 96, H);
                // telephone poles marching off
                for (var i = 0; i < 6; i++) rect(ctx, 20 + i * 56, 62, 2, 34, '#120a18');
                rect(ctx, 0, 66, W, 1, '#120a18');
                L.text(ctx, 'SUMMER 1963', W / 2, 26, { color: '#fff3b0', align: 'center', scale: 3 });
                // a car's headlights coming down the road
                var x = (t * 60) % (W + 80) - 40;
                rect(ctx, x, 104, 6, 2, '#fff3b0'); rect(ctx, x - 20, 105, 18, 1, 'rgba(255,243,176,0.25)');
            }
        },
        {
            text: 'You\'ve got $' + L.START_CASH + ', a driver\'s license and an empty garage at the edge of town.',
            draw: function (ctx, W, H) { L.drawHubScene(ctx, W, H, null, false); }
        },
        {
            text: 'The paper\'s full of junkers: rusty, tired and cheap. With enough work, one of them could fly.',
            draw: function (ctx, W, H, t) {
                sky(ctx, W, ['#10102e', '#18183c', '#22204a', '#2e2652', '#3a2c58'], 30);
                rect(ctx, 0, 84, W, H - 84, '#2a2418');
                A.speckle(ctx, 0, 86, W, H - 86, 9, ['#3a3020', '#1e1a10', '#4a3e28'], 0.08);
                // a sagging fence
                for (var x = 0; x < W; x += 12) rect(ctx, x, 60 + (x % 36 === 0 ? 1 : 0), 3, 26, '#3a2a1a');
                rect(ctx, 0, 66, W, 2, '#3a2a1a'); rect(ctx, 0, 78, W, 2, '#3a2a1a');
                var rust = A.mix(L.BODIES.ford48.color, '#7a4a2a', 0.6);
                L.drawCar(ctx, 116, 50, rust, { scale: 2, shape: L.BODIES.ford48.shape });
                // the For Sale sign on a stake, swinging a little
                var sway = Math.round(Math.sin(t * 2) * 1);
                rect(ctx, 236, 66, 2, 30, '#5a3a1a');
                rect(ctx, 214 + sway, 50, 48, 18, '#efe6cf'); rect(ctx, 214 + sway, 67, 48, 1, '#a89c78');
                L.text(ctx, 'FOR SALE', 238 + sway, 58, { color: '#d7263d', align: 'center' });
                L.text(ctx, '$350', 238 + sway, 66, { color: '#1d1a14', align: 'center' });
            }
        },
        {
            text: 'Every Friday night the whole town lines up at the burger stand. A quarter mile, two cars, and the winner takes the money. Sometimes the other guy\'s car.',
            draw: function (ctx, W, H, t) {
                sky(ctx, W, ['#0a0a22', '#10102e', '#18183c', '#22204a', '#2e2652'], 40);
                // the stand: a low building, a neon sign that buzzes
                rect(ctx, 8, 46, 120, 40, '#3a2a3a'); rect(ctx, 4, 42, 128, 5, '#d7263d');
                for (var x = 16; x < 124; x += 18) rect(ctx, x, 54, 12, 14, '#ffd88a');
                var on = Math.floor(t * 3) % 7 !== 0;
                rect(ctx, 30, 20, 76, 18, '#0c0c1e');
                rect(ctx, 30, 20, 76, 1, on ? '#ff4fa0' : '#5a2a44'); rect(ctx, 30, 37, 76, 1, on ? '#ff4fa0' : '#5a2a44');
                rect(ctx, 30, 20, 1, 18, on ? '#ff4fa0' : '#5a2a44'); rect(ctx, 105, 20, 1, 18, on ? '#ff4fa0' : '#5a2a44');
                L.text(ctx, 'BURGERS', 68, 32, { color: on ? '#ffd23f' : '#5a4a2a', align: 'center' });
                rect(ctx, 66, 38, 3, 8, '#0c0c1e');
                // the crowd
                for (var p = 0; p < 9; p++) {
                    var px = 10 + p * 13, bob = Math.round(Math.sin(t * 4 + p) * 0.6);
                    disc(ctx, px, 78 + bob, 2, '#12121e'); rect(ctx, px - 3, 81 + bob, 7, 8, '#12121e');
                }
                road(ctx, W, 88, H);
                // the Christmas tree: three ambers, then green, over and over
                var phase = t % 3.2, lit = Math.floor(phase / 0.5);
                rect(ctx, 150, 30, 2, 58, '#5a5a66'); rect(ctx, 145, 28, 12, 34, '#1a1a22');
                for (var k = 0; k < 3; k++) disc(ctx, 151, 33 + k * 7, 2, lit === k ? '#ffb020' : '#3a2a10');
                disc(ctx, 151, 56, 2, lit >= 3 && lit < 6 ? '#3bff6e' : '#0e3a1a');
                // two cars at the line, the right one creeping off on green
                var go = lit >= 3 && lit < 6 ? (phase - 1.5) * 50 : 0;
                L.drawCar(ctx, 160 + go * 0.9, 78, '#3b6fd8', { shape: L.BODIES.chevy55.shape });
                L.drawCar(ctx, 168 + go, 96, '#d7263d', { shape: L.BODIES.ford48.shape });
            }
        },
        {
            text: 'And at the top of the heap sits The King. Nobody\'s beaten him. Not yet. Buy a junker, build a hot rod, and take his crown.',
            draw: function (ctx, W, H, t) {
                rect(ctx, 0, 0, W, H, '#07070f');
                // a spotlight from above
                for (var y = 0; y < 100; y++) {
                    var half = 10 + y * 0.6;
                    rect(ctx, 160 - half, y, half * 2, 1, 'rgba(255,243,176,' + (0.05 + y * 0.0009).toFixed(3) + ')');
                }
                rect(ctx, 0, 100, W, H - 100, '#14141c');
                for (var x = 100; x < 220; x++) rect(ctx, x, 100, 1, 4, 'rgba(255,243,176,0.12)');
                // his car rolls into the light
                var roll = Math.min(1, t / 1.6), ease = 1 - Math.pow(1 - roll, 3);
                var look = L.rivalLook(Object.assign({}, L.KING, { king: true }));
                L.drawCar(ctx, -100 + ease * 216, 56, look, { scale: 2 });
                if (roll >= 1) {
                    crown(ctx, 147, 22 + Math.round(Math.sin(t * 3)));
                    L.text(ctx, 'THE KING', W / 2, 16, { color: '#ffd23f', align: 'center', scale: 2 });
                }
            }
        }
    ];

    // Mac's tips: the first time a screen comes up in a new game, he says what it's for and
    // what to do next. A function gets the game and returns the tip, or null for none.
    L.COACH = {
        'hub-start': 'Welcome to your garage, kid. Here\'s how a week goes: you get ' + L.HOURS_PER_WEEK +
            ' hours to buy, fix and build, then Friday night you race at the burger stand, and a new week starts. ' +
            'First you need wheels. Open the <b>Classifieds</b>.',
        ads: 'Five used cars this week, and new ones every week. Under each ad is my once-over: what fixing it costs, what it\'s worth fixed up, and how quick it could be. ' +
            'A car needs ' + L.MIN_BODY + '% body before anyone will race it. Buy one you can afford with money left over for repairs.',
        'hub-car': 'Nice ride. Now make it road-ready: open the <b>Garage</b>, then <b>Fix car</b>.',
        garage: 'Every car you own is here, and the shelf of spare parts. The car you drive is the one you race and fix. Hit <b>Fix car</b> to see what\'s worn.',
        fix: 'Each job costs money and garage hours. Get the body to ' + L.MIN_BODY + '% first, or you can\'t race. Then the engine: a worn engine is a slow engine. ' +
            'A job opens the workbench: click the orange bolts out, then back in.',
        parts: 'The speed shop. A better part makes you quicker, and the green number is how much it takes off your quarter mile. ' +
            'Engine parts only fit their own engine family. The stock changes every week.',
        paint: 'Paint doesn\'t make you quicker, but you\'ll look good losing. Kidding. Flames are The King\'s: beat him to wear them.',
        'hub-ready': 'Your car can race. When you\'re done in the garage, head to the <b>Burger stand</b>. Once you go, the garage is closed till next week, so spend your hours first.',
        stand: 'Friday night. Each rival shows both cars\' quarter mile times, and your chances in ten lights. ' +
            'Start with a race <b>for fun</b>: nothing at stake. Cash races bet money, pink slips bet the cars. ' +
            'Beat enough rivals and tougher ones show up, and then The King.',
        race: null,     // the race has its own primer
        result: 'That\'s the game. Win money on Friday, fix and upgrade your car in the week, and come back quicker. ' +
            'Beat The King for $10,000 and his car, and a new era begins. If you go broke, Dad will help out. Good luck, kid. You won\'t see me again.'
    };
})(window.Lemon = window.Lemon || {});

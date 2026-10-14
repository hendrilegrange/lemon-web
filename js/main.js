// Boot: the title screen animation and switching the canvas on and off between screens
(function (L) {
    'use strict';

    var canvas = document.getElementById('screen');
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var ROAD_Y = 150;
    var titleOn = false;

    L.canvas = canvas;

    L.showCanvas = function (on) { canvas.hidden = !on; };

    // Title screen: a hot rod revving at a drag strip light that cycles red, amber, green,
    // then launches
    var LIGHTS = 3000, RUN = 2200, PAUSE = 1200, CYCLE = LIGHTS + RUN + PAUSE;

    function sky() {
        ctx.fillStyle = '#0b0b1a';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f4e9c8';
        for (var i = 0; i < 40; i++) ctx.fillRect((i * 73) % W, (i * 37) % 90, 1, 1);
        // Burger stand on the horizon
        ctx.fillStyle = '#1c1c38';
        ctx.fillRect(220, 112, 70, 38);
        ctx.fillStyle = '#ff5c8a';
        ctx.fillRect(216, 106, 78, 6);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(228, 124, 12, 10);
        ctx.fillRect(248, 124, 12, 10);
        ctx.fillRect(268, 124, 12, 10);
    }

    function road() {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, ROAD_Y, W, H - ROAD_Y);
        ctx.fillStyle = '#f4e9c8';
        ctx.fillRect(0, ROAD_Y, W, 2);
        ctx.fillStyle = '#ffd23f';
        for (var x = 0; x < W; x += 24) ctx.fillRect(x, 176, 12, 2);
    }

    function title() {
        ctx.fillStyle = '#ffd23f';
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LEMON', W / 2, 40);
        ctx.fillStyle = '#8a8aa8';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText('A STREET ROD REMAKE', W / 2, 54);
    }

    function lights(t) {
        var x = 40, y = 92;
        ctx.fillStyle = '#111';
        ctx.fillRect(x - 6, y - 4, 12, 40);
        ctx.fillRect(x - 1, y + 36, 2, ROAD_Y - y - 36);
        var lit = t < 1000 ? 0 : t < 2000 ? 1 : t < LIGHTS + RUN ? 2 : -1;
        ['#ff3b3b', '#ffb000', '#3bff6e'].forEach(function (c, i) {
            ctx.fillStyle = i === lit ? c : '#333';
            ctx.fillRect(x - 3, y + i * 12, 6, 8);
        });
    }

    function frame(now) {
        if (!titleOn) return;
        var t = now % CYCLE;
        sky();
        road();
        title();
        lights(t);
        var y = ROAD_Y - 21;
        if (t < LIGHTS) {
            L.drawCar(ctx, 52, y + Math.round(Math.sin(t / 40)), '#d7263d');   // idle shake
        } else if (t < LIGHTS + RUN) {
            var p = (t - LIGHTS) / RUN;
            L.drawCar(ctx, 52 + p * p * (W + 20), y, '#d7263d', { smoke: true });   // accelerating off screen
        }
        requestAnimationFrame(frame);
    }

    L.titleScreen = function (on) {
        if (on && !titleOn) {
            titleOn = true;
            L.showCanvas(true);
            requestAnimationFrame(frame);
        } else if (!on && titleOn) {
            titleOn = false;
            L.showCanvas(false);
        }
    };

    L.initUi(document.getElementById('app'));
    L.showTitle();
})(window.Lemon = window.Lemon || {});

// Placeholder title screen: a hot rod revving at a drag strip light that cycles red,
// amber, green, then launches. Drawn at 320x200 and scaled up by CSS.
(function () {
    const canvas = document.getElementById('screen');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ROAD_Y = 150;

    // One run: 3 s of lights, the launch, then a pause with the road empty
    const LIGHTS = 3000, RUN = 2200, PAUSE = 1200, CYCLE = LIGHTS + RUN + PAUSE;

    function sky() {
        ctx.fillStyle = '#0b0b1a';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f4e9c8';
        for (let i = 0; i < 40; i++) {
            // Fixed pseudo-random stars so they don't flicker
            ctx.fillRect((i * 73) % W, (i * 37) % 90, 1, 1);
        }
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
        for (let x = 0; x < W; x += 24) ctx.fillRect(x, 176, 12, 2);
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
        const x = 40, y = 92;
        ctx.fillStyle = '#111';
        ctx.fillRect(x - 6, y - 4, 12, 40);
        ctx.fillRect(x - 1, y + 36, 2, ROAD_Y - y - 36);
        const lit = t < 1000 ? 0 : t < 2000 ? 1 : t < LIGHTS + RUN ? 2 : -1;
        ['#ff3b3b', '#ffb000', '#3bff6e'].forEach((c, i) => {
            ctx.fillStyle = i === lit ? c : '#333';
            ctx.fillRect(x - 3, y + i * 12, 6, 8);
        });
    }

    function car(x, t, launched) {
        const y = ROAD_Y - 12 + (launched ? 0 : Math.round(Math.sin(t / 40)));   // idle shake
        ctx.fillStyle = '#d7263d';
        ctx.fillRect(x, y, 44, 8);            // body
        ctx.fillRect(x + 10, y - 7, 20, 7);   // cab
        ctx.fillStyle = '#9ad1ff';
        ctx.fillRect(x + 13, y - 5, 6, 4);    // windows
        ctx.fillRect(x + 21, y - 5, 6, 4);
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(x + 32, y - 3, 6, 3);    // blower poking out of the hood
        ctx.fillStyle = '#111';
        ctx.fillRect(x + 4, y + 6, 10, 8);    // fat rear tire
        ctx.fillRect(x + 32, y + 8, 7, 6);
        if (launched) {
            ctx.fillStyle = '#bbb';           // tire smoke
            for (let i = 0; i < 4; i++) ctx.fillRect(x - 6 - i * 7, y + 8 - (i % 2) * 3, 6, 5);
        }
    }

    function frame(now) {
        const t = now % CYCLE;
        sky();
        road();
        title();
        lights(t);
        if (t < LIGHTS) {
            car(52, t, false);
        } else if (t < LIGHTS + RUN) {
            const p = (t - LIGHTS) / RUN;
            car(52 + p * p * (W + 20), t, true);   // accelerating off screen
        }
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
})();

// Sound: a V8 that burbles at idle and roars under load, sound effects for the strip and the
// workbench, and a rock'n'roll jukebox on the menus. Everything is made with Web Audio, no
// sound files. Audio only starts after a click or key press, so begin() is called from one.
(function (L) {
    'use strict';

    var KEY = 'lemon.sound', MUSIC_KEY = 'lemon.music';
    var ctx = null, master = null, sfx = null, musicBus = null, noise = null;
    var engine = null;
    var scene = 'menu';           // menu (jukebox), garage (jukebox, quieter) or race (no music)
    var MUSIC_VOL = { menu: 0.63, garage: 0.32, race: 0 };
    var SFX_VOL = 0.82;           // the effects bus
    var ENGINE_VOL = 0.15;        // the race engine at full throttle; it idles at 60% of that

    function load(key) {
        try { return localStorage.getItem(key) !== 'off'; } catch (e) { return true; }
    }
    function remember(key, on) {
        try { localStorage.setItem(key, on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
    }

    // One second of white noise, looped or cut short for hiss, grinding, snare and pops
    function noiseBuffer() {
        var b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var d = b.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    function setup() {
        master = ctx.createGain();
        master.gain.value = L.sound.on ? 0.9 : 0;
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        master.connect(comp);
        comp.connect(ctx.destination);
        // Effects run quieter than the music bus and through a gentle high cut, so nothing
        // on the strip or the workbench comes across as harsh
        sfx = ctx.createGain();
        sfx.gain.value = SFX_VOL;
        var soft = ctx.createBiquadFilter();
        soft.type = 'highshelf';
        soft.frequency.value = 3500;
        soft.gain.value = -9;
        var tame = ctx.createBiquadFilter();
        tame.type = 'lowpass';
        tame.frequency.value = 7000;
        sfx.connect(soft);
        soft.connect(tame);
        tame.connect(master);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0;
        musicBus.connect(master);
        noise = noiseBuffer();
    }

    // ── Building blocks ───────────────────────────────────────────────────

    // A note with a quick attack and a decay. o: { type, vol, at (seconds from now or an
    // absolute time with abs), slide (frequency to glide to), attack, out (node), filter }
    function tone(freq, dur, o) {
        o = o || {};
        var t = o.abs ? o.at : ctx.currentTime + (o.at || 0);
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
        if (o.vibrato) {
            var lfo = ctx.createOscillator(), depth = ctx.createGain();
            lfo.frequency.value = o.vibrato;
            depth.gain.value = freq * 0.03;
            lfo.connect(depth);
            depth.connect(osc.frequency);
            lfo.start(t);
            lfo.stop(t + dur + 0.05);
        }
        var vol = o.vol === undefined ? 0.2 : o.vol;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        var head = osc;
        if (o.filter) {
            var f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = o.filter;
            osc.connect(f);
            head = f;
        }
        head.connect(g);
        g.connect(o.out || sfx);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    // A burst of filtered noise. o: { type (filter), freq, slide, q, vol, at, abs, out }
    function hiss(dur, o) {
        o = o || {};
        var t = o.abs ? o.at : ctx.currentTime + (o.at || 0);
        var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = noise;
        src.loop = true;
        f.type = o.type || 'bandpass';
        f.frequency.setValueAtTime(o.freq || 1000, t);
        if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
        f.Q.value = o.q || 1;
        var vol = o.vol === undefined ? 0.2 : o.vol;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.008));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f);
        f.connect(g);
        g.connect(o.out || sfx);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.02);
    }

    function ready() { return ctx && L.sound.on; }

    // ── The jukebox ───────────────────────────────────────────────────────
    // A 12-bar boogie in A at a fast shuffle: walking bass, backbeat drums, piano stabs and a
    // lead riff that sits out every other time round so it doesn't nag

    var BPM = 168, BEAT = 60 / BPM, SWING = 0.64;
    var BARS = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];        // chord roots, semitones from A
    var WALK = [0, 4, 7, 9, 10, 9, 7, 4];                   // boogie bass, one bar of eighths
    var RIFF = {
        a: [12, null, 12, 10, 12, null, 7, 9],
        b: [10, 9, 7, null, 4, null, 0, null],
        turn: [7, null, 6, null, 5, null, 4, null]
    };
    var song = null;

    function hz(base, semis) { return base * Math.pow(2, semis / 12); }

    function eighth(n, bar, at) {
        var root = BARS[bar];
        var len = n % 2 ? BEAT * (1 - SWING) : BEAT * SWING;
        // Walking bass, with a square an octave under it for weight
        tone(hz(110, root + WALK[n]), len * 0.95, { type: 'triangle', vol: 0.5, at: at, abs: true, out: musicBus });
        tone(hz(55, root + WALK[n]), len * 0.9, { type: 'square', vol: 0.1, at: at, abs: true, out: musicBus, filter: 500 });
        // Drums: kick on 1 and 3, snare on 2 and 4, a hat on every eighth
        if (n === 0 || n === 4) tone(140, 0.18, { type: 'sine', vol: 0.7, slide: 45, at: at, abs: true, out: musicBus });
        if (n === 2 || n === 6) hiss(0.16, { type: 'bandpass', freq: 1800, q: 0.7, vol: 0.35, at: at, abs: true, out: musicBus });
        hiss(0.04, { type: 'highpass', freq: 7000, vol: n % 2 ? 0.08 : 0.12, at: at, abs: true, out: musicBus });
        // Piano stabs on the offbeats of 2 and 4: the chord's root, third, fifth and sixth
        if (n === 3 || n === 7) {
            [0, 4, 7, 9].forEach(function (s) {
                tone(hz(220, root + s), 0.14, { type: 'triangle', vol: 0.09, at: at, abs: true, out: musicBus });
            });
        }
        // Lead, on alternate choruses
        if (song.chorus % 2 === 1) {
            var riff = bar === 11 ? RIFF.turn : (bar % 2 ? RIFF.b : RIFF.a);
            var note = riff[n];
            if (note !== null) {
                tone(hz(440, root + note), len * 0.85, { type: 'square', vol: 0.11, at: at, abs: true, out: musicBus, filter: 2600, vibrato: 6 });
            }
        }
    }

    function schedule() {
        while (song.next < ctx.currentTime + 0.25) {
            eighth(song.step % 8, Math.floor(song.step / 8) % 12, song.next);
            song.next += song.step % 2 ? BEAT * (1 - SWING) : BEAT * SWING;
            song.step++;
            if (song.step % 96 === 0) song.chorus++;
        }
    }

    function musicStart() {
        if (song || !ready() || !L.sound.music) return;
        song = { step: 0, chorus: 0, next: ctx.currentTime + 0.1 };
        song.timer = setInterval(schedule, 60);
        schedule();
    }

    function musicStop() {
        if (!song) return;
        clearInterval(song.timer);
        song = null;
    }

    // Fade the jukebox to the scene's level, starting or stopping it as needed
    function applyScene() {
        if (!ctx) return;
        var vol = L.sound.music ? MUSIC_VOL[scene] : 0;
        musicBus.gain.setTargetAtTime(vol, ctx.currentTime, 0.15);
        if (vol > 0) musicStart();
        else setTimeout(function () { if ((L.sound.music ? MUSIC_VOL[scene] : 0) === 0) musicStop(); }, 600);
    }

    // ── The engine ────────────────────────────────────────────────────────

    // Soft clipping, so the engine growls instead of buzzing
    function growl(amount) {
        var n = 1024, curve = new Float32Array(n);
        for (var i = 0; i < n; i++) {
            var x = i * 2 / n - 1;
            curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
        }
        return curve;
    }

    L.sound = {
        on: load(KEY),
        music: load(MUSIC_KEY),

        toggle: function () {
            L.sound.on = !L.sound.on;
            remember(KEY, L.sound.on);
            if (!L.sound.on) { L.sound.engineOff(); musicStop(); }
            if (master) master.gain.setTargetAtTime(L.sound.on ? 0.9 : 0, ctx.currentTime, 0.05);
            if (L.sound.on) { L.sound.begin(); }
            return L.sound.on;
        },

        toggleMusic: function () {
            L.sound.music = !L.sound.music;
            remember(MUSIC_KEY, L.sound.music);
            L.sound.begin();
            applyScene();
            return L.sound.music;
        },

        // Call from a click or key handler: browsers only let audio start from one
        begin: function () {
            if (!L.sound.on) return;
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            try {
                if (!ctx) { ctx = new AC(); setup(); }
                if (ctx.state === 'suspended') ctx.resume();
            } catch (e) { ctx = null; return; }
            applyScene();
        },

        // Which screen is up: 'menu' plays the jukebox, 'garage' plays it quietly, 'race' stops it
        scene: function (name) {
            if (scene === name) return;
            scene = name;
            applyScene();
        },

        // The engine: a sawtooth at the firing pulse, a square an octave under it for the
        // cam's lope, and a second sawtooth an octave up, all through a soft clipper and a
        // low-pass that opens with the revs. A wobble on the volume gives the lumpy idle;
        // band-passed noise is the intake and exhaust roar under load.
        engineOn: function () {
            if (!ready() || engine) return;
            var out = ctx.createGain();
            out.gain.value = 0;
            out.connect(sfx);
            var filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 450;
            filter.Q.value = 1;
            filter.connect(out);
            var shaper = ctx.createWaveShaper();
            shaper.curve = growl(1.4);
            var lope = ctx.createGain();
            lope.gain.value = 1;
            shaper.connect(lope);
            lope.connect(filter);
            var lfo = ctx.createOscillator(), lfoDepth = ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 7;
            lfoDepth.gain.value = 0.5;
            lfo.connect(lfoDepth);
            lfoDepth.connect(lope.gain);
            lfo.start();
            var voices = [['sawtooth', 1, 0.4, 0], ['triangle', 0.5, 0.45, 0], ['triangle', 2, 0.15, 9]].map(function (v) {
                var o = ctx.createOscillator(), g = ctx.createGain();
                o.type = v[0];
                o.detune.value = v[3];
                o.frequency.value = 40;
                g.gain.value = v[2];
                o.connect(g);
                g.connect(shaper);
                o.start();
                return { osc: o, mult: v[1] };
            });
            var src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), roar = ctx.createGain();
            src.buffer = noise;
            src.loop = true;
            band.type = 'bandpass';
            band.Q.value = 0.9;
            band.frequency.value = 400;
            roar.gain.value = 0;
            src.connect(band);
            band.connect(roar);
            roar.connect(out);
            src.start();
            engine = { out: out, filter: filter, voices: voices, lfo: lfo, lfoDepth: lfoDepth, band: band, roar: roar, src: src };
        },

        // rpm sets the pitch; load (0-1) how hard it's working, which sets the volume and roar
        engineAt: function (rpm, load) {
            if (!engine) return;
            var t = ctx.currentTime;
            var f = Math.max(20, rpm / 30);                       // two pulses a revolution
            engine.voices.forEach(function (v) { v.osc.frequency.setTargetAtTime(f * v.mult, t, 0.02); });
            engine.lfo.frequency.setTargetAtTime(f / 4, t, 0.05);
            engine.lfoDepth.gain.setTargetAtTime(Math.max(0.08, 0.6 - rpm / 6000), t, 0.1);
            engine.filter.frequency.setTargetAtTime(280 + rpm / 9 + 380 * load, t, 0.08);
            engine.band.frequency.setTargetAtTime(250 + rpm / 7, t, 0.08);
            engine.roar.gain.setTargetAtTime(rpm > 0 ? 0.02 + 0.06 * load * Math.min(1, rpm / 5000) : 0, t, 0.12);
            engine.out.gain.setTargetAtTime(rpm > 0 ? ENGINE_VOL * (0.6 + 0.4 * load) : 0, t, 0.12);
        },

        engineOff: function () {
            if (!engine) return;
            var e = engine;
            engine = null;
            e.out.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
            setTimeout(function () {
                e.voices.forEach(function (v) { v.osc.stop(); });
                e.lfo.stop();
                e.src.stop();
            }, 500);
        },

        // ── Effects ───────────────────────────────────────────────────────

        // A start-light or shift-light beep: a sine with a soft triangle an octave under it
        beep: function (freq, seconds) {
            if (!ready()) return;
            tone(freq, seconds, { type: 'sine', vol: 0.12 });
            tone(freq / 2, seconds, { type: 'triangle', vol: 0.04 });
        },

        // Leaving the line: the tires bark
        launch: function () {
            if (!ready()) return;
            hiss(0.45, { freq: 1800, slide: 1200, q: 2, vol: 0.1, attack: 0.04 });
            tone(1200, 0.4, { type: 'triangle', vol: 0.02, slide: 900, vibrato: 20 });
        },

        // A gear change: the shifter clunks, and sometimes the exhaust pops on the lift
        shift: function () {
            if (!ready()) return;
            tone(130, 0.09, { type: 'sine', vol: 0.25, slide: 50 });
            hiss(0.05, { type: 'bandpass', freq: 800, q: 2, vol: 0.15 });
            if (Math.random() < 0.6) hiss(0.12, { type: 'lowpass', freq: 400, slide: 120, vol: 0.18, at: 0.03, attack: 0.015 });
        },

        // The engine lets go
        blow: function () {
            if (!ready()) return;
            hiss(1.4, { type: 'lowpass', freq: 700, slide: 60, vol: 0.5, attack: 0.02 });
            tone(70, 1, { type: 'sine', vol: 0.5, slide: 25 });
            for (var i = 0; i < 6; i++) tone(300 + Math.random() * 900, 0.08, { type: 'square', vol: 0.05, at: 0.1 + i * 0.09, filter: 1400 });
        },

        // Race results: a fanfare for a win, a sad trombone for a loss, a buzzer for a red light
        win: function () {
            if (!ready()) return;
            [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33], [784, 0.5], [1047, 0.6]].forEach(function (n, i) {
                tone(n[0], i === 5 ? 0.7 : 0.16, { vol: 0.1, at: n[1], filter: 2200, vibrato: i === 5 ? 6 : 0 });
                tone(n[0] / 2, i === 5 ? 0.7 : 0.16, { type: 'triangle', vol: 0.12, at: n[1] });
            });
            hiss(0.5, { type: 'highpass', freq: 6000, vol: 0.06, at: 0.6 });
        },
        lose: function () {
            if (!ready()) return;
            [[392, 0, 0.3], [370, 0.32, 0.3], [349, 0.64, 0.3], [330, 0.96, 0.9]].forEach(function (n, i) {
                tone(n[0], n[2], { type: 'sawtooth', vol: 0.11, at: n[1], filter: 900, vibrato: i === 3 ? 5 : 0, attack: 0.03 });
            });
        },
        foul: function () {
            if (!ready()) return;
            tone(110, 0.6, { type: 'sawtooth', vol: 0.14, filter: 900, attack: 0.02 });
            tone(116, 0.6, { type: 'square', vol: 0.07, filter: 900, attack: 0.02 });
        },

        // Money changing hands: the till rings
        cash: function () {
            if (!ready()) return;
            tone(1568, 0.08, { type: 'triangle', vol: 0.12 });
            tone(2093, 0.35, { type: 'triangle', vol: 0.12, at: 0.08 });
            hiss(0.3, { type: 'highpass', freq: 5000, vol: 0.04, at: 0.08 });
        },

        // A quiet tick for menu buttons
        click: function () {
            if (!ready()) return;
            tone(900, 0.03, { type: 'triangle', vol: 0.06 });
        },

        // The ratchet spinning a bolt out or in
        ratchet: function () {
            if (!ready()) return;
            for (var i = 0; i < 5; i++) {
                hiss(0.018, { freq: 2600 + i * 100, q: 3, vol: 0.15, at: i * 0.05 });
                tone(2000, 0.015, { type: 'triangle', vol: 0.03, at: i * 0.05 });
            }
        },
        // A bolt snugged down
        clink: function () {
            if (!ready()) return;
            tone(2637, 0.12, { type: 'triangle', vol: 0.07 });
            tone(3951, 0.08, { type: 'sine', vol: 0.025 });
        },
        // The wrong bolt: a dull clank
        clank: function () {
            if (!ready()) return;
            tone(190, 0.12, { type: 'square', vol: 0.08, filter: 600 });
            hiss(0.08, { freq: 600, q: 3, vol: 0.12 });
        },
        // The old part comes off and the new one goes on the bench
        thunk: function () {
            if (!ready()) return;
            tone(95, 0.2, { type: 'sine', vol: 0.4, slide: 40 });
            hiss(0.15, { type: 'lowpass', freq: 700, vol: 0.18 });
        },
        // Job done
        ding: function () {
            if (!ready()) return;
            [[784, 0], [988, 0.09], [1319, 0.18]].forEach(function (n) {
                tone(n[0], 0.25, { type: 'triangle', vol: 0.1, at: n[1] });
            });
        },

        // Bodywork: the grinder whines through rust, the filler goes on with a smear, and the
        // spray gun hisses for the paint pass
        grind: function (seconds) {
            if (!ready()) return;
            hiss(seconds, { freq: 1800, q: 2, vol: 0.14, attack: 0.06 });
            tone(180, seconds, { type: 'sawtooth', vol: 0.04, filter: 1200, attack: 0.06, slide: 150 });
        },
        smear: function () {
            if (!ready()) return;
            hiss(0.3, { type: 'lowpass', freq: 600, slide: 300, vol: 0.2, attack: 0.04 });
        },
        spray: function (seconds) {
            if (!ready()) return;
            hiss(seconds, { type: 'highpass', freq: 3500, vol: 0.07, attack: 0.15 });
        }
    };
})(window.Lemon = window.Lemon || {});

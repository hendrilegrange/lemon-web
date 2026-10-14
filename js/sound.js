// Sound: an engine note that follows the rpm, and beeps for the start lights and the shift
// light. Web Audio only starts after a click or key press, so begin() is called from one.
(function (L) {
    'use strict';

    var KEY = 'lemon.sound';
    var ctx = null, engine = null;

    function load() {
        try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
    }

    L.sound = {
        on: load(),

        toggle: function () {
            L.sound.on = !L.sound.on;
            try { localStorage.setItem(KEY, L.sound.on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
            if (!L.sound.on) L.sound.engineOff();
            return L.sound.on;
        },

        // Call from a click or key handler: browsers only let audio start from one
        begin: function () {
            if (!L.sound.on) return;
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            try {
                if (!ctx) ctx = new AC();
                if (ctx.state === 'suspended') ctx.resume();
            } catch (e) { ctx = null; }
        },

        // The engine: two detuned sawtooths through a low-pass filter, pitched at the
        // firing rate of a V8 (four pulses a revolution)
        engineOn: function () {
            if (!ctx || !L.sound.on || engine) return;
            var gain = ctx.createGain();
            gain.gain.value = 0;
            var filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 700;
            filter.connect(gain);
            gain.connect(ctx.destination);
            var oscs = [0, 7].map(function (detune) {
                var o = ctx.createOscillator();
                o.type = 'sawtooth';
                o.detune.value = detune;
                o.frequency.value = 60;
                o.connect(filter);
                o.start();
                return o;
            });
            engine = { gain: gain, filter: filter, oscs: oscs };
        },

        // rpm sets the pitch; load (0-1) how hard it's working, which sets the volume
        engineAt: function (rpm, load) {
            if (!engine) return;
            var t = ctx.currentTime;
            var f = Math.max(25, rpm / 60 * 4 / 2);
            engine.oscs.forEach(function (o) { o.frequency.setTargetAtTime(f, t, 0.02); });
            engine.filter.frequency.setTargetAtTime(400 + rpm / 8, t, 0.05);
            engine.gain.gain.setTargetAtTime(0.03 + 0.05 * load, t, 0.05);
        },

        engineOff: function () {
            if (!engine) return;
            var e = engine;
            engine = null;
            e.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
            setTimeout(function () { e.oscs.forEach(function (o) { o.stop(); }); }, 300);
        },

        beep: function (freq, seconds) {
            if (!ctx || !L.sound.on) return;
            var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
            o.type = 'square';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
            o.connect(g);
            g.connect(ctx.destination);
            o.start(t);
            o.stop(t + seconds);
        }
    };
})(window.Lemon = window.Lemon || {});

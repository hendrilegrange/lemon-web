// A 5x7 pixel font for text on the canvas. The browser's own fonts blur and break up when
// the 320x200 canvas is scaled up; drawn pixel by pixel, text stays as sharp as the art.
// Upper case only, like the VGA games it copies: lower case is drawn as upper case.
(function (L) {
    'use strict';

    var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?-+='\"/()$%&#*_<>@";
    // Seven rows per glyph, each row five bits as one base-32 digit, most significant bit left
    var DATA = "ehhvhhhuhhuhhuehgggheuhhhhhuvgguggvvggugggehgnhhfhhhvhhhe44444e72222ichikokihggggggvhrllhhhhhpljhhehhhhheuhhugggehhhliduhhukihfgge11uv444444hhhhhhehhhhha4hhhlllahha4ahhhha4444v1248gvehjlphe4c4444eeh1248vu11e11u26aiv22vgu11he68guhhev124888ehhehheehhf12c000000000000cc0000c480cc0cc00cc0c484444404eh12404000e000044v44000v0v004480000aa00000122488g248884284222484fke5u4pp248jjcik8lidaavavaa04lel40000000v248g8428421248ehnlnge";
    var GLYPHS = {};
    for (var i = 0; i < CHARS.length; i++) {
        GLYPHS[CHARS[i]] = DATA.substr(i * 7, 7).split('').map(function (d) { return parseInt(d, 32); });
    }

    L.FONT_CHARS = CHARS;
    L.FONT_W = 6;   // advance per character, with a column of space
    L.FONT_H = 7;

    L.textWidth = function (str, scale) {
        return String(str).length * L.FONT_W * (scale || 1) - (scale || 1);
    };

    // Draw text with its baseline at y, like fillText. opts: color (default the current
    // fillStyle), scale (whole pixels per font pixel, default 1), align ('left', 'center', 'right')
    L.text = function (ctx, str, x, y, opts) {
        opts = opts || {};
        var s = opts.scale || 1;
        str = String(str).toUpperCase();
        if (opts.color) ctx.fillStyle = opts.color;
        var w = L.textWidth(str, s);
        x = Math.round(opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x);
        y = Math.round(y) - L.FONT_H * s;
        for (var c = 0; c < str.length; c++) {
            var rows = GLYPHS[str[c]] || GLYPHS['?'];
            for (var r = 0; r < 7; r++) {
                for (var b = 0; b < 5; b++) {
                    if (rows[r] & (16 >> b)) ctx.fillRect(x + (c * L.FONT_W + b) * s, y + r * s, s, s);
                }
            }
        }
    };
})(window.Lemon = window.Lemon || {});

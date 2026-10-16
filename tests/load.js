// Loads the game's plain scripts into Node, the way index.html loads them in the browser
const fs = require('fs');
const path = require('path');
const vm = require('vm');

globalThis.window = globalThis;
for (const f of ['data.js', 'physics.js', 'game.js', 'font.js', 'art.js', 'intro.js', 'wrench.js']) {
    const file = path.join(__dirname, '..', 'js', f);
    if (fs.existsSync(file)) vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
module.exports = globalThis.Lemon;

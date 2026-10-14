# lemon-web: a Street Rod remake

Web remake of the 1989 DOS game Street Rod. Faithful to the original's gameplay, economy and
feel, with new art and sound in the same VGA style (the original's assets and code are
copyrighted and are never used here).

Hosted at `https://lemon.dontbeone.co.za` (Afrihost SolidCP shared hosting, Windows/IIS), next
to the D&D character creator (`hendrilegrange/dnd-web`, `natone.dontbeone.co.za`).

**Tech stack**: static site. Vanilla JS (no framework, no build step): plain scripts sharing a
`window.Lemon` namespace (`L`), loaded in order by `index.html`. Races draw to a 320x200 canvas
scaled up by CSS; menus are plain HTML/CSS. Saves live in the browser's localStorage; there is no
server code or database.

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Shell: loads `css/style.css` and the `js/` files. Bump the `?v=` on any file that changes |
| `js/data.js` | Car bodies (scrappy late-40s to early-60s used cars; newer cars may unlock after beating The King, later), parts (by slot, each in four classes Stock/Better/Best/Bestest; engine bolt-ons fit only their engine family, `L.fits`), weekly stock odds per class (`L.IN_STOCK`), garage hours per job (30 a week until Friday night), bodywork costs and the 75% body needed to race, rivals and The King, race prizes (fun $50-$200 by tier, rival races $1,000 or pinks, The King $10,000 and his car) and starting cash |
| `js/physics.js` | Turns a car's parts into a spec (`L.spec`), torque curve, and steps a drag race in time (`L.step`); `L.estimate` is the garage's time slip |
| `js/game.js` | Game state and rules: classifieds, buying/selling, installing parts, wear per part (`partCondition`), diagnosing, repairing and replacing parts (`L.diagnose`), race odds (`L.odds`), settling races for cash, pink slips or fun, saving to localStorage. No drawing, so Node tests load it |
| `js/sound.js` | Web Audio: engine note that follows the rpm, start-light and shift-light beeps; on/off kept in localStorage |
| `js/race.js` | The drag race on the canvas: Christmas tree start, shifting with a shift light, rival AI, dashboard |
| `js/wrench.js` | Wrenching on the canvas: installing a part or rebuilding the engine means clicking the orange bolts out and back in (`L.WRENCH`, up to 8 bolts per job; grey bolts hold something else); bodywork (`L.startBodywork`) is grinding and filling rust spots, then a paint sweep |
| `js/ui.js` | Menu screens built as HTML into `#app`: title, hub, classifieds, parts catalog, garage, Fix car, burger stand, results |
| `js/main.js` | Boot and the title screen animation |
| `tests/` | `node --test tests/*.test.js`; `tests/load.js` loads the plain scripts into Node |
| `css/style.css` | Page styles |
| `web.config` | IIS config: default document, MIME types for game assets, security headers |

## Workflow and deploy

- `main` = what is live. Every change goes on a branch and a pull request; Hendri merges.
- Merging to `main` runs `.github/workflows/deploy.yml`: `node --check` on every `js/` file and the
  unit tests, then uploads over FTPS with lftp. Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`,
  `FTP_SERVER_DIR` (`lemon.dontbeone.co.za/wwwroot/`, trailing slash) live in GitHub Actions
  secrets only. The FTP account is shared with dnd-web (the hosting plan allows one).
- The pipeline never uploads `.github/`, `CLAUDE.md`, `README.md`, `docs/`, `tests/` or `*.bak`.
- Pull requests run `.github/workflows/test.yml` (syntax check and unit tests).
- Rollback: revert the PR; the revert redeploys the previous files.
- After uploading, `.github/workflows/smoke-test.yml` checks the page and its js/css load and
  match the commit. A failure turns the deploy run red.

## Conventions

- IIS refuses file types it has no MIME type for. A new asset type (audio, font, data) needs a
  `<remove>` + `<mimeMap>` pair in `web.config`, or it 404s on the live site only.
- Never commit passwords, keys or tokens.

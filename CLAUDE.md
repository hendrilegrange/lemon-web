# lemon-web: a Street Rod remake

Web remake of the 1989 DOS game Street Rod. Faithful to the original's gameplay, economy and
feel, with new art and sound in the same VGA style (the original's assets and code are
copyrighted and are never used here).

Hosted at `https://lemon.dontbeone.co.za` (Afrihost SolidCP shared hosting, Windows/IIS), next
to the D&D character creator (`hendrilegrange/dnd-web`, `natone.dontbeone.co.za`).

**Tech stack**: static site. Vanilla JS (no framework, no build step): plain scripts sharing a
`window.Lemon` namespace (`L`), loaded in order by `index.html`. Races draw to a 320x200 canvas
scaled up by CSS; menus are plain HTML/CSS. Saves live in the browser's localStorage, and for a
signed-in player also on the server: one small PHP 8 file (`api.php`) with MariaDB, the same
stack as dnd-web. The game works without it (offline, or before the server is set up).

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Shell: loads `css/style.css` and the `js/` files. Bump the `?v=` on any file that changes |
| `js/data.js` | Car bodies (scrappy late-40s to early-60s used cars; newer cars may unlock after beating The King, later), parts (by slot, each in four classes Stock/Better/Best/Bestest; every price is multiplied by `L.PART_PRICE` (2.5), so a full build takes several Friday nights of winnings; `basePrice` keeps the old price for the engine rebuild cost; engine bolt-ons fit only their engine family, `L.fits`; every family (flathead, Chevy six, small-block, big-block) has a Better, Best and Bestest engine), weekly stock odds per class (`L.IN_STOCK`; `L.restock` in game.js makes sure every family has something in every slot each week), garage hours per job (30 a week until Friday night), bodywork costs and the 75% body needed to race, rivals and The King, race prizes (fun $50-$200 by tier; a cash race bets all your cash up to $1,000; pink slips are cars only; The King pays $10,000 and his car), resale (`L.RESALE`: a restored car sells well over book) and starting cash |
| `js/physics.js` | Turns a car's parts into a spec (`L.spec`), torque curve, and steps a drag race in time (`L.step`); `L.estimate` is the garage's time slip |
| `js/game.js` | Game state and rules: classifieds, buying/selling, installing parts, wear per part (`partCondition`), car value by condition (`L.carValue`, `L.restoredValue`), stripping a car for parts (`L.stripCar`; shelf parts keep their wear in `g.shelfCond`), diagnosing, repairing and replacing parts (`L.diagnose`), what a classified car could become (`L.potential`: fix-all cost, restored value and profit, quarter mile as is, fixed and built with its family's Bestest parts), race odds (`L.odds`), settling races for cash, pink slips or fun, saving to localStorage. No drawing, so Node tests load it |
| `js/account.js` | Player accounts in the browser (the screens are in `ui.js`; a reset link opens `L.showReset` from `main.js`): wraps `L.save` to stamp `savedAt` and send a signed-in player's game to the server shortly after; at boot (`L.account.check`) loads a newer game saved from another device; at sign-in asks which game to keep when the browser and the account differ; signing out clears the browser's copy once it's safely uploaded. Hides itself when `api.php` doesn't answer |
| `api.php` | Accounts API: `me`, `load` (GET), `register`, `login`, `google`, `forgot`, `reset`, `logout`, `save` (POST with `X-Requested-With`; no CORS headers, so other sites can't call it). A name, email and password (argon2id; sign in with the name or the email), or Google sign-in, which links to an account with the same email or makes one. Password resets by an emailed one-hour link (`?reset_token=`), which signs out every device. An httponly session cookie whose token is stored hashed, rate limits per IP, one save per player. Creates its `lemon_` tables on first use. Answers 503 until `config.php` exists |
| `oauth.php`, `mailer.php`, `certs/cacert.pem` | Copied from dnd-web: Google ID token check (`verifyGoogleIdToken`, needs `GOOGLE_CLIENT_ID`), the SMTP mailer (`sendMail`, needs the `SMTP_*` settings) and the CA bundle both use, since the host's PHP has none |
| `config.example.php` | Template for `config.php` (database settings), which lives on the server only: git-ignored, never deployed, hidden by `web.config` |
| `js/font.js` | The 5x7 pixel font all canvas text uses (`L.text`, `L.textWidth`), so text stays as sharp as the art when the canvas is scaled; upper case only |
| `js/art.js` | Pixel art drawn a whole pixel at a time in VGA-style shades: the cars (`L.drawCar`, a 44x22 sprite, scaled up for bodywork), the garage (`L.drawGarage`), the hub's night scene of your garage with your car parked out front (`L.drawHubScene`), each workbench job's part worn or new (`L.drawPart`), bolts, holes and the orange target rings |
| `js/sound.js` | Web Audio, no sound files: a V8 that lopes at idle and roars under load, effects for the strip (tire bark, shift clunk and pops, a blown engine, win/lose/red-light stings) and the workbench (ratchet, clink, grinder, spray), a cash-register ring when money changes hands, and a 12-bar rock'n'roll jukebox on the menus (`L.sound.scene`: menu, garage quieter, race off). Sound and music on/off are kept in localStorage |
| `js/race.js` | The drag race on the canvas: Christmas tree start, shifting with a shift light, rival AI, dashboard |
| `js/wrench.js` | Wrenching on the canvas: installing a part or rebuilding the engine means clicking the orange bolts out and back in (`L.WRENCH`, up to 8 bolts per job; grey bolts hold something else); bodywork (`L.startBodywork`) is grinding and filling rust spots, then a paint sweep |
| `js/ui.js` | Menu screens built as HTML into `#app`: the gauges across the top (`status()`, pinned to the top on a phone), the Back bar (`backBar()`, pinned to the bottom on a phone); a new screen starts at the top, one redrawn after an action keeps its place and shows its message as a toast if it's out of sight; title, hub (scene, car card, tiles with 12x12 pixel icons), classifieds (a 1963 newspaper page: each ad with the car's picture, rusting with its body, and a mechanic's once-over from `L.potential`; the best deal and a clearly fastest build circled in pencil), parts catalog, garage, Fix car, burger stand, results |
| `js/main.js` | Boot, the title screen animation, and sizing the canvas to a whole-number scale when that costs little size |
| `favicon.ico`, `icons/`, `manifest.webmanifest` | The site icon (a lemon hot rod in pixel art, drawn from `icons/lemon-32.png`) for the browser tab, iPhone and Android home-screen shortcuts; the manifest opens a saved shortcut full screen |
| `tests/` | `node --test tests/*.test.js`; `tests/load.js` loads the plain scripts into Node |
| `css/style.css` | Page styles |
| `web.config` | IIS config: default document, MIME types for game assets, security headers |

## Workflow and deploy

- `main` = what is live. Every change goes on a branch and a pull request; Hendri merges.
- Merging to `main` runs `.github/workflows/deploy.yml`: `node --check` on every `js/` file and the
  unit tests, then uploads over FTPS with lftp. Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`,
  `FTP_SERVER_DIR` (`lemon.dontbeone.co.za/wwwroot/`, trailing slash) live in GitHub Actions
  secrets only. The FTP account is shared with dnd-web (the hosting plan allows one).
- The pipeline never uploads `.github/`, `CLAUDE.md`, `README.md`, `docs/`, `tests/`, `*.bak`,
  `config.php` or `config.example.php`. `config.php` is put on the server by hand.
- Accounts need PHP enabled for the site in SolidCP and `config.php` next to `api.php`. Google
  sign-in also needs `https://lemon.dontbeone.co.za` in the Google client's Authorized JavaScript
  origins. The smoke
  test warns (not fails) while `api.php` doesn't answer, and fails if it's ever served as source.
- Pull requests run `.github/workflows/test.yml` (syntax check and unit tests).
- Rollback: revert the PR; the revert redeploys the previous files.
- After uploading, `.github/workflows/smoke-test.yml` checks the page and its js/css load and
  match the commit. With the `SMOKE_LOGIN` / `SMOKE_PASSWORD` secrets (a dedicated test account, whose
  saved game it overwrites) it also signs in, saves, loads and signs out. A failure turns the deploy run red.

## Conventions

- IIS refuses file types it has no MIME type for. A new asset type (audio, font, data) needs a
  `<remove>` + `<mimeMap>` pair in `web.config`, or it 404s on the live site only.
- Never commit passwords, keys or tokens.
- API responses go through `respond()` in `api.php`; state-changing actions are POST.

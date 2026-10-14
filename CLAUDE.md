# lemon-web: a Street Rod remake

Web remake of the 1989 DOS game Street Rod. Faithful to the original's gameplay, economy and
feel, with new art and sound in the same VGA style (the original's assets and code are
copyrighted and are never used here).

Hosted at `https://lemon.dontbeone.co.za` (Afrihost SolidCP shared hosting, Windows/IIS), next
to the D&D character creator (`hendrilegrange/dnd-web`, `natone.dontbeone.co.za`).

**Tech stack**: static site. Vanilla JS (no framework, no build step) drawing to a 320x200
canvas scaled up by CSS, plain HTML/CSS. Saves live in the browser's localStorage; there is no
server code or database.

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Shell: loads `css/style.css` and the `js/` files. Bump the `?v=` on any file that changes |
| `js/main.js` | Entry point |
| `css/style.css` | Page styles |
| `web.config` | IIS config: default document, MIME types for game assets, security headers |

## Workflow and deploy

- `main` = what is live. Every change goes on a branch and a pull request; Hendri merges.
- Merging to `main` runs `.github/workflows/deploy.yml`: `node --check` on every `js/` file, then
  uploads over FTPS with lftp. Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`,
  `FTP_SERVER_DIR` (`lemon.dontbeone.co.za/wwwroot/`, trailing slash) live in GitHub Actions
  secrets only. The FTP account is shared with dnd-web (the hosting plan allows one).
- The pipeline never uploads `.github/`, `CLAUDE.md`, `README.md`, `docs/` or `*.bak`.
- Rollback: revert the PR; the revert redeploys the previous files.
- After uploading, `.github/workflows/smoke-test.yml` checks the page and its js/css load and
  match the commit. A failure turns the deploy run red.

## Conventions

- IIS refuses file types it has no MIME type for. A new asset type (audio, font, data) needs a
  `<remove>` + `<mimeMap>` pair in `web.config`, or it 404s on the live site only.
- Never commit passwords, keys or tokens.

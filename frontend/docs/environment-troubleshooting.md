# Frontend environment troubleshooting

Reference material split out of `../CLAUDE.md` — read it when one of these specific things
happens, not as background for building a feature. `../CLAUDE.md` keeps only the operative rule
each of these backs; the mechanism and the "why" live here.

## Editor / host `node_modules`

The app needs no host `node_modules` — everything runs in Docker. But an editor needs one on disk
for IntelliSense and type-checking, and it is **separate** from the container's:
`docker-compose.yml` bind-mounts `./:/app` while an anonymous volume (`- /app/node_modules`)
shadows it, so the container keeps the `node_modules` its image built via `npm ci` and never sees
the host copy. The host copy changes only when you install locally.

After the container's dependencies change, sync the host with **`npm ci`**, then restart the
editor's TS/language server:

```bash
npm ci   # installs exactly from package-lock.json and never rewrites it
```

**Never `npm install` for this sync.** `npm ci` installs strictly from `package-lock.json`;
`npm install` rewrites the lockfile as a side effect, and because a host npm version can differ
from the container's, that churns the file for no real change. The committed lockfile is the
shared source of truth and the container's npm owns it (CI installs via `npm ci`). Make **real**
dependency changes inside the container (`make sh` → `npm install`) and commit them — which is
exactly how orval was added — so `npm ci` everywhere stays consistent.

Three frontend-specific wrinkles:

- **Sync with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci`.** Installing `@playwright/test`
  otherwise pulls every browser it pins — hundreds of megabytes the host never uses, since the
  audit only ever runs in `Dockerfile.a11y`'s image. The editor needs Playwright's types, never
  its browsers. Both Dockerfiles set the same variable for the same reason; only the a11y one
  then installs Chromium back, deliberately and alone.
- **orval declares `engines.node >= 22.18`.** A host on an older Node still installs it — npm only
  warns — and the editor only needs orval's types for `orval.config.ts`, which resolve regardless.
  The generator itself always runs in the container, which is on 24.18, so this never bites in
  practice. Don't run `npx orval` on the host to work around it.
- **The generated client is gitignored, so a fresh clone has no `src/app/api`** and the editor
  will flag every import from it as unresolved. `npm ci` does not create it — nothing on the host
  does. Run any container target once (`make run-unit-tests` is the cheapest) and it appears.

This is host-only, for the editor. The container side of the same split — a stale in-container
`node_modules` after a dependency change — is the `--renew-anon-volumes` rebuild below.

## `make up` dies with `orval: not found`

The long-lived container is reusing an anonymous `node_modules` volume created before orval was
installed — `docker compose run --rm` builds a fresh one every time and so never shows the
problem. Rebuild once with `docker compose up --build -d --renew-anon-volumes`. This is the same
stale-anonymous-volume trap described for the backend's Prisma client, and it bites after any
dependency change; a fresh clone and CI are unaffected.

## The a11y image build dies with `403 … this service is not available in your location`

Playwright's CDN is geo-blocked where you are. Uncomment `PLAYWRIGHT_DOWNLOAD_HOST` in `.env` (see
`.env.example`) to fetch the same file from a mirror — only the host changes. The default stays
the official CDN because that is right for CI and for most contributors, and because a mirror is a
third party in the supply chain; the override is opt-in and local, which is why it lives in `.env`
rather than in the committed Dockerfile.

## Why `proxy.conf.mjs` looks the way it does

Three things about it are deliberate, if you're about to change it:

- **`.mjs`, not the conventional `proxy.conf.json`.** JSON cannot read the environment, and
  reading the environment is the whole job. `@angular/build` imports any non-`.json` proxy config
  as a module (`utils/load-proxy-config.ts`), so this is supported, not a trick.
- **Beside `src/`, not inside it** — same reasoning as `api/` and `a11y/`: it is tooling, not
  something Angular compiles or serves. The Angular CLI docs put it in `src/`; this project's own
  convention wins.
- **`host.docker.internal`, not a service name.** The backend is a separate Compose project with
  its own network, so no service-name DNS reaches it — only the ports it publishes on the host.
  `docker-compose.yml` maps that name with `extra_hosts: host.docker.internal:host-gateway`. This
  is the third Docker-networking gotcha in this project, alongside the two in the accessibility
  section of `../CLAUDE.md`.

**Not `environment.apiUrl` + `fileReplacements`.** That remains the right mechanism for a
_deployed_ build, where there is no dev server to proxy through, and it is what the
`angular-developer` skill's `references/environment-configuration.md` describes. It is the wrong
one here: environment files are build-time, so two targets would mean two builds where two env
files suffice, and it would put the browser on a cross-origin call to `:3001` — CORS on the
backend, for a problem the proxy does not have.

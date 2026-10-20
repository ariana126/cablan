# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Skills.** Invoke the ones that fit before writing code:

- `cablan-design-system` — **the one to read first for anything that renders.** This app's UI is
  Angular Material 21 (Material Design 3), and the skill carries the full `--mat-sys-*` and
  `--cablan-space-*` token lists, the `mat-*` component to reach for per pattern, and the rules
  `make lint-styles` enforces. It lives in `.claude/skills/cablan-design-system/`, and unlike its
  two neighbours it is **ours** — hand-written, not vendored, not in `skills-lock.json`, and meant
  to be edited as the design system changes.
  **It takes precedence over the two vendored Angular skills wherever they disagree**, which they
  do in exactly one place: both recommend Tailwind for styling (`angular-developer`'s
  `references/tailwind-css.md`, and `angular-new-app`'s `ng add tailwindcss`). There is no Tailwind
  in Cablan and none is wanted.
- `angular-developer` — the Angular team's own guidance, vendored into `.claude/skills/` (pinned in
  `skills-lock.json`, from `angular/skills` on GitHub) and scoped to this directory. Its `SKILL.md`
  is an index: it routes to a `references/*.md` page per topic — signals, `linkedSignal`, `resource`,
  effects, signal/reactive/template-driven forms, DI and injection context, routing and guards,
  pipes, Angular Aria, component styling and Tailwind, testing and harnesses, CLI and migrations.
  Read the reference for the topic at hand rather than working from memory; Angular's API surface
  moves fast and this is version-current. The "Angular & TypeScript best practices" section below
  is the short form of the same advice — the skill is where the detail lives.
- `angular-new-app` — scaffolding a _new_ Angular app from scratch. Not applicable here: this app
  already exists. Its `ng generate` recipes still apply, but see the caveat below.
- `handbook:oop-guideline` — components, services and signals-as-state: what belongs where,
  immutability, dependency injection.
- `handbook:test-guideline` — what to test in a component, what to fake, black-box thinking for the
  Vitest specs.
- `superpowers:test-driven-development` — before implementing any component or service.
- `frontend-design:frontend-design` — any new UI or visual reshaping; aesthetic direction, not just
  markup.
- `run` and `claude-in-chrome` — to actually look at the rendered page. `frontend-design` ends in a
  critique pass that can't be done by reading templates.

Both Angular skills assume a host toolchain and tell you to run `ng` directly. Here there is none —
`ng` lives in the container's `node_modules` (an anonymous volume; the repo is bind-mounted at
`/app`, so generated files do land on the host). Translate every `ng <cmd>` the skill gives you into
`docker compose run --rm app npx ng <cmd>`, or the Make target where one exists. In particular the
skill's "run `ng build` when you're done" step is
`docker compose run --rm app npm run build` — note `make build` is Docker's, it rebuilds the image.

**The `angular-cli` MCP server.** The Angular CLI's own MCP server, declared in the root `.mcp.json`
as `npx -y @angular/cli@21 mcp --read-only`. Six tools, and it discovers this workspace on its own —
`list_projects` finds `frontend/angular.json` from the monorepo root, no configuration needed:

- `search_documentation` — queries `angular.dev`, clamped to the workspace's own major version.
  **Prefer this over `context7` for anything Angular**; `context7` is generic across versions.
- `get_best_practices` — the guidelines shipped inside the _installed_ `@angular/core`.
- `find_examples` — official code examples. Reach for it on "show me how to…", where
  `search_documentation` answers "what is…".
- `list_projects` — workspace and project layout; builder, source root, style language.
- `ai_tutor` — a curriculum for teaching Angular concepts.
- `onpush_zoneless_migration` — an iterative plan for moving to `OnPush`/zoneless. It only _emits
  instructions_; you apply each one, then call it again.

This overlaps the `angular-developer` skill without replacing it: the skill is pinned, offline prose
vendored in `.claude/skills/`, while `get_best_practices` reads whatever `@angular/core` is actually
installed. Use both.

**It never runs anything.** All six tools are read-only and none of them invoke `ng` — that is what
`--read-only` guarantees, by barring the CLI's experimental `build`, `test`, `e2e` and `devserver`
tools, which would shell out to `ng` on the host and bypass the container. Building, testing,
linting and serving stay exactly as described above: Docker, via the Makefile. And the server itself
must run on the host, not in the container — it sandboxes itself to the host paths Claude Code
advertises, which do not exist under `/app`, so a containerised copy finds no workspace at all.

## The design system

**The UI is Angular Material 21, themed with Material Design 3.** Colour, typography, shape and
elevation are decided once and exposed as CSS custom properties; component code references them and
never authors a value. Read `.claude/skills/cablan-design-system/SKILL.md` for the token names and
the component mapping — this section is only the shape of it.

```
src/styles.scss          entry point; @use's the nine partials below
src/styles/_fonts.scss   @font-face for Vazirmatn, self-hosted from public/fonts/
src/styles/_theme.scss   the tonal palettes and the single mat.theme() call — THE source of every
                         --mat-sys-* token, plus the brand, conductor and --cablan-success colours
src/styles/_overrides.scss  the mat.*-overrides: button, field density, dialog, table, toolbar, …
src/styles/_tokens.scss  --cablan-space-*, the six type styles (--cablan-page-title …), page widths,
                         --cablan-measure, --cablan-duration-*
src/styles/_reset.scss   box-sizing, body, prefers-reduced-motion
src/styles/_a11y.scss    the global :focus-visible ring, .skip-link, .visually-hidden
src/styles/_layout.scss  .stack / .stack--tight / .stack--hair, the .page column classes, .filter-bar,
                         and the table-cell helpers (.cell-end, .cell-id, .cell-actions)
src/styles/_dialog.scss  the dialog footer, icon tile and field-width rules shared by every dialog
src/styles/_stacked-table.scss  the phone layout for tables: below 40rem of container width a
                         `.stacked-table`'s rows fold into labelled cards — see "Phones" below
design/tokens.json       a byte copy of the design system's token file — see below
```

Things about it that are easy to get wrong:

- **`mat.theme()`, not `mat.define-theme()`.** The latter was the v17/v18 experimental M3 mixin,
  removed in v19, and it never emitted `--mat-sys-*` in the first place. Do not reintroduce it, and
  do not drop to the M2 `mat.define-light-theme()` API underneath.
- **The design system is the Claude Design project _Cablan Design System 2_**, and
  `design/tokens.json` is a byte copy of its token file (Prettier-ignored, so it stays a byte copy).
  `_theme.scss` is the source of truth for the app; `a11y/design-tokens.spec.ts` resolves every
  colour in that file in a real browser, in both schemes, and fails if the two disagree. The tonal
  palettes at the top of `_theme.scss` were seeded from the logo with Material's theme-color
  schematic and then overwritten, tone by tone, with the values the file pins. Do not nudge a colour
  by eye: re-sync the file and fix the palette. One role cannot be reached by a tonal palette (dark
  `on-surface-variant`), so `_theme.scss` pins it with an explicit `light-dark()`.
- **Colour is green and copper on warm neutrals.** Primary (the action, links, the focus ring) is the
  logo's green, tertiary is copper, error is Material's red. Surfaces are separated by tone and a
  1px hairline, not shadow; shape follows role (state / control / container / overlay). The
  `cablan-design-system` skill has the tables.
- **There is one theme, and it covers both colour schemes.** `color-scheme: light dark` on `html`
  makes Material emit every colour token as a `light-dark(<light>, <dark>)` pair, so a component
  that uses tokens needs no dark-mode rule at all. If you catch yourself writing
  `@media (prefers-color-scheme: dark)`, a literal has crept in upstream. Note the app's previous
  stylesheet declared "no dark scheme" as a deliberate decision — that decision is reversed, and
  the reason it was cheap to reverse is that nothing authors colour by hand any more.
  Both schemes are **gated**: `make lint-accessibility` audits every route once per scheme, so a
  colour that only works in light mode fails the build. See [Accessibility](#accessibility).
- **Material ships no spacing scale.** `--cablan-space-*` fills that gap and is ours; radius
  (`--mat-sys-corner-*`), elevation (`--mat-sys-level0..5`) and the body/label typography come from
  Material. The six Cablan type styles (`--cablan-page-title` …) are ours too, and are what titles,
  table headers, cells and meta text use.
- **Material is restyled only through `mat.*-overrides` in `_overrides.scss`**, scoped to `:root`.
  Those hold Material's own component dimensions (a 40px button, a 48px field, a 48px table row) as
  mixin arguments, which stylelint does not read as declarations — so `_overrides.scss` needs no
  exemption and must not get one.
- **`_theme.scss`, `_tokens.scss` and `_fonts.scss` are the only files allowed to hold a literal**,
  and `stylelint.config.js` exempts exactly those three by path. A fourth exemption is the wrong
  answer to any problem — add a token.

### Phones

**Every page has to work on a phone held upright (~360–390px), in Chrome and Safari, with every
action still reachable** — issue #41; the users of every role may be on one. Three mechanisms carry
that, and a new page gets all three by using the existing building blocks:

- **The page never runs wider than the screen.** `app.scss` gives `main` a
  `grid-template-columns: minmax(0, 1fr)`; left as an implicit `auto` track, the column grew to the
  routed page's min-content (a wide table, a filter bar's fields side by side) and the whole page
  scrolled sideways. Note _where_ that overflow shows up: **inside `mat-sidenav-content`**, which is
  the app's scroll container — `document.documentElement.scrollWidth` stays equal to the viewport
  either way, so a check that only measures the document passes on a broken page. Measure the
  scroller.
- **Tables fold into cards.** `app-data-sheet` puts `appStackedTable` (`ui/stacked-table/`) on its
  body, so every list page's table, once the sheet is narrower than 40rem, shows one card per row
  and one «label value» line per cell. The directive copies each column header's visible text onto
  the body cells as `data-label`; `styles/_stacked-table.scss` does the layout with a **container**
  query, so a table with room stays a table (on desktop nothing changes). It is CSS over the same
  DOM: the `<table>`, the explicit `role`s Material writes, every accessible name and the DOM order
  all stay, which is what the acceptance suite's role-and-name locators and a screen reader's table
  navigation depend on. A column whose header is `.visually-hidden` (the row actions) gets no label
  and becomes the card's footer; a sortable `th[aria-sort]` stays visible so sorting stays
  available. A table outside a data sheet opts in by putting `appStackedTable` on its own wrapper
  (the dashboard's per-analysis lines do). Never restructure a table's markup for mobile instead.
- **Everything else wraps.** The page header, the filter bar, the data sheet's bar and the dialog
  footers are flex rows that wrap; dialogs are capped at the viewport by Material's own
  `max-width`. Keep new rows wrapping (`flex-wrap`, `minmax(0, 1fr)` columns, `min-inline-size: 0`
  on flex children that hold text) rather than adding fixed widths.

Look at a new page at 375px before calling it done — a Playwright run against the dev server is
enough. One trap if you do: a **full-page** screenshot makes Chromium resize the viewport to 1×1 and
back, which crosses the shell's 60rem drawer breakpoint and catches the drawer mid-animation. Use a
tall viewport instead of `fullPage` at desktop widths.

### Persian, RTL

**The app is Persian-language and right-to-left.** `index.html` carries `lang="fa"` and `dir="rtl"`
on the document — a whole-app direction, not an opt-in, and not something to set per-component or
bind. Angular Material reads it through the CDK's `Directionality`, so every `mat-*` component
mirrors from that one attribute with no further configuration.

RTL is a layout concern, not a text-flipping one: mirror layouts, iconography and directional
affordances (e.g. a "back" chevron), don't just let text align right. **`make lint-styles` enforces
the mechanical half** — `margin-left`, `padding-right`, `left`, `right`, `float`, `text-align` and
friends are errors, because the logical equivalents (`margin-inline-start`, `inset-inline-end`;
align with flex or grid, since `text-align` itself is banned) are the same code in both directions. It cannot tell you an icon points the
wrong way; reach for `frontend-design:frontend-design` for that and for aesthetic direction.

The a11y gate (`make lint-accessibility`) audits whatever markup ships, RTL included — a mirrored
layout still has to pass the same AXE/WCAG checks as an LTR one.

## Monorepo integration

An Angular 21 app (project `cablan-frontend`), one subproject of a monorepo. **Read the root
`../CLAUDE.md` for the cross-cutting picture**; this section covers only how the frontend plugs in.

Everything runs in Docker via the `Makefile` — one `app` service defined in `docker-compose.yml`,
built from the `Dockerfile` (`node:24-bookworm-slim`), served by two Compose projects (see
[Two stacks](#two-stacks) below). The Makefile speaks the monorepo's shared vocabulary, so the root
Makefile's fan-out targets reach it:

- `make up` / `make down` — start/stop both dev servers (`ng serve`, http://localhost:4200 and
  http://localhost:4201), `up` waits until each serves.
- `make lint` / `make fix-lint` — ESLint (`ng lint`); the bare target is read-only, `fix-` writes.
- `make lint-styles` / `make fix-lint-styles` — stylelint, the design-system gate. See
  [The design-system gate](#the-design-system-gate) below.
- `make format` / `make fix-format` — Prettier; same read-only/writing split.
- `make run-unit-tests` — Vitest (jsdom), runs once and exits. Wired into the root `run-unit-tests`, so CI gates it.
  `ng test` watches by default, which would hang the target and CI, so `npm test` pins `--watch=false`; watching is
  the separate `npm run test:watch`, mirroring the backend's `test` / `test:watch` split. Keep that flag.
- `make lint-accessibility` — the axe-core audit, in a real browser. The one target here that needs
  the app running; see [Accessibility](#accessibility) below.
- `make sh`, `make logs`, `make npm <script>` — shell, logs, and any package.json script in the container.

Every check but `lint-accessibility` runs in a throwaway container
(`docker compose run --rm app npm run <script>`) needing nothing else up — no Node install, no browser
(Vitest uses jsdom). That is what lets CI run those gates with no setup and no secrets. Make targets
are verb-object hyphenated (`fix-format`); the wrapped package.json scripts keep the colon
(`format:fix`).

The frontend rides the root's existing `lint`/`format`/`run-unit-tests` fan-out, so CI covers it with
no workflow change. A _new kind_ of check would also need a root target, a CI job, and a
`run-guardrails` line — see `../CLAUDE.md`. `lint-accessibility` and `lint-styles` are the two
worked examples of that: frontend-only gates with all four pieces each.

### The design-system gate

`make lint-styles` runs stylelint over `src/**/*.scss` with `stylelint.config.js`. Its whole job is
to make it impossible to author a colour, spacing value, radius or type size by hand — those already
exist as tokens, and a literal is frozen in one colour scheme, so it breaks silently the moment the
page renders in the other one. The config comments say what each rule protects; the short form:

| Rule                                                      | Bans                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `color-no-hex`, `color-named`, `function-disallowed-list` | hex, named colours, `rgb()`/`hsl()`/`oklch()`/…                       |
| `scale-unlimited/declaration-strict-value`                | any non-`var()` colour, spacing, radius or type value                 |
| `declaration-no-important`                                | `!important`                                                          |
| `selector-disallowed-list`                                | `.mat-*`, `.cdk-*`, `::ng-deep`                                       |
| `property-disallowed-list`                                | physical properties (`margin-left`, `text-align`, …) — the app is RTL |

**Two holes a CSS linter structurally cannot see**, both closed in `eslint.config.js` instead, and
both part of this gate rather than separate policy:

- **`@angular-eslint/component-max-inline-declarations` with `styles: 0`** — stylelint cannot parse
  CSS embedded in a `.ts` file, so an inline `styles:` block would dodge every rule above. Component
  CSS must live in an external `.scss`. Note only `styles` is capped: inline **templates** are still
  allowed and still preferred for small components, which is why `template` and `animations` are
  explicitly lifted to `Infinity` rather than left at the rule's own 3-line default.
- **`@angular-eslint/template/no-inline-styles`** — a `style="…"` attribute is CSS that never
  reaches a stylesheet. `[style.x]` bindings stay legal; `ngStyle` does not, as elsewhere here.

Weakening either ESLint rule reopens a hole in the stylelint gate, not just in ESLint's. They are
one gate in two tools.

The token rules are deliberately **not** auto-fixable (`disableFix: true`): there is no way to guess
which token a literal was meant to be, and a confidently wrong token is worse than a visible error.
So `make fix-lint-styles` fixes formatting-adjacent things only — expect to fix token violations by
hand, using the skill's tables.

### Two stacks

The same image runs as two Compose projects, and `up` and `down` act on **both** — the backend's
split, mirrored:

|                    | dev                          | test                                   |
| ------------------ | ---------------------------- | -------------------------------------- |
| Compose project    | `cablan-frontend`            | `cablan-frontend-test`                 |
| Files              | `docker-compose.yml`         | `+ docker-compose.test.yml`            |
| Env file           | `.env` (from `.env.example`) | `.env.test` (from `.env.test.example`) |
| Published port     | 4200                         | 4201                                   |
| `API_PROXY_TARGET` | backend dev, `:3000`         | backend test, `:3001`                  |

The override file is five lines: the test stack is the same image with a different env file.
Only the _host_ side of the port mapping moves — `${APP_PORT:-4200}:4200` — so the container still
serves on 4200 and the healthcheck and `A11Y_BASE_URL` need no second value.

Target the test stack on its own:

```bash
make test-up             # build (if needed) and start just the test server, waiting until it serves
make test-down           # stop and remove just the test stack
make test-setup          # create .env.test from .env.test.example (make setup already does this)
```

**Why the split.** `make run-acceptance-tests` runs the suite against the backend's **test** stack,
which has its own database and gets truncated between scenarios. A frontend pointed at the dev
backend would be the wrong subject for that suite, and pointing the single stack at the test backend
instead would leave nothing to develop against. Two stacks, differing by port and proxy target, let
both be up at once — the normal state after `make up`.

Unlike the backend there is **no `NODE_ENV` switch**: nothing in `ng serve` changes behaviour on it,
and the frontend has no equivalent of `TestingModule` to gate. The two stacks differ by the port
they publish and the backend they proxy to, and by nothing else. Don't add one to "match".

Everything else stays on the dev stack — `logs`, `sh`, `npm`, `build`, `lint-accessibility`, and
every `docker compose run --rm` check. Those publish no ports, so they are safe to run while either
stack owns 4200 or 4201. There is no `test-reset`: unlike the backend there is no database volume to
wipe.

## The API client is generated — never hand-write it

HTTP services and their models are generated from an OpenAPI contract by
[orval](https://orval.dev) (`client: 'angular'`). Do not write a service that calls `HttpClient`
against the API by hand, and do not edit anything under `src/app/api` — the next command overwrites it.

| Path               |                                     |                                      |
| ------------------ | ----------------------------------- | ------------------------------------ |
| `api/openapi.json` | the contract                        | committed, but **not** hand-editable |
| `orval.config.ts`  | the generator config                | committed                            |
| `proxy.conf.mjs`   | where `/api` is forwarded           | committed                            |
| `src/app/api/`     | `<tag>/<tag>.service.ts` + `model/` | **generated, gitignored**            |

`api/` sits beside `src/`, not inside it, because the spec is an input to the build rather than
something TypeScript compiles or Angular serves — `tsconfig.app.json` includes only `src/**/*.ts`,
and `angular.json`'s asset glob covers only `public/`.

**You never run the generator explicitly.** `npm run generate:api` is wired to npm's `prestart`,
`prebuild`, `pretest`, `pretest:watch`, `prelint` and `prelint:fix` hooks, so `make up`,
`make run-unit-tests`, `make lint` and `make fix-lint` each rebuild the client from the committed
spec first. That is why
the generated tree can be gitignored without any command ever seeing a stale or missing client.
Nothing in this project reaches outside it: the contract is a file that lives here, which is what
keeps the project standalone. If a fresh clone's editor flags every `src/app/api` import as
unresolved, see `docs/environment-troubleshooting.md` — running any container target once
regenerates it.

`api/openapi.json` is refreshed from the API's own spec by **`make sync-api-contract`, run from
the monorepo root** — the only place allowed to name two projects at once — and `make
lint-api-contract` fails CI when the copy goes stale. It is in `.prettierignore` alongside the
vendored skills: the gate compares bytes, so reformatting would break it.

A `.claude/hooks` guard refuses hand edits to the contract, to everything under `src/app/api`, and
to the vendored skills and their `skills-lock.json` pin, naming the command that regenerates each —
the same treatment `backend/dist` and `acceptance-tests/target` get. `orval.config.ts` is not
guarded: it is the hand-written knob.

**If `make up` dies with `orval: not found`,** see `docs/environment-troubleshooting.md` — a
stale anonymous `node_modules` volume, the same trap the backend's Prisma client has.

Two settings in `orval.config.ts` are deliberate and commented there:

- **`retrievalClient: 'httpClient'`, not `'httpResource'`.** The `angular-developer` skill's
  `references/resource.md` says to prefer `httpResource`, but the v21 API reference still marks it
  **experimental (since v19.2)** and it is GET-only — it cannot express a `POST`. Reads that want a
  signal should wrap the returned Observable in `rxResource()`. Individual operations can opt in via
  `override.operations.<operationId>.angular.retrievalClient`.
- **No `baseUrl`.** Routes stay relative (`/api/users`), keeping the deployment target out of
  generated code. What forwards them is `proxy.conf.mjs` — see [Reaching the API](#reaching-the-api)
  below. Never put an address in the generator config.

Authentication is _not_ generated. The contract's `bearer` scheme belongs in a functional
`HttpInterceptorFn` registered as `provideHttpClient(withInterceptors([...]))` in `app.config.ts`,
not threaded through every generated call.

### Reaching the API

The generated client asks for `/api/users`; `proxy.conf.mjs` is what turns that into a real backend.
It is the dev server's `proxyConfig` (wired in `angular.json`'s `serve` target) and **the only place
in this project that names the backend's address**:

```js
const target = process.env['API_PROXY_TARGET'] ?? 'http://localhost:3000';
export default { '/api/**': { target, changeOrigin: true } };
```

That indirection is the point: the two stacks are one image differing by one env var, and every
request stays same-origin so the backend needs no CORS. It is deliberately `.mjs` (not
`proxy.conf.json` — JSON can't read the environment), deliberately beside `src/` not inside it, and
deliberately `host.docker.internal` not a service name (the backend is a separate Compose project
with its own network). It is also deliberately not `environment.apiUrl` + `fileReplacements` — that
remains the right mechanism for a _deployed_ build with no dev server to proxy through, but would
mean two builds here and a cross-origin call to `:3001`. See
`docs/environment-troubleshooting.md` if you're about to change any of this — the full reasoning
behind each choice lives there.

Nothing here breaks the monorepo's one-way dependency: `API_PROXY_TARGET` is a URL, not a path.
Nothing under `frontend/` resolves into `backend/`, and the project still builds if copied elsewhere.

### File downloads

**The Excel exports are built by the API, not here.** `POST /boms/report/export` and
`POST /standard-boms/report/export` answer with the `.xlsx` itself; the generated client already asks
for it with `responseType: 'blob'`, and the report gateways call it with `{ observe: 'response' }` so
`core/files/downloaded-file.ts` can name the file from its `Content-Disposition` (`filename*`
decoded by `content-disposition.ts`, falling back to the gateway's known file name). There is no
spreadsheet library in this project and none should come back.

`core/files/file-saver.ts` saves the blob as an object URL behind a clicked `<a download>`. Keep it
that way: a real browser `download` event is what an automated browser can capture, and a
`window.open` or a navigation to the blob would silently stop producing one. Page specs substitute
`FileSaver` through `TestBed`; its own spec stubs `URL.createObjectURL`, which jsdom lacks.

### Production image

`Dockerfile.prod` is a second, multi-stage image beside the dev-only `Dockerfile` — same
relationship as `Dockerfile.a11y`, a different purpose. It builds the static app (`npm run
build`, `angular.json`'s `production` configuration, already the default) and serves
`dist/cablan-frontend/browser/` from `nginx:1.27-alpine`, with `nginx/default.conf.template`
templated by the nginx image's own `envsubst` entrypoint — no custom entrypoint script.

**One origin, same as dev, so the same reasoning applies with no extra mechanism.** nginx serves
the built files _and_ reverse-proxies `/api/**` to the backend from one `server` block, exactly
what `proxy.conf.mjs` does for the dev server. That is why the production build still needs no
`environment.ts`/`fileReplacements` and the backend still needs no CORS: every request the browser
makes stays same-origin, whether the thing terminating that origin is Vite's dev server or nginx.
The generated client's relative routes (`/api/users`, …) resolve unchanged in both.

**`API_PROXY_TARGET` means the same _concept_ in both places — "where `/api` forwards to" — but a
different _kind_ of value.** In dev (`proxy.conf.mjs`) it is `host.docker.internal`, because the
backend is a separate Compose project reachable only through a port it publishes on the host. In
the production image it is whatever address actually reaches the backend from wherever this image
runs — a Compose service name, a Kubernetes Service, a load balancer's DNS name — set at container
run time (`docker run -e API_PROXY_TARGET=...`, or a Compose `environment:` entry) and defaulted in
`Dockerfile.prod` to `http://backend:3000` only so the image has something that starts.

**`npm ci` triggers none of the `pre*` hooks that regenerate the API client.** Those are wired to
`prestart`/`prebuild`/`pretest`/`pretest:watch`/`prelint`/`prelint:fix` — real npm scripts, not the
bare `ci` lifecycle — so the build stage runs `npm run generate:api` explicitly, from the committed
`api/openapi.json`, before `npm run build`. `orval.config.ts` and `src/app/api` are untouched by
any of this.

Build and run it locally with `make build-prod` and `make prod-up` (serves on
`http://localhost:8080`); `make prod-down` stops it. Neither target touches the dev/test Compose
stacks or their Makefile plumbing above — this image is a separate artifact, not a third stack.

### Testing against it

Generated code is not worth testing; the code that _calls_ it is. In `TestBed`, provide
`provideHttpClient()` **and** `provideHttpClientTesting()`, then assert requests through
`HttpTestingController`. Per `references/testing-fundamentals.md`, this project is zoneless: never
`fixture.detectChanges()` — Act, then `await fixture.whenStable()`, then assert, which is the shape
`src/app/app.spec.ts` already uses.

**There is no `vitest.config.ts`, and adding one would do nothing.** `angular.json`'s `test` target
is `@angular/build:unit-test` with no options at all, and that builder's `runnerConfig` defaults to
`false` — it does not go looking for a Vitest config file. The defaults it applies are the Vitest
runner and, with no `browsers` set, jsdom. If you genuinely need a runner setting, add it to
`angular.json`.

**`describe`/`it`/`expect`/`beforeEach`/`afterEach` are imported explicitly from `vitest`** in every
spec, not pulled in via `vitest/globals` ambient types (`tsconfig.spec.json` sets `"types": []`, same
as `tsconfig.app.json`). The globals mode is what Vitest's own docs default to, but WebStorm's
TypeScript service cannot fully resolve `it`'s type through it — `typeof import('vitest')['it']`
inside `vitest/globals.d.ts`'s `declare global` block evaluates to `{}` there (`describe`'s simpler
`SuiteAPI` type is unaffected), even though `tsc --noEmit` is clean both on the host and in the
container. An explicit `import { it } from 'vitest'` sidesteps the ambient-global-plus-`typeof`-
indexing path entirely. Keep new specs consistent with this — don't reintroduce `vitest/globals`.

> `references/creating-services.md` in the vendored skill tells you to write `@Service()`. **That
> decorator does not exist in the installed `@angular/core` 21.2.x** — only `Injectable` is
> declared. Ignore that page's decorator advice.

The generated tree is written by a container running as root, so it is root-owned on the host:
`git clean` and `rm -rf` need `sudo`, or run them through `docker compose run --rm app`. The
Angular build cache used to be the same nuisance; it now lives in an anonymous volume
(`- /app/.angular`) and never reaches the host at all — that volume is there because two dev
servers sharing one dependency-optimizer cache would race, and losing the root-owned directory is
the bonus.

## Directory layout

```
src/
  styles.scss                  global stylesheet entry — see The design system above
  styles/                      its eight partials, including the mat.theme() call
  app/
    app.ts, app.html, app.scss the shell: router outlet, live region — no page content of its own
    app.config.ts              providers — HTTP, router, interceptors
    app.routes.ts              the route table
    core/       singletons and cross-cutting concerns — no UI. Injected anywhere.
      http/       interceptors, HttpContext tokens, problem-details narrowing
      identity/   SessionStore, CurrentUserStore, the auth guard, the two authorization tables
    features/   routed pages, lazy, one chunk per feature
    ui/         presentational components, route-agnostic. Every list page is `app-page-header` +
                `app-data-sheet` (search, `app-filter-button`s, `app-active-filters`, the table,
                `app-error-banner` / `app-empty-state`, the paginator); every dialog is
                `app-dialog-head` (or `app-confirm-head`) + content + a `.dialog-footer`. Also here:
                `app-stat-tile`, `app-status-badge`, `app-type-tag`, `app-weight-difference`,
                `app-table-search`, `app-category-icon`, the copy-id button and the date, checkbox
                and select fields, and the `appStackedTable` directive (a table's phone layout).
                Reach for one before building markup of your own.
    api/        GENERATED. Off-limits; see above.
```

**Stylesheets are `.scss`, not `.css`** — Material's theming API is Sass-only. `angular.json`'s
component schematic defaults new components to `scss` accordingly. And a component's styles must be
an external file next to it, never an inline `styles:` block: see
[The design-system gate](#the-design-system-gate).

This mirrors the backend's `framework/` vs `modules/<domain>/` split, so the two projects describe
themselves with the same vocabulary. `features/` holds one folder per routed page group — `home`,
`login`, `not-found`, `boms`, `standard-boms`, `products`, `materials`, `components`, `users`,
`audit-log` and `bom-dashboard` — each with its page and its dialogs.

**Specs are co-located** — `foo.spec.ts` sits beside `foo.ts`, not in a parallel tree. That is why
`tsconfig.spec.json` includes `src/**/*.spec.ts` while `tsconfig.app.json` excludes it; keep both in
step if you ever move them.

Two things about the shell that a new page has to cooperate with:

- **Every route must declare a `title`.** `App` reads it off the router snapshot and writes it into
  a `<p role="status">` live region, which is how a screen reader learns the page changed at all —
  Angular's router does not announce navigation on its own. A route without a `title` regresses that
  silently, and no gate catches it.
- **Query parameters arrive as `input()` signals**, via `withComponentInputBinding()` in
  `app.config.ts`. They are not bound at construction time, so a value derived from one needs
  `linkedSignal`, not `signal`.

## Authentication

The API issues (or will issue) a bearer token in a JSON body — no cookie — so the client has to
hold it. The pieces below are generic session infrastructure, kept through the NMK-to-Cablan
rewrite because none of them are tied to a specific login flow or page design; the pages that call
them are being rebuilt from scratch.

- **`SessionStore` keeps it in `localStorage`**, under the key exported by
  `core/identity/access-token-storage-key.ts` (beside its receipt time — see expiry below). Be honest about the trade-off rather than quiet about
  it: any script on this origin can read that token, so an XSS anywhere in the app or its
  dependencies is a full account takeover. What it buys is a session that survives a reload and a
  second tab. **If the API ever sets an `httpOnly`, `SameSite=Strict` cookie, delete that class
  outright** rather than adapting it — there would be nothing left for it to hold.
- **`accessTokenInterceptor` attaches it** to any `/api/**` request that is not marked `SKIP_AUTH`.
  The opt-out is an `HttpContextToken` set at the **call site** (`{ context: anonymous() }`), never a
  URL list inside the interceptor: distinguishing an anonymous endpoint (e.g. a login call) from an
  authenticated one means re-encoding route knowledge the generated client already owns, somewhere
  no gate keeps in sync. Whatever gateway service calls the new login endpoint is where that call
  site belongs.
- **No live session means `/login`, from every URL — never not-found, never "no access".** An
  outsider must not be able to probe which pages exist, so an existing page, one their role could
  not reach and a path that matches nothing all answer them with the same redirect. `authGuard` sits
  on every `guardedRoute` **and** on the `notFoundRoute()` catch-all (`core/identity/guarded-route.ts`);
  only `/login` itself is unguarded. Three things count as "no session", and all three are handled
  alike:
  - **no token**;
  - **an expired one** — and expiry is judged on **the browser's own clock only**. The JWT's `exp`
    is a server-clock timestamp, and comparing it with `Date.now()` logged out anyone whose PC clock
    ran fast by more than the token's hour the moment they signed in. So `SessionStore` records when
    it _received_ the token (`Date.now()` at `store()`, persisted beside it under the second key in
    `access-token-storage-key.ts`, so a reload measures from the same moment), reads the lifetime as
    `exp - iat` with `jwt-decode` (never the signature, which only the API can check), and drops the
    token — from the signal _and_ `localStorage` — once that much local time has passed since
    receipt. It checks on construction and whenever `discardIfExpired()` is called; the guard calls
    it on every navigation and the interceptor on every API call, so a token that expires while the
    user sits on a page is caught at the next of either. **A token it cannot judge counts as
    expired**: not a JWT, a missing or malformed `iat`/`exp`, or no readable receipt time — which
    includes every token stored before receipt times were recorded, so those users log in once more;
  - **one the API rejects** — any other token is put to `GET /api/users/me` by the guard (through
    `CurrentUserStore.load()`, the same request the route's role check needs anyway, so it costs
    nothing extra) before anything renders, so a forged or revoked token never sees a 404 either.
- **Any 401 ends the session.** The interceptor clears the token, closes any open dialog (its overlay
  lives outside the router outlet and would survive the navigation) and redirects to
  `/login?returnUrl=…`. Three exceptions, each deliberate: a request marked `SKIP_AUTH` never
  reaches that handler, which is what lets a failed _login_ (a 401 meaning "wrong password") show
  its own error instead of looping; a token stored _while_ the rejected request was in flight (a
  login completing meanwhile) is kept, since the 401 judged the token that was sent; and
  mid-navigation the interceptor leaves the redirect to `authGuard`, because `router.url` would
  still name the page being left rather than the one the visitor was headed for. `returnUrl` is read
  by the login page as an input and followed after a successful login.
- **`authGuard` is UX, not security.** It spares the user a page that would only fail, and keeps
  the route table from being probed through the UI — but the table ships in the bundle regardless.
  The API is what actually enforces anything, and it would 401 regardless.
- **`CurrentUserStore` caches per token**, not until told to forget: the session can end or change
  hands without anyone calling its `clear()` (an expiry, a rejected token), so a cached user is
  dropped as soon as the session's token differs from the one it was fetched with.

Specs that store a token use `core/identity/testing/fake-access-token.ts`: `fakeAccessToken()` is
a live one-hour token (`{ subject }` tells two apart, `{ lifetimeSeconds, issuedAt }` shape its
claims), and `unsignedJwt(payload)` builds one with a claim missing or mangled. **A bare string like
`'a-valid-token'` no longer works** — it carries no `iat`/`exp`, so the first guard or interceptor
call discards it. Since expiry runs from receipt, an _expired_ session is made by storing a token and
then moving the clock past its lifetime with `moveClock(seconds)` from `core/identity/testing/clock.ts`
(it fakes `Date` only, so router and `HttpClient` timers keep running; pair it with
`vi.useRealTimers()` in `afterEach`).
`app.routes.spec.ts` drives the whole route table and is where the "every URL looks the same to an
outsider" property is pinned.

`SessionStore` reads `localStorage` in a **field initialiser**, i.e. during construction. Two
consequences: the class cannot be instantiated where there is no `localStorage` (so it is not
SSR-safe as written), and a spec that touches it needs `localStorage.clear()` in `beforeEach` or
state leaks between tests. It also deliberately registers no `storage` event listener, so logging
out in one tab leaves the others logged in.

## Authorization

The bearer token carries no role claim — deliberately, so a demotion takes effect at once instead of
waiting out the token's hour — so `CurrentUserStore` fetches `GET /users/me` once per session and
every UI decision reads `role()` off it. Two tables in `core/identity/` hold the rules, and neither
is a security boundary: both ship in the bundle, and the API's `RolesGuard` is what actually refuses
anything.

- **`navigation.ts` decides which _pages_ a role may reach.** `NAVIGATION` is a tree of categories
  and pages, with roles on the pages only; a category shows exactly when one of its pages can be
  reached. It is read by the drawer and the home page (through `navigationFor`) and by
  `app.routes.ts` (through `guardedRoute` → `canReach`), so none of the three can drift. Home itself
  sits outside the tree — it has a rule, but the drawer does not list it; the toolbar brand links
  there instead.
  For a signed-in user, a withheld route renders the not-found page **in place** rather than
  redirecting: bouncing `/users` while `/no-such-page` renders where it stands would itself prove
  `/users` exists. (A visitor without a session never gets this far — see
  [Authentication](#authentication): every URL sends them to `/login`.)
- **`permissions.ts` decides which _actions_ a role may take on a page it can reach.** Both BOM
  pages are reachable by everyone — browsing, filtering and exporting carry no role restriction, and
  گزارشگیر exists to read exactly those reports — so what the role decides there is only whether
  افزودن/ویرایش/حذف are offered. The two domains draw that line in different places, matching the
  backend's own `@Roles()`: `canManageBoms` admits بازرس کنترل کیفیت، مدیریت، مدیر سیستم, while
  `canManageStandardBoms` admits only the latter two.

A page gates its affordances by passing that answer down — `/boms` and `/standard-boms` both compute
a `canManage()` and hand it to the detail dialog as data, so the card and the row hide the same
buttons rather than the card offering something the row does not. **The dialogs still map a 403 to
an access-denied message**, and that is not dead code: it is the answer to a role that changed
mid-session.

Because the role is resolved before `guardedRoute` constructs the page, a page spec has to seed it
the same way — `SessionStore.store(…)`, then `CurrentUserStore.load()` with `GET /users/me` flushed,
then create the component. `boms-page.spec.ts` and `app-shell.spec.ts` both show the shape.

## Accessibility

Two requirements, and they are gated, not aspirational:

- **It MUST pass all AXE checks.**
- **It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA
  attributes.**

Three layers enforce as much of that as a machine can, and the third one is you.

### `make lint-accessibility` — axe-core in a real browser

`a11y/accessibility.spec.ts` loads every route in a headless Chromium and runs axe over the rendered
page, failing on any violation tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` or `wcag22aa`.
`best-practice`, AAA and `experimental` rules are deliberately excluded — see the comment on
`wcagAaTags` for why.

**Add your route to `publicRoutes` or `authenticatedRoutes` when you add a page.** A page missing
from both lists is a page nothing checks; it is the one manual step the gate depends on.

**Every route is audited twice, once per colour scheme** (`colourSchemes`, via
`page.emulateMedia({ colorScheme })` before each `goto`). The theme emits every colour as a
`light-dark()` pair, so dark is not an opt-in variant — it is what any visitor whose OS prefers dark
sees, and half of what this gate checks is contrast. Both schemes are named explicitly rather than
letting one ride on Chromium's default, which is a property of the runner rather than a decision of
ours: a machine that preferred dark would silently swap which half of the palette got covered, and
the run would stay green either way.

**And every route is audited again at phone width** (375×812, both schemes — the `on a phone,
portrait` block), where it also fails if anything scrolls sideways: every scroll container is
measured, not just the document, for the reason given under [Phones](#phones). The stacked table
layout and the dashboard's re-flowed analysis headers only render there, so that is the only place
their markup and contrast are graded.

The failure this catches is specific and easy to write by accident. A colour that clears 4.5:1 on a
light surface can sit at 1.08:1 on a dark one, and the `--mat-sys-*-fixed` tokens are the usual way
in — they deliberately do **not** change between schemes, so text coloured from one stays dark on a
dark background. Before the second pass existed, that shipped green.

**The audit waits for the DOM to go quiet before it grades** (`waitForRenderToSettle`), not merely
for `app-root` to be non-empty. Zoneless Angular builds a lazily routed page in two steps — elements
created on activation, bindings (`<label for>`, `aria-expanded`) written in the change-detection pass
after — and axe can land between them, reporting `label`/`aria-required-attr` on inputs that are
labelled a frame later. `/boms` failed that way roughly 1 run in 40 on a warm server. `Testability`
cannot answer "settled" without a zone, which is why the helper watches mutations instead.

The split exists because every route but `/login` sits behind `authGuard` — `/no-such-page`
included, since without a session even the catch-all redirects to `/login` (see
[Authentication](#authentication)). Rather than give the audit a real session — which would make the
one gate that needs a browser _also_ need a migrated database and a seeded user, throwing away the
hermeticity every other frontend check has — the authenticated block seeds a token and stubs the
calls the pages make. The seeded session has to be one `SessionStore` judges live — a
`fakeAccessToken()` JWT plus a receipt time of the browser's own `Date.now()` — or the store discards
it and every authenticated route quietly audits the login page instead:

- **`page.addInitScript`, not `page.evaluate`.** It has to run before any page script, because
  `SessionStore` reads the token as it is constructed and the guard redirects on the first
  navigation. Writing the key after `goto` is already too late.
- **`page.route('**/api/users/me', …)`** fulfils in the browser, upstream of the dev server's proxy,
  so nothing reaches the backend.
- Both keys are **imported** from `core/identity/access-token-storage-key.ts`, not retyped, and the
  token from `core/identity/testing/fake-access-token.ts`. Both modules are dependency-free precisely
  so `a11y/` can import them — which is also why `tsconfig.a11y.json` lists them explicitly in
  `include`.

The trade-off is worth stating: this proves the profile page's _markup_ is accessible, not that any
particular real payload is. And a form's **error state is not reachable by `goto`**, so nothing here
grades it — that belongs to the manual pass below.

It runs in a browser rather than in the Vitest suite for one reason: jsdom has no layout and no CSS
cascade, so axe's `color-contrast` rule can only ever return _incomplete_ there. Contrast is half the
requirement, so the audit has to see real pixels. Don't try to move it into a unit test.

| Path                         |                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `a11y/accessibility.spec.ts` | the audit and its route list                                                    |
| `playwright.config.ts`       | runner config; `baseURL` comes from `A11Y_BASE_URL`, set by Compose             |
| `Dockerfile.a11y`            | the audit's image — the dev server's Node base plus Chromium                    |
| `tsconfig.a11y.json`         | so the editor and `tsc` see these files; the root tsconfig is references-only   |
| `a11y/report/`               | **generated**, gitignored; CI uploads it as the `accessibility-report` artifact |
| `a11y/.output/`              | **generated**, gitignored; Playwright's per-test output (`outputDir`)           |

`a11y/` sits beside `src/`, not inside it — same reasoning as `api/`: it is tooling, not something
Angular compiles or serves. That also keeps it clear of the unit-test builder's spec discovery, so
Vitest and Playwright never fight over a `.spec.ts`. Like the generated client, `a11y/report` is
written by a container running as root and so is root-owned on the host — deleting it needs `sudo`,
or `docker compose run --rm app rm -rf a11y/report`.

Unlike every other target here it needs the app up, so `make lint-accessibility` starts the dev
server itself and waits for its healthcheck. It leaves it running, exactly as
`make run-acceptance-tests` does — `make down` when you are finished.

The audit reaches it on **`http://localhost:4200`**, because the `a11y` service joins the dev
server's own network namespace (`network_mode: service:app`). Don't "simplify" that to the service
name: `http://app:4200` fails twice over. Chromium force-upgrades it to HTTPS — `.app` is an
HSTS-preloaded TLD and the service is named `app` — and reports the mismatch as a thoroughly
misleading `net::ERR_SSL_PROTOCOL_ERROR`. Behind that, Vite's DNS-rebinding defence 403s any `Host`
it doesn't recognise, which would need an `allowedHosts` entry in `angular.json`. localhost is
exempt from both, so neither workaround is needed.

The audit gets its own image so that only this one gate carries a browser; `lint`, `format` and
`run-unit-tests` keep cold-building the plain `node:24-bookworm-slim` one, which matters because
every CI job builds from scratch. The `a11y` service sits behind a Compose profile, so `make up`
ignores it.

That image is **not** `mcr.microsoft.com/playwright`. It is the same Node base as the dev server
plus `npx playwright install --with-deps chromium` — one browser instead of the three that image
ships, and no image tag to keep in step with `package.json`, because `playwright install` fetches
whatever the installed `@playwright/test` pins. Upgrading Playwright is therefore an ordinary
dependency bump. Don't reintroduce the coupling by switching to a prebuilt browser image.

If the audit ever needs a second engine, add it to that `playwright install` line and to
`playwright.config.ts`'s `projects` — but note that axe grades markup and computed style, so a
second engine mostly re-proves the first. Chromium alone is the deliberate default.

> **If the image build dies with `403 … this service is not available in your location`,** see
> `docs/environment-troubleshooting.md` — Playwright's CDN is geo-blocked where you are, and
> `PLAYWRIGHT_DOWNLOAD_HOST` in `.env` is the opt-in fix.

### `make lint` — the static layer

`eslint.config.js` extends `angular.configs.templateAccessibility` (ARIA validity, labels,
alternative text, `interactive-supports-focus`, …) and adds `no-positive-tabindex` and
`button-has-type`. This catches in the editor what the audit would otherwise catch minutes later in
a container.

What it looks at is `angular.json`'s `lintFilePatterns`: `src/**/*.ts`, `src/**/*.html` **and
`a11y/**/*.ts`**. The audit's own source is linted along with the app. The generated client is not,
and is excluded on purpose — there is nothing to fix in code no one hand-edits.

### The part no tool checks

Automated rules detect roughly a third of WCAG failures, and **focus management is mostly in the
other two thirds** — axe can see a bad `tabindex`, but not that focus went nowhere. Work through this
by hand during the `frontend-design` critique pass and the `claude-in-chrome` review that skill ends
in, for any UI with state:

- Opening a dialog, menu or drawer moves focus into it; closing it returns focus to the trigger.
- While a modal is open, Tab is trapped inside it and Escape closes it.
- Focus is visible on every interactive element — never `outline: none` without a replacement
  `:focus-visible` style that meets 3:1 against its surroundings.
- Tab order follows reading order, which means DOM order: no CSS reordering that leaves the
  keyboard walking the page sideways.
- A form with `novalidate` still renders its accessible errors on submit (see the signal-forms
  traps under [Components](#components)) — jsdom cannot show you this.
- A skip link precedes repeated navigation.
- Anything asynchronous that changes the page announces itself (a live region), and errors move
  focus to the first invalid field.

**Never trigger `alert`, `confirm` or `prompt` while driving the page** — a modal dialog blocks the
Chrome extension for the rest of the session.

A green `make lint-accessibility` means no _detectable_ violation. It is a floor, not a pass mark.

## Editor / host node_modules

The app needs no host `node_modules` — everything runs in Docker. An editor needs one on disk for
IntelliSense and type-checking, kept in sync with **`npm ci`** (never `npm install`, which rewrites
the lockfile) after the container's dependencies change. **Real** dependency changes happen inside
the container (`make sh` → `npm install`) and get committed from there — exactly how orval was
added — so `npm ci` everywhere stays consistent.

Full sync mechanics and three frontend-specific wrinkles (Playwright's browser download, orval's
Node floor, a fresh clone's missing generated client) are in
`docs/environment-troubleshooting.md`.

## Angular & TypeScript best practices

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images — should any arrive. The app currently renders no
  `<img>` at all, so this is a rule for the first one, not a description of existing code.
  - `NgOptimizedImage` does not work for inline base64 images.
- **The app is zoneless because Angular 21 defaults to it**, not because anything configures it.
  There is no `provideZonelessChangeDetection()`, no `zone.js` dependency and no `polyfills` entry
  in `angular.json`, and all three absences are correct. Don't "fix" them in either direction.

### Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

Both are gated — `make lint-accessibility` and `make lint`. See [Accessibility](#accessibility) for
what each layer covers, what neither can, and the route list you have to keep current.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components — but **never inline styles**; those must be an
  external `.scss`, and ESLint enforces it. See [The design-system gate](#the-design-system-gate).
- Reach for a `mat-*` component before building one. The `cablan-design-system` skill has the
  mapping; building a custom version of something Material ships is a violation, not a shortcut.
- Use **Signal Forms** (`@angular/forms/signals`) for every form — the v21+ default, and what the
  `angular-developer` skill mandates. Do NOT import `FormControl`, `FormGroup`, `FormArray` or
  `FormBuilder`; signal forms replace them and there is no builder. Read
  `.claude/skills/angular-developer/references/signal-forms.md` rather than working from memory.
  The form control itself is `<mat-form-field appearance="outline">` with `matInput` — there is no
  bespoke `<app-text-field>` and there should not be one; the old one belonged to the deleted
  NMK-era design and Material replaces it. Four traps:
  - **`<form novalidate>` is mandatory.** `[formField]` writes real `required`/`minlength` DOM
    attributes, so without it the browser's own constraint validation swallows the `submit` event
    and the accessible error region never renders. **jsdom does not reproduce this** — the specs
    stay green while the real page is broken, so it is a browser-review item (see
    [The part no tool checks](#the-part-no-tool-checks)).
  - The directive selector is **`[formField]`**, not `[field]`.
  - **`f.email` is the field; `f.email()` is its state.** Flags live on the state —
    `f.email().touched()`, `f.email().errors()` — in templates too.
  - **Never `null` or `undefined` as an initial field value.** Use `''`, `0`, `[]`.
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead — and note a literal `style="…"` attribute is
  an ESLint error, since it is CSS no stylesheet linter can reach
- When using external templates/styles, use paths relative to the component TS file.

### State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- **Bridge Observables into signals, not through the async pipe.** This project uses `toSignal` for
  a stream it just reads (`app.ts`); reach for `rxResource` for a request whose loading and error
  states a template needs — that's what `orval.config.ts`'s `retrievalClient` choice assumes. There
  is no `AsyncPipe` in the codebase; don't introduce the first one.
- Do not assume globals like (`new Date()`) are available.

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

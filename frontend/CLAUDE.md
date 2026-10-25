# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Skills.** Invoke the ones that fit before writing code:

- `cablan-design-system` — **read first for anything that renders**: the `--mat-sys-*` /
  `--cablan-*` token lists, the `mat-*` component per pattern, the `make lint-styles` rules, and the
  design-system Gotchas. It is **ours** (hand-written, not in `skills-lock.json`, edit it as the
  design system changes) and **wins wherever the vendored skills disagree** — notably both of them
  recommend Tailwind; Cablan has none and wants none.
- `angular-developer` — vendored from `angular/skills`, pinned in `skills-lock.json`. Its `SKILL.md`
  routes to a `references/*.md` page per topic; read the one at hand rather than working from
  memory. Ignore `references/creating-services.md`'s `@Service()` — that decorator does not exist in
  the installed `@angular/core` 21.2.x; use `@Injectable`.
- `angular-new-app` — scaffolding only; this app exists. Its `ng generate` recipes still apply.
- `handbook:oop-guideline`, `handbook:test-guideline`, `superpowers:test-driven-development`,
  `frontend-design:frontend-design` (new UI or visual reshaping).
- `run` and `anthropic-skills:chrome-browser` (tools `mcp__claude-in-chrome__*`) — to look at the
  rendered page; `frontend-design`'s critique pass can't be done by reading templates.

Both Angular skills assume a host `ng`. There is none — it lives in the container's `node_modules`
(an anonymous volume; the repo is bind-mounted at `/app`, so generated files land on the host).
Translate `ng <cmd>` into `docker compose run --rm app npx ng <cmd>`; "run `ng build`" is
`docker compose run --rm app npm run build` — `make build` rebuilds the Docker image.

**The `angular-cli` MCP server** (root `.mcp.json`, `@angular/cli@21 mcp --read-only`) finds this
workspace on its own. Prefer its `search_documentation` (clamped to our major) over `context7`;
`get_best_practices` reads the _installed_ `@angular/core`, complementing the pinned skill;
`find_examples` answers "show me how". `--read-only` bars its `build`/`test`/`devserver` tools,
which would shell out to a host `ng` — building and testing stay in Docker. It must run on the host:
it sandboxes itself to host paths, which don't exist under `/app`.

## The design system

**Angular Material 21, themed with Material Design 3.** Colour, typography, shape and elevation are
CSS custom properties; component code references them and never authors a value. The skill has the
names and the component mapping; this is only the shape.

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
src/styles/_stacked-table.scss  the phone layout for tables — see "Phones" below
design/tokens.json       a byte copy of the design system's token file (Prettier-ignored)
```

The design-system traps (`mat.theme()` not `define-theme()`, one theme covering both schemes, the
three literal-holding partials, restyling only via `mat.*-overrides`) are in the skill's
**Gotchas**. The one rule to repeat here: **never nudge a colour by eye.** `_theme.scss` must agree
with `design/tokens.json` (the Claude Design project _Cablan Design System 2_), and
`a11y/design-tokens.spec.ts` resolves every colour of that file in a real browser, in both schemes,
and fails on a mismatch — re-sync the file and fix the palette.

### Phones

**Every page has to work on a phone held upright (~360–390px), in Chrome and Safari, with every
action still reachable** — issue #41. A new page gets this by using the existing building blocks:

- **The page never runs wider than the screen.** `app.scss` gives `main`
  `grid-template-columns: minmax(0, 1fr)`; an implicit `auto` track grew to the routed page's
  min-content and the page scrolled sideways. That overflow shows up **inside
  `mat-sidenav-content`**, the app's scroll container — `document.documentElement.scrollWidth`
  stays equal to the viewport either way, so measure the scroller, not the document.
- **Tables fold into cards.** `app-data-sheet` puts `appStackedTable` (`ui/stacked-table/`) on its
  body: below 40rem of container width each row becomes a card and each cell a «label value» line.
  The directive copies each header's text onto the cells as `data-label`;
  `styles/_stacked-table.scss` lays it out with a **container** query. It is CSS over the same DOM —
  the `<table>`, Material's explicit `role`s, every accessible name and the DOM order stay, which is
  what the acceptance suite's role-and-name locators and screen-reader table navigation depend on. A
  `.visually-hidden` header column (row actions) becomes the card footer; a sortable
  `th[aria-sort]` stays visible. A table outside a data sheet opts in on its own wrapper (the
  dashboard's lines do). Never restructure a table's markup for mobile.
- **A wide table's row actions are pinned** with Material's `stickyEnd` (`/boms`: nine business
  columns outgrow the sheet at 1280px with the drawer open). Without it the trailing «عملیات بیشتر
  برای …» button is correctly named but off-screen.
- **Everything else wraps** — page header, filter bar, data-sheet bar, dialog footers. Keep new rows
  wrapping (`flex-wrap`, `minmax(0, 1fr)`, `min-inline-size: 0` on text-holding flex children)
  rather than adding fixed widths.

Look at a new page at 375px before calling it done. If you screenshot with Playwright, avoid
`fullPage` at desktop widths: Chromium resizes the viewport to 1×1 and back, crossing the shell's
60rem drawer breakpoint and catching the drawer mid-animation. Use a tall viewport.

### Persian, RTL

`index.html` carries `lang="fa"` and `dir="rtl"` — whole-app, never set per component. Material
mirrors every `mat-*` component off it through the CDK's `Directionality`. RTL is a layout concern:
mirror layouts and directional icons (a "back" chevron), don't just right-align text.
`make lint-styles` bans the physical properties (`margin-left`, `left`, `float`, `text-align`, …);
use the logical ones, and align with flex/grid. It cannot tell you an icon points the wrong way.

**Numbers a visitor reads are Persian digits** — `core/i18n/persian-numerals.ts`:
`formatPersianNumber` for a quantity (`Intl.NumberFormat('fa-IR')`, grouping and decimal mark
included) and `toPersianDigits` for text that must not be regrouped (a Jalali date). Templates use
the `persianNumber` pipe (`ui/persian-number/`). **Not `DecimalPipe`/`LOCALE_ID`** — Angular
localises separators only and emits Latin digits under `fa`; there is deliberately no `LOCALE_ID`
provider. **Identifiers keep Latin digits** (order numbers, MI codes, UUIDs). Material's own chrome
is Persian via `PersianPaginatorIntl` and `PersianDatepickerIntl` (`core/material/`).

**Dates are Jalali, in the viewer's own time zone.** `provideJalaliDateAdapter()`
(`core/material/jalali-date-adapter.ts`, registered in `app.config.ts`) makes every
`mat-datepicker`/`mat-timepicker` a Jalali calendar and a 24-hour clock via
`ngx-material-date-fns-adapter` + `date-fns-jalali`; its pinned formats are commented there
(`monthYearLabel: 'LLL uuuu'` is load-bearing). `core/date/jalali-datetime.ts` only _formats_
(`۱۴۰۳/۰۴/۰۱ ۰۸:۳۰`); the pickers read and write through the adapter — keep one calendar
implementation. Inputs use `app-jalali-datetime-field` (calendar, clock, «اکنون») and
`app-date-range-presets`; `core/date/date-range-form.ts` is the shared signal-form schema. The API's
instants stay ISO. **Date and time inputs take no typing** (issue #52): both are `readonly`, set in
the component after first render because `[formField]` owns the attribute (NG8022) and the field's
own `readonly()` rule would skip validation. Clicking an input opens its picker, ↓ opens it from the
keyboard, Delete/Backspace clears the bound.

**Search is normalised, nothing else.** `core/i18n/search-normalizer.ts` (`normalizeForSearch`,
`matchesSearch`) folds Arabic/Persian letter variants, digit scripts, ZWNJ, tatweel and diacritics
so a value stays findable. Never display or send the folded text.

## Monorepo integration

An Angular 21 app (project `cablan-frontend`), one subproject of the monorepo — **read the root
`../CLAUDE.md` for the cross-cutting picture** (one-way contract, CI, guardrails). Everything runs
in Docker via the `Makefile` (one `app` service, `node:24-bookworm-slim`):

- `make setup` — create `.env`/`.env.test` from their examples (a prerequisite of most targets).
- `make up` / `make down` / `make restart` — both dev servers (`ng serve`, :4200 and :4201); `up`
  waits until each serves. `make ps` shows them.
- `make lint` / `make fix-lint` — ESLint (`ng lint`); bare is read-only, `fix-` writes.
- `make lint-styles` / `make fix-lint-styles` — stylelint, the design-system gate (below).
- `make format` / `make fix-format` — Prettier, including this file.
- `make run-unit-tests` — Vitest (jsdom), once. `npm test` pins `--watch=false` so the target and CI
  don't hang; watching is `npm run test:watch`. Keep that flag.
- `make lint-accessibility` — the browser gate; see [Accessibility](#accessibility).
- `make logs`; `make sh` and `make npm <script>` **exec into the running container** — they need
  `make up` first.

Every check but `lint-accessibility` runs in a throwaway container
(`docker compose run --rm app npm run <script>`) needing nothing up. Make targets are
verb-object (`fix-format`); the wrapped npm scripts keep the colon (`format:fix`). A _new kind_ of
check needs a root target, a CI job and a `run-guardrails` line — `lint-styles` and
`lint-accessibility` are the worked examples.

### The design-system gate

`make lint-styles` runs stylelint over `src/**/*.scss` (`stylelint.config.js`, each rule commented)
and makes it impossible to hand-author a colour, spacing, radius or type value, `!important`, a
`.mat-*`/`.cdk-*`/`::ng-deep` selector, or a physical property. Two holes CSS linting can't see are
closed in `eslint.config.js` as part of the same gate: `component-max-inline-declarations` with
`styles: 0` (no inline `styles:` — stylelint can't parse CSS in `.ts`; inline _templates_ stay
allowed) and `template/no-inline-styles` (no `style="…"`; `[style.x]` bindings are fine). Weakening
either reopens the stylelint gate. Token rules are `disableFix: true` — a guessed token is worse
than an error — so fix those by hand from the skill's tables.

### Two stacks

One image, two Compose projects; `up`/`down` act on both.

|                    | dev                          | test                                   |
| ------------------ | ---------------------------- | -------------------------------------- |
| Compose project    | `cablan-frontend`            | `cablan-frontend-test`                 |
| Files              | `docker-compose.yml`         | `+ docker-compose.test.yml`            |
| Env file           | `.env` (from `.env.example`) | `.env.test` (from `.env.test.example`) |
| Published port     | 4200                         | 4201                                   |
| `API_PROXY_TARGET` | backend dev, `:3000`         | backend test, `:3001`                  |

`make test-up` / `test-down` / `test-setup` target the test stack alone. It exists because the
acceptance suite drives the backend's **test** stack (truncated between scenarios); two stacks let
that and development coexist. Only the host side of the port moves (`${APP_PORT:-4200}:4200`), so
the healthcheck and `A11Y_BASE_URL` need one value. **No `NODE_ENV` switch** — nothing in
`ng serve` reads one; don't add one to "match" the backend. Everything else (`logs`, `sh`, `npm`,
`build`, `lint-accessibility`, the `run --rm` checks) uses the dev stack; there is no `test-reset`.

## The API client is generated — never hand-write it

orval (`client: 'angular'`) generates services and models from `api/openapi.json` into
`src/app/api/` (**gitignored**, rewritten by npm's `prestart`/`prebuild`/`pretest`/`pretest:watch`/
`prelint`/`prelint:fix` hooks — you never run the generator yourself). Never edit `src/app/api` or
`api/openapi.json`: the contract is refreshed only by `make sync-api-contract` at the monorepo root
and `make lint-api-contract` compares it byte-for-byte (hence `.prettierignore`). The root
`.claude/hooks/guard-generated-files.sh` refuses hand edits to both, and to the vendored skills and
`skills-lock.json`. `orval.config.ts` is the hand-written knob, with two deliberate settings:

- **`retrievalClient: 'httpClient'`, not `'httpResource'`** — the latter is still experimental in v21
  and GET-only. A read that wants a signal wraps the Observable in `rxResource()`.
- **No `baseUrl`.** Routes stay relative (`/api/users`); `proxy.conf.mjs` forwards `/api/**` to
  `API_PROXY_TARGET` (`host.docker.internal`, since the backend is another Compose project) — the
  only place the backend's address appears, and why everything stays same-origin with no CORS.
  `.mjs` because JSON can't read the environment; not `environment.ts` + `fileReplacements`.
  `docs/environment-troubleshooting.md` has the full reasoning, and the fixes for `orval: not found`
  (a stale anonymous `node_modules` volume) and a fresh clone's unresolved `src/app/api` imports.

The generated tree is root-owned on the host (written by the container): `git clean`/`rm -rf` need
`sudo` or `docker compose run --rm app`. The Angular cache lives in an anonymous volume
(`/app/.angular`) so the two dev servers don't race on it.

### Gateways: how features reach the API

**Features never inject a generated service.** Each domain has a gateway in `core/<domain>/` —
`core/users/users-gateway.ts`, `core/boms/boms-gateway.ts` and `bom-report-gateway.ts`,
`core/identity/auth-gateway.ts`, … — that wraps the generated service and maps its all-optional
response types to `App*` interfaces (`AppUser`, `AppBom`, …) with every field present. Features
consume the `App*` types; they may import request DTOs and enums from `api/model`. A new endpoint
means a gateway method (and its spec), not a feature-level `HttpClient` call.

**Server errors map per feature.** Each feature with a form has a `server-errors.ts`
(`features/materials/server-errors.ts` is the shape): it narrows the error with
`toProblemDetails` from `core/http/problem-details.ts`, **branches on `type`** (the `PROBLEM`
vocabulary), never on `detail`, and returns signal-forms `ValidationError`s bound to the offending
field (`kind: 'server'`) or the form root. 403 is matched by status (the contract's 403 has no
`type`). Every message is written client-side in Persian; nothing echoes the API's text.

**Authentication is not generated.** The `bearer` scheme is `accessTokenInterceptor`, registered via
`provideHttpClient(withInterceptors([...]))` in `app.config.ts` — see [Authentication](#authentication).

### File downloads

**The Excel exports are built by the API.** The report gateways call the `…/report/export`
endpoints with `{ observe: 'response' }` (the generated client already asks for a `blob`), and
`core/files/downloaded-file.ts` names the file from `Content-Disposition` (`content-disposition.ts`
decodes `filename*`). No spreadsheet library here, and none should come back.
`core/files/file-saver.ts` saves via a clicked `<a download>` on an object URL — keep it: a real
`download` event is what an automated browser can capture. Page specs substitute `FileSaver`; its
own spec stubs `URL.createObjectURL`, which jsdom lacks.

### Production image

`Dockerfile.prod` builds the app and serves `dist/cablan-frontend/browser/` from
`nginx:1.27-alpine`, which also reverse-proxies `/api/**` to `API_PROXY_TARGET` from one `server`
block (`nginx/default.conf.template`, rendered by the image's own `envsubst` entrypoint) — the same
single-origin trick as the dev proxy, so still no `environment.ts` and no CORS. In production
`API_PROXY_TARGET` is whatever reaches the backend from where the image runs, set at run time (it
defaults to `http://backend:3000` only so the image starts). `npm ci` runs none of the `pre*` hooks,
so the build stage calls `npm run generate:api` explicitly. `make build-prod`, `make prod-up`
(:8080), `make prod-down`; none touch the dev/test stacks.

### Testing

Test the code that _calls_ the generated client, not the client. In `TestBed`, provide
`provideHttpClient()` **and** `provideHttpClientTesting()` and assert through
`HttpTestingController`. Zoneless: never `fixture.detectChanges()` — act, `await
fixture.whenStable()`, assert (`src/app/app.spec.ts`).

**There is no `vitest.config.ts`, and one would be ignored**: `angular.json`'s `test` target is
`@angular/build:unit-test` with no options (`runnerConfig` defaults to `false`), giving Vitest on
jsdom. Runner settings go in `angular.json`.

**Import `describe`/`it`/`expect`/… from `vitest` explicitly** — `tsconfig.spec.json` has
`"types": []`. With `vitest/globals`, WebStorm resolves `it`'s type to `{}` (though `tsc` is clean);
don't reintroduce it.

## Directory layout

```
src/
  styles.scss, styles/         global stylesheet and its nine partials — see The design system
  app/
    app.ts, app.html, app.scss skip link, <app-shell> around <main><router-outlet>, the route live region
    app.config.ts              providers — router, HTTP + interceptor, Persian paginator, Jalali adapter
    app.routes.ts              the route table
    core/        singletons and cross-cutting concerns — no UI
      http/        accessTokenInterceptor, SKIP_AUTH / anonymous() (auth-context.ts), problem-details
      identity/    SessionStore, CurrentUserStore, AuthGateway, authGuard, guardedRoute, navigation,
                   permissions, testing/ helpers
      date/        Jalali formatting, the date-range form schema
      files/       downloads (FileSaver, Content-Disposition)
      forms/       shared signal-form validators (positiveNumber)
      i18n/        Persian numerals, search normalizer, approval/role/active labels
      material/    Material providers: Jalali date adapter, Persian paginator and datepicker intl
      users/ materials/ components/ products/ boms/ standard-boms/ bom-dashboard/ audit-log/
                   one gateway per domain (plus material-weight-edit.ts in bom-dashboard/)
    features/    routed pages, lazy, one folder per page group: page, dialogs, and `server-errors.ts` where it has a form
    ui/          presentational, route-agnostic components — reach for one before writing markup
    api/         GENERATED. Off-limits.
```

`features/`: `home`, `login`, `not-found`, `boms`, `standard-boms`, `products`, `materials`,
`components`, `users`, `audit-log`, `bom-dashboard`. This mirrors the backend's
`framework/` vs `modules/<domain>/` vocabulary.

`ui/`: `app-shell` (the visible shell — toolbar, breadcrumb, drawer), and the list-page kit — every
list page is `app-page-header` + `app-data-sheet` (search via `app-table-search`,
`app-filter-button`s, `app-active-filters`, the table, `app-error-banner` / `app-empty-state`, the
paginator); every dialog is `app-dialog-head` (or `app-confirm-head`) + content + `.dialog-footer`.
Also: `app-stat-tile`, `app-status-badge`, `app-type-tag`, `app-category-icon`,
`app-conductor-colours`, `app-copy-id-button`, `app-weight-difference` (a line's deviation from
standard as an arrow-and-colour pill: above red and up, below green and down), the fields
`app-jalali-datetime-field`, `app-date-range-presets`, `app-searchable-select`,
`app-password-visibility-toggle`, the Excel-style column filter `app-checkbox-filter-list` /
`CheckboxFilterDialog` (options are value/label pairs, so a technical value shows in Persian and
comes back as itself), the `persianNumber` pipe, and the `appStackedTable` directive.

**Filter chips are one per value.** `ui/active-filters/active-filter-chips.ts`:
`multiValueFilterChips` builds «برند: کابلان» and «برند: لگراند» as separate removable chips;
`withoutFilterValue` drops one value (the last one going lifts the filter, `undefined`). A field set
to `[]` (every box unticked) matches nothing and keeps a single «هیچ‌کدام» chip, or it could not be
seen or lifted. `/boms`, `/standard-boms` and `/audit-log` share it.

**Stylesheets are external `.scss`** (Material theming is Sass-only; inline `styles:` is an ESLint
error). **Specs are co-located** (`foo.spec.ts` beside `foo.ts`; `tsconfig.spec.json` includes
them, `tsconfig.app.json` excludes them).

Two things the shell needs from a new page:

- **Every route declares a `title`.** `App` writes it into a `<p role="status">` live region — the
  only way a screen reader learns the page changed. A missing `title` regresses silently.
- **Query parameters arrive as `input()` signals** (`withComponentInputBinding()`). They are not
  bound at construction, so a value derived from one needs `linkedSignal`, not `signal`.

## Authentication

`POST /api/auth/login` returns a bearer token in a JSON body; `AuthGateway` (`core/identity/`)
logs in and out, `features/login` is the page.

- **`SessionStore` keeps the token in `localStorage`** (keys in
  `core/identity/access-token-storage-key.ts`). The trade-off is real: any script on this origin can
  read it, so an XSS anywhere is account takeover; what it buys is a session surviving reloads and
  tabs. **If the API ever sets an `httpOnly`, `SameSite=Strict` cookie, delete the class outright.**
  It reads `localStorage` in a field initialiser (not SSR-safe; specs need `localStorage.clear()` in
  `beforeEach`) and registers no `storage` listener, so logging out in one tab leaves others in.
- **`accessTokenInterceptor` attaches it** to every `/api/**` request not marked `SKIP_AUTH`. The
  opt-out is an `HttpContextToken` set **at the call site** (`{ context: anonymous() }`, as
  `AuthGateway.login` does), never a URL list in the interceptor, which would re-encode route
  knowledge the generated client owns.
- **No live session means `/login`, from every URL — never not-found, never "no access"** — so an
  outsider can't probe which pages exist. `authGuard` sits on every `guardedRoute` **and** on the
  `notFoundRoute()` catch-all (`core/identity/guarded-route.ts`); only `/login` is unguarded. "No
  session" is any of:
  - **no token**;
  - **an expired one, judged on the browser's clock only.** Comparing the server-clock `exp` with
    `Date.now()` logged out anyone whose clock ran fast. So `SessionStore` records `Date.now()` at
    `store()` (persisted under the second key), reads the lifetime as `exp - iat` with `jwt-decode`,
    and drops the token once that much local time has passed. `discardIfExpired()` runs on
    construction, on every navigation (guard) and every API call (interceptor). **A token it cannot
    judge counts as expired** (not a JWT, bad `iat`/`exp`, no receipt time);
  - **one the API rejects** — the guard puts any other token to `GET /api/users/me` (via
    `CurrentUserStore.load()`, which the role check needs anyway) before anything renders.
- **Any 401 ends the session**: the interceptor clears the token, closes open dialogs (their overlay
  outlives navigation) and redirects to `/login?returnUrl=…`, which the login page follows after
  success. Three deliberate exceptions: `SKIP_AUTH` requests (a failed login shows its own error), a
  token stored while the rejected request was in flight (kept), and mid-navigation (left to the
  guard, since `router.url` still names the page being left).
- **`authGuard` is UX, not security** — the route table ships in the bundle; the API enforces.
- **`CurrentUserStore` caches per token**, dropping its user as soon as the session's token differs
  from the one it fetched with (expiry or rejection end sessions without calling `clear()`).

**Spec helpers.** `core/identity/testing/fake-access-token.ts`: `fakeAccessToken()` is a live
one-hour JWT (`{ subject }`, `{ lifetimeSeconds, issuedAt }`), `unsignedJwt(payload)` a malformed
one. **A bare string like `'a-valid-token'` is discarded on first use** — no `iat`/`exp`. Expire a
session by storing a token then `moveClock(seconds)` (`core/identity/testing/clock.ts`; fakes `Date`
only — pair with `vi.useRealTimers()` in `afterEach`). `app.routes.spec.ts` pins "every URL looks
the same to an outsider".

## Authorization

The token carries no role claim (so a demotion applies at once), so `CurrentUserStore` fetches
`GET /api/users/me` once per session and every UI decision reads `role()` off it. Two tables in
`core/identity/` hold the rules; neither is a security boundary (the API's `RolesGuard` is).

- **`navigation.ts` decides which _pages_ a role may reach.** `NAVIGATION` is a tree of categories
  and pages, roles on pages only; a category shows when one of its pages is reachable. Four
  consumers read it, so none can drift: the drawer and the home page (`navigationFor`; home's level
  lives in `?category=`), the toolbar breadcrumb in `ui/app-shell` (`breadcrumbFor`, built from
  `trailTo` / `categoryTrail`, reading the same `?category=`), and `app.routes.ts` (`guardedRoute` →
  `canReach`). Home sits outside the tree; the toolbar brand links there. For a signed-in user a
  withheld route renders not-found **in place** rather than redirecting — a redirect would prove the
  page exists.
- **`permissions.ts` decides which _actions_ a role may take on a page it reaches.** Both BOM pages
  are readable and exportable by everyone; the role decides only whether افزودن/ویرایش/حذف are
  offered. Matching the backend's `@Roles()`: `canManageBoms` admits بازرس کنترل کیفیت، مدیریت، مدیر
  سیستم; `canManageStandardBoms` only the latter two. `canApproveBoms` (مدیریت، مدیر سیستم) decides
  who approves, rejects and corrects weights on the dashboard — same roles as
  `canManageStandardBoms` today, kept separate so neither moves with the other.

A page computes `canManage()` and passes it to its detail dialog as data, so card and row hide the
same buttons. **Dialogs still map a 403 to an access-denied message** — a role can change
mid-session. A page spec seeds the role the way `guardedRoute` does: `SessionStore.store(…)`, then
`CurrentUserStore.load()` with `GET /api/users/me` flushed, then create the component
(`boms-page.spec.ts`, `app-shell.spec.ts`).

## Daily-BOM approval

Management and System Admin review daily BOMs on the dashboard — approve or reject, once; only an
edit sends a reviewed one back to pending (there is no revoke). The report and the dashboard both
show the result.

- **One vocabulary, `core/i18n/approval-labels.ts`**: `approvalStatusLabel` (`pending` «در انتظار
  تایید», `approved` «تایید», `rejected` «عدم تایید»), `reviewerLabel` (the name, or `NO_REVIEWER` —
  a plain hyphen `-`, not the em dash other missing values use, so report, dashboard, export and
  audit log read alike), `NO_MANAGEMENT_NOTE` (the same hyphen). The reviewer is labelled «تایید/رد
  کننده» everywhere; the management note («توضیحات مدیریت») is a rejection's reason or the reviewer's
  own edits noted on approval, one line each — render it with `white-space: pre-line`.
- **Each analysis is `app-daily-bom-card`** (`features/bom-dashboard/daily-bom-card.ts`): the header
  names it (order number, time, operator, status, reviewer); the body holds the description, the
  management note when there is one, the lines table — component, material, `standardWeight`, the
  `difference` as an `app-weight-difference` pill (none when zero), the actual weight — and, for
  `canApproveBoms` only, a pencil per line and, **while pending only**, «تایید» and «عدم تایید». The
  buttons live in the body because the expansion header is itself a button; each is told apart from
  other cards' by `aria-describedby` → the card's order number.
- **«عدم تایید» opens `DailyBomRejectionDialog`**, which sends `POST /boms/:id/rejection` with
  `{ reason }`. «دلیل عدم تایید» is required and a run of spaces counts as blank, like the API's
  `rejection-reason-required`, which is shown on the same field; the submit button is named «عدم
  تایید» too (the page behind is `aria-hidden` while it is open). It closes with a
  `DailyBomRejectionOutcome`: `'rejected'` on success, `'already-reviewed'` on a 409 (below); other
  refusals show a banner in the dialog (`features/bom-dashboard/server-errors.ts`).
- **A review of a non-pending BOM answers 409 `bom-already-reviewed`** — someone got there first.
  For approve and reject alike the card says so (`ALREADY_REVIEWED`) and re-reads anyway, so the
  list shows who.
- **The description has its own pencil** («ویرایش توضیحات», `canApproveBoms` only), opening
  `DailyBomDescriptionDialog`, which sends `PATCH /boms/:id` with `{ description }` alone (`''`
  clears it), closes with `true` on success and stays open with a snackbar on failure.
- **Every write re-reads; nothing patches the card.** A review changes what the filters let through,
  and a weight correction moves the score and sends a reviewed BOM back to pending, so the card
  emits `changed` and the page reloads; cards stay on screen under a slim progress bar
  (`rxResource` status `reloading`).
- **Focus survives the reload**: the card remembers the pencil, or — after a review, whose buttons
  vanish — its expansion header, and focuses it once the new `bom` input has rendered.
- **The inline weight edit sends the whole composition** — `PATCH /boms/:id` replaces `components`
  wholesale, so `core/bom-dashboard/material-weight-edit.ts` rebuilds it from the card's lines,
  grouped by component, plus `standardBomMiCode`. `bom-composition-entry-not-found` gets its own
  message.
- **Reviewer filters (`reviewers`) carry a blank option, «بدون تایید/رد کننده» (value `''`).** A
  pending BOM matches no named reviewer; without it, ticking every listed reviewer collapses to "no
  filter" under the checkbox dialog's all-checked rule and still shows pending rows. The report adds
  it while `filter-options` lists a pending status and sends `''` as given; the dashboard does the
  same (`features/bom-dashboard/approval-filters.ts`). A reviewer matches their approvals and
  rejections alike.
- **The dashboard's approval filters narrow the whole dashboard, server-side.** «وضعیت تایید» (pending,
  approved, rejected, in that order) and «تایید/رد کننده» sit in a `role="group"` named «فیلتر
  تایید» beside the date range, take their values
  from the report's `filter-options`, and go out on both `POST /boms/dashboard` and the selected
  product's `…/daily-boms` (`BomDashboardGateway`, `AppBomDashboardFilters`). A dialog's «اعمال»
  applies at once. A product the filters or range drop from the list has its panel closed for good
  (it does not reopen if the product returns).
- **«وضعیت تایید» opens on «در انتظار تایید»**, dashboard only (`DEFAULT_DASHBOARD_APPROVAL_FILTERS` in
  `approval-filters.ts`; the `/boms` report opens unfiltered). It is a plain filter value — sent on
  both requests, ticked in the dialog, counted on the button — held in the page component so every
  visit resets it; never move it to a service, the URL or storage. Until the visitor applies
  «وضعیت تایید» themselves, a reviewer filter without «بدون تایید/رد کننده» lifts it (`withReviewers`:
  a pending BOM has no reviewer, so the two together would match nothing); statuses they chose stay.
  «پاک کردن فیلترها» lifts it too
  (all approval filters, i.e. everything). Because of it, a card's write re-reads **both** lists, so
  a reviewed BOM leaves the panel and its product leaves the list when nothing pending remains;
  the product list's progress bar shows only on a first load (`status() === 'loading'`), not on that
  re-read, and focus lost with a dropped card goes to the panel heading, else the first product.
- **The audit log names review events in the same words** (`features/audit-log/action-labels.ts`,
  `field-labels.ts`): `Approved` «تایید», `Rejected` «عدم تایید», `ReturnedToPending` «بازگشت به در
  انتظار تایید»; fields `reviewedBy` «تایید/رد کننده» and `managementNote` «توضیحات مدیریت» (empty →
  `-`); a weight-only edit's `materialWeight:<component>:<material>` line reads «وزن جز {component}
  مواد اولیه {material}». Entries from before the review keep reading: `ApprovalRevoked` «لغو تایید»,
  field `approvedBy` as «تایید/رد کننده», status `unapproved` as «در انتظار تایید».

## Accessibility

**It MUST pass all AXE checks and follow all WCAG AA minimums, including focus management, colour
contrast and ARIA attributes.** Gated, not aspirational — by `make lint-accessibility`, by
`make lint`, and by you.

### `make lint-accessibility` — the browser gate

Playwright runs everything in `a11y/` (`testDir`) against the dev server in headless Chromium:

| Path                              |                                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| `a11y/accessibility.spec.ts`      | axe over every route: `wcag2a/2aa/21a/21aa/22aa` (see `wcagAaTags` for why) |
| `a11y/design-tokens.spec.ts`      | every colour in `design/tokens.json` vs the painted theme, both schemes     |
| `a11y/design-foundations.spec.ts` | type tokens, control shape, density, page columns — computed styles         |
| `playwright.config.ts`            | runner config; `baseURL` from `A11Y_BASE_URL`, set by Compose               |
| `Dockerfile.a11y`                 | the gate's image — the dev Node base plus Chromium                          |
| `tsconfig.a11y.json`              | so the editor and `tsc` see `a11y/`; lists the `src/` modules it imports    |
| `a11y/report/`, `a11y/.output/`   | **generated**, gitignored, root-owned; CI uploads the report as an artifact |

It is a browser rather than Vitest because jsdom has no layout or cascade: axe's `color-contrast`
can only return _incomplete_ there, and `light-dark()` can't be resolved. Don't move it into a unit
test.

**Every route is audited per colour scheme** (`colourSchemes`, `page.emulateMedia`), both named
explicitly so Chromium's default can't silently decide which half is covered. The usual failure is a
`--mat-sys-*-fixed` token — it does not change between schemes, so its text stays dark on dark.
**And again at phone width** (375×812, both schemes), where it also fails on any sideways scroll in
any scroll container (see [Phones](#phones)) — the only place the stacked tables are graded.

**When you add a page, add its route to `publicRoutes` or `authenticatedRoutes`** — a page in
neither is unchecked. Every route but `/login` is guarded, so the authenticated block seeds a
session and **stubs every API call the audited pages make** with `page.route` (fulfilled in the
browser, so no backend or database is needed). **A new authenticated page must have its endpoints
stubbed there too** — otherwise it audits an error state. The seeding is via `page.addInitScript`
(before any page script — `SessionStore` reads on construction), with a `fakeAccessToken()` and a
receipt time of the browser's `Date.now()`, or the store discards it and every route quietly audits
the login page. The keys and token are imported from `core/identity/` modules kept dependency-free
for exactly this. This proves each page's _markup_, not any real payload; a form's **error state is
not reachable by `goto`** and is left to the manual pass.

**The audit waits for the DOM to go quiet** (`waitForRenderToSettle`): zoneless Angular writes
bindings like `<label for>` a pass after creating elements, and axe landing in between flaked
`/boms` ~1 run in 40. `Testability` can't answer "settled" without a zone.

`make lint-accessibility` starts the dev server itself and leaves it running (`make down` after).
The `a11y` service shares the app's network namespace (`network_mode: service:app`) and uses
**`http://localhost:4200`** — not `http://app:4200`, which Chromium HSTS-upgrades (`.app` is a
preloaded TLD; you get a misleading `ERR_SSL_PROTOCOL_ERROR`) and Vite's `allowedHosts` 403s. The
image is the dev Node base plus `npx playwright install --with-deps chromium`, **not**
`mcr.microsoft.com/playwright` — one browser, and no image tag to keep in step with `package.json`.
It sits behind a Compose profile so `make up` ignores it. A `403 … not available in your location`
on build is Playwright's geo-blocked CDN: set `PLAYWRIGHT_DOWNLOAD_HOST` (see
`docs/environment-troubleshooting.md`).

### `make lint` — the static layer

`eslint.config.js` extends `angular.configs.templateAccessibility` and adds `no-positive-tabindex`
and `button-has-type`. `lintFilePatterns` covers `src/**/*.ts`, `src/**/*.html` **and
`a11y/**/*.ts`**; the generated client is excluded on purpose.

### The part no tool checks

Automated rules catch roughly a third of WCAG failures, and **focus management is mostly in the
rest**. For any UI with state, check by hand in the browser review that `frontend-design` ends in:

- Opening a dialog, menu or drawer moves focus into it; closing returns it to the trigger.
- While a modal is open, Tab is trapped and Escape closes it.
- Focus is visible everywhere — never `outline: none` without a `:focus-visible` replacement at 3:1.
- Tab order is DOM order; no CSS reordering that walks the keyboard sideways.
- A `novalidate` form still renders its accessible errors on submit (jsdom can't show this).
- A skip link precedes repeated navigation.
- Async page changes announce themselves (a live region); errors move focus to the first invalid
  field.

**Never trigger `alert`, `confirm` or `prompt` while driving the page** — a modal dialog blocks the
Chrome extension for the rest of the session. A green gate means no _detectable_ violation: a floor,
not a pass mark.

## Editor / host node_modules

Nothing runs from a host `node_modules`; the editor needs one, synced with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci` (never `npm install`). Real dependency changes happen in
the container (`make sh` → `npm install`). Details: `docs/environment-troubleshooting.md`.

## Angular & TypeScript rules

The `angular-developer` skill has the detail; these are the rules this project holds to.

- **Zoneless because Angular 21 defaults to it** — no `provideZonelessChangeDetection()`, no
  `zone.js`, no `polyfills` entry, and all three absences are correct. Don't "fix" them.
- Standalone components without `standalone: true`; `ChangeDetectionStrategy.OnPush` on every
  component; `input()`/`output()`, not decorators; host bindings in the `host` object, never
  `@HostBinding`/`@HostListener`; `inject()`, not constructor injection; `providedIn: 'root'` for
  singletons; lazy feature routes.
- Signals for state, `computed()` for derived state, `set`/`update` (never `mutate`). Strict types;
  `unknown`, not `any`.
- **Bridge Observables into signals, not the async pipe**: `toSignal` for a stream you just read
  (`app.ts`), `rxResource` for a request whose loading/error states the template needs. There is no
  `AsyncPipe` in the codebase; don't add the first.
- Native control flow (`@if`, `@for`, `@switch`); `class`/`[style.x]` bindings, never
  `ngClass`/`ngStyle` or a `style="…"` attribute. Inline templates are fine for small components;
  inline styles never are. External file paths relative to the component.
- Reach for a `mat-*` component before building one — a custom version of something Material ships
  is a violation. Images use `NgOptimizedImage` (`ngSrc`), as the login page's logo does.
- **Signal Forms** (`@angular/forms/signals`) for every form — never `FormControl`/`FormGroup`/
  `FormArray`/`FormBuilder`. Read `references/signal-forms.md`. The control is
  `<mat-form-field appearance="outline">` with `matInput`. Four traps:
  - **`<form novalidate>` is mandatory.** `[formField]` writes real `required`/`minlength`
    attributes, so without it the browser's validation swallows `submit` and the accessible error
    region never renders. **jsdom does not reproduce this** — specs stay green on a broken page.
  - The directive selector is **`[formField]`**, not `[field]`.
  - **`f.email` is the field; `f.email()` is its state** — `f.email().errors()`, in templates too.
  - **Never `null` or `undefined` as an initial value.** Use `''`, `0`, `[]`.

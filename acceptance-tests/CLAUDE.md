# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Black-box BDD acceptance suite (Cucumber + Serenity/JS + TypeScript) for the sibling `../backend`
and `../frontend` projects, written with the **Screenplay Pattern**.

**Skills.** `handbook:screenplay-guideline` is the authority on this suite's structure and anti-patterns (with `handbook:test-guideline` for black-box test design) — invoke it before writing automation.

The suite reaches the system two ways and no others: **HTTP to the backend**, and **a browser
pointed at the frontend**. No importing code from either project, no direct database access —
preconditions that can't be set up through one of those two doors don't get set up.

It runs against both projects' **test stacks** — separate Compose projects with their own
databases, so a run can never touch anything a developer is working in:

| Stack               | Compose project     | Port     |                                              |
| ------------------- | ------------------- | -------- | -------------------------------------------- |
| backend **test**    | `cablan-backend-test`  | **3001** | `NODE_ENV=test`, own database                |
| frontend **test**   | `cablan-frontend-test` | **4201** | proxies `/api` to the backend test stack      |

Not the dev stacks on 3000/4200. The testing endpoints this suite depends on
(`POST /api/testing/migrations`, `/truncate`, `/clock/reset` and `/clock/advance`, plus
`GET /api/testing/emails`) mount only at `NODE_ENV === 'test'`, so they simply don't exist on
3000 — and a run can never truncate dev data. The frontend has no such switch; what keeps it honest
is `API_PROXY_TARGET`, which points 4201 at 3001 and 4200 at 3000.

Start them with `make -C ../backend test-up` and `make -C ../frontend test-up`, or let the root
`make run-acceptance-tests` do the whole sequence: both test stacks up, this container up, suite run.

## Which door a step goes through

The suite is **blended** (BDD in Action, ch15): the browser where the browser is the point, HTTP
everywhere else — ch10 lists four reasons to reach for a UI test, and ch10 also puts UI tests at
"a small minority" of an acceptance suite as the norm.

**This repository is between suites right now.** The old NMK-era suite (self-service sign-up,
login, forgot/reset password) has been deleted along with its automation, and the 13 Cablan feature
files under `specs/` (audit-logging, authentication, bom-registration, bom-reporting) have **no
automation yet** — every one of their steps is currently `UNDEFINED`, and `npm test` fails outright
until step definitions exist (`strict: false` tolerates `PENDING`, not `UNDEFINED` — see below).
There is no door table to record yet. When automation is written, map each scenario's door here,
deliberately, the same way the old suite did — and keep the table current as scenarios are added.

**Grammatical voice is the signal**, and this still holds regardless of which suite it's applied
to: a passive `Given` (`Given a component is already registered`) means the precondition just needs
to be *true*, so it takes the API; an active `When` (`When یاشار registers a new employee`) means
the scenario is demonstrating *how*, so it drives the browser. Cucumber matches the two voices with
different expressions, so the split happens at the step-definition level with nothing to configure.
It's a signal, not a law — a backend rule with no screen as the point stays on the API door even
when phrased actively (the old suite's password-reset request was the worked example of this; watch
for the same pattern in the new domain, e.g. a validation rule phrased as an active step).

**The feature file should know nothing about any of this.** No `@ui`/`@api` tags, no Cucumber
profiles — that would put an automation concern into a document written for the business.

## Commands

Runs in Docker via the Makefile. Prerequisites: Docker, Docker Compose, `make`, and **both test
stacks running** — `make run` drives a browser at the frontend on 4201, so a suite run against the
backend alone now fails rather than merely covering less. The root `make run-acceptance-tests`
starts both in the right order.

```bash
make up                  # build (if needed) and start this container in the background
make down                # stop and remove the container
make restart             # down, then up
make build               # rebuild the image
make ps                  # container status
make sh                  # open a shell in the container
make run                 # run the full acceptance suite
make render-living-documentation   # render the living documentation from the last run
make open-living-documentation     # render it, then open it in the browser
make npm <script>        # run any package.json script inside the container
make help                # list all available make targets
```

Code-quality checks. The bare targets are read-only; the `fix-` ones write:

```bash
make lint                # ESLint check (read-only, no changes)
make fix-lint            # ESLint + auto-fix
make format              # Prettier check (read-only, no changes)
make fix-format          # Prettier auto-format
```

These need nothing running — each starts a throwaway container (`docker compose run --rm`). The
`fix-` ones still write to the working tree, since the repo is bind-mounted into the container.

Two things to know about their reach. They cover **only** `screenplay/`, `step-definitions/` and
`support/` — `cucumber.cjs`, the configs, and every `.feature` file are neither linted nor
formatted. And ESLint runs Prettier as a rule here, so `make fix-lint` already reformats and
`make fix-format` is a cheap re-check. `.prettierrc` sets no `printWidth`, so this project wraps at
80 columns — narrower than the frontend's. Code pasted from there will be reflowed.

Make targets are verb-object and hyphenated (`fix-format`); the package.json scripts they
wrap keep the colon (`format:fix`). Prefer the targets over `make npm <script>` — because
`lint` and `format` are now real targets, `make npm lint` runs the linter twice (once
through the passthrough, once as a second goal).

From a shell inside the container (`make sh`):

```bash
npm test                                                          # cucumber-js --tags 'not @wip'
npx cucumber-js specs/authentication/logging-in.feature           # one feature file
npx cucumber-js specs/authentication/logging-in.feature:7         # one scenario, by line number
npx cucumber-js --tags '@wip'                                     # only @wip scenarios
npx cucumber-js --dry-run --format summary                        # resolve every step without running it
npx tsc --noEmit                                                  # typecheck
```

`--dry-run` is the cheapest way to prove a new step definition is neither missing nor ambiguous: it
matches every step and runs none of them, so it needs no stack up. Right now `--dry-run` is also the
cheapest way to see how far from `UNDEFINED` the current specs are, since none of them have step
definitions yet.

`npm test` is `node --env-file=.env … cucumber-js`, and that flag is load-bearing: **it fails
outright if `.env` is missing**, since Node exits on an unreadable `--env-file`. The `npx` forms
above skip it and work anyway, because Compose supplies the same variables through `env_file` — so
they only work *inside* the container.

`tsconfig.json` lists `"dom"` in `lib` even though this is a Node process. That is correct and
needed: Playwright's types describe browser APIs. The reason is in a comment there; don't tidy it
away.

### Pending scenarios, and what `@wip` actually means

Two different things can be unfinished about a scenario, and they are marked differently. Getting
this backwards either publishes a rule nobody signed off, or hides agreed behaviour from the
documentation:

| State | Marker | In the living documentation? |
| ----- | ------ | ---------------------------- |
| The **business** hasn't settled it — wording or the rule itself still under discussion | `@wip` | **No.** `npm test` filters it out with `--tags 'not @wip'`, deliberately: unagreed behaviour must not be published as a description of the system. |
| Agreed by the business, **not automated yet** | **no tag**; step definitions that `return 'pending'` | **Yes**, as Pending. This is the default for specification written ahead of implementation. |
| Agreed and automated | no tag; real step definitions | Yes, as Passing. |

"Not automated yet" is **not** a reason to reach for `@wip`, and removing the tag is a business
decision rather than an engineering one.

**Right now every one of the 13 Cablan feature files is fully agreed Gherkin with zero automation**
— none of them carry `@wip`, and none of their steps yet `return 'pending'` either, because no step
definitions exist at all. That's a third state the table above doesn't cover: `UNDEFINED`, which
Cucumber fails on unconditionally regardless of `strict`. The first pass of automation for each
scenario should land its steps as either real implementations or explicit `return 'pending'` ones —
never leave a scenario `UNDEFINED` on `main`.

Three things to know when writing that automation:

- **`strict: false` in `cucumber.cjs` is what keeps a run green once steps exist.** Cucumber fails on
  an `UNDEFINED` step *unconditionally* — only `PENDING` is governed by `strict`. So a *missing* step
  definition still breaks the build, as do ambiguous and failing ones; nothing but an explicit
  `return 'pending'` is tolerated. **Watch the exit code, not the summary**: Serenity maps
  `UNDEFINED` and `PENDING` to the same `ImplementationPending` outcome, so a forgotten definition
  still prints as "pending" in the console summary and in the report. Only the non-zero exit
  distinguishes it.
- **Don't redefine a step another feature already implements.** A second definition is ambiguous,
  which fails whatever `strict` says. Background steps are the likeliest place this bites, since
  they tend to be shared across feature areas by design — e.g. multiple scenarios across
  `authentication` and `bom-registration` giving `Given` a component is already registered. Leave a
  comment where the redefinition would have gone, and let `npx cucumber-js --dry-run` prove there is
  exactly one match.
- **Arity must match the captured parameters**, or Cucumber rejects the definition. Name the unused
  ones `_actor`, `_password` — ESLint's `argsIgnorePattern` is `^_`.

## Architecture

```
specs/                                  # Gherkin. Organised by feature area, not by backend module
├── audit-logging/viewing-audit-log.feature
├── authentication/logging-in.feature
├── authentication/registring-employee.feature
├── bom-registration/registring-{bom,component,material,product,standard-bom}.feature
└── bom-reporting/{exporting-bom,exporting-standard-bom,marking-standard-bom-availability,
                    reporting-bom,reporting-standard-bom}.feature
step-definitions/                       # Thin: each step just delegates to a task. None yet.
screenplay/                             # DOMAIN layer: what an actor does, in business language
└── common/                             # Reusable across feature areas
    ├── clock.ts                        # LetTimePass (advance the backend's test clock); FreezeTimeAt — no call site
    └── problem-detail.ts               # EnsureProblemDetail, EnsureValidationErrorFor, FieldsThatFailedValidation, problemTypeFor
# No screenplay/ui/ yet — see "Lean Page Objects" below for why, and what to do about it.
support/
├── actors.ts                           # Cast: assigns abilities (CallAnApi, BrowseTheWebWithPlaywright, TakeNotes) to every actor
├── config.ts                           # apiBaseUrl (trailing-slash normalised — see Gotchas), appBaseUrl
├── parameter-types.ts                  # Cucumber parameter types: {actor} {actorName} {pronoun}
└── hooks.ts                            # BeforeAll / Before / After / AfterAll: Serenity config, browser, DB reset, cast
cucumber.cjs                            # loads support/ + step-definitions/ via ts-node
```

There is deliberately no `screenplay/<feature-area>/` directory yet, no `screenplay/common/notes.ts`
or `inbox.ts`, and no `screenplay/ui/` at all — all of that belonged to the deleted NMK-era
self-service auth suite (sign-up, login, forgot/reset password, profile) and was typed, or in
`ui/form.ts`'s case markup-anchored, entirely around its payloads and pages. The first Cablan
automation pass adds a `screenplay/<feature-area>/` directory per feature the same way that suite
did, following the pattern below, and a fresh `screenplay/ui/` once the frontend has real markup to
locate elements in.

`LetTimePass` is how a scenario moves time: it posts to `testing/clock/advance` through `CallAnApi`,
so it reads in the living documentation as something the actor did. `FreezeTimeAt` beside it still
has **no call site** — wire it up when a scenario needs to start from a specific instant, or delete
it; don't assume it is exercised. The default frozen instant every scenario starts from is set by
`support/hooks.ts` with a raw `fetch`.

The three layers of `handbook:screenplay-guideline` map onto that tree: `specs/` is the
**Specification** layer, `screenplay/` minus `ui/` is the **Domain** layer, and `screenplay/ui/`
plus `support/` is the **Integration** layer. A layer depends only on itself or the one directly
below. In particular a step definition never touches `screenplay/ui/` — if a UI-driving task needs a
Lean Page Object that doesn't exist yet, that's the first thing to add, not something to work around
from the step definition.

### Lean Page Objects (none exist yet)

There is no `screenplay/ui/` directory right now. The old suite's `form.ts` was deleted along with
the rest of the NMK-era automation because it hardcoded that design's markup — a `form
app-text-field` wrapper and a `.field__error` class from the single shared form-field component the
old frontend rendered every field through. Neither exists any more: `ui/text-field/` was deleted
with the rest of the old frontend design, and Cablan's own form markup hasn't been built yet. A Lean
Page Object written against the old classes would silently locate nothing once real pages exist —
worse than having none.

**When the frontend has real pages to point at, write `screenplay/ui/` fresh, following this
contract**: `screenplay/ui/` **locates elements and reports what they say. Nothing else** — no
assertions, no tasks, no driver. Behaviour lives in the tasks that use them. Elements should be
found by what a person would read — the `<label>` above an input, a button's text — because the
frontend's accessibility gate fails the build if an input loses its `<label for>`, so the label is a
contract that something else keeps honest. Reaching an accessible name still means anchoring on some
structure first (a wrapper element, a role, a class); keep those anchors few, keep them here, and
expect the frontend's actual new markup to decide what they are — not this file's git history.

### Screenplay vocabulary, as implemented here

- **Actors** are the people (or roles) named in the feature file — e.g. یاشار, مصطفی. They are
  created by `Actors` (`support/actors.ts`), Serenity's `Cast`.
- **Abilities** are what an actor *can do*. Every actor gets three: `CallAnApi` (from
  `@serenity-js/rest`), `BrowseTheWebWithPlaywright` (from `@serenity-js/playwright`) and
  `TakeNotes`. Every actor can therefore use either door, and the *task* decides which — that is
  what makes blended testing possible. **Each actor gets their own notepad and their own browser
  context**, so nothing one actor did can leak into another actor's scenario.
- **Tasks** are what an actor *does*, in business language — e.g. `RegisterEmployee`, `LogIn`.
  Assertions are tasks too, by convention named `Ensure*`.
- **Questions** are what an actor *knows* — e.g. `EnsureValidationErrorFor`'s
  `FieldsThatFailedValidation`.

**Name a task for its goal, put the route in the method name.** Where a goal is reachable more than
one way, the variants live on one class: e.g. `RegisterEmployee.using` could drive the form while
`RegisterEmployee.viaApiUsing` posts the payload. That is what lets a step swap one for another
without the feature file noticing. Don't name a task `RegisterEmployeeViaTheForm`; the goal is
registering the employee, and the form is how.

Step definitions stay thin — they translate a Gherkin line into `actor.attemptsTo(...)` and nothing
more. Logic belongs in tasks. Anything reusable across feature areas goes in `screenplay/common/`.

### Assertion conventions

**One reusable envelope check, then one distinguishing fact.** `EnsureProblemDetail(status, slug)`
(`screenplay/common/problem-detail.ts`) asserts the whole RFC 9457 envelope — `Content-Type:
application/problem+json`, `type`, `title`, `status`. Build domain-specific tasks on top of it that
add only what makes them different — `EnsureValidationErrorFor` already does this for validation
errors. `problemTypeFor` is a helper used only inside that module.

**Assert `type`, not `detail`.** `type` is always present and is the diagnostic field; `detail` is
optional per RFC 9457.

**Assert the API as it is built, not as you wish it were.** Don't assert a problem type the backend
does not emit — that turns a passing scenario into a parked pending one.

**Through the UI, assert what the visitor sees.** A UI step asserts the rendered message, the page
it stayed on, what the interface offers — never a status code or a token, which aren't things a
visitor can observe.

### Waiting, and where it belongs

**Every step that reaches into freshly rendered markup must wait for it first.** Angular bootstraps
the shell and lazy-loads each route *after* the browser's load event, so a `Click` or `Enter`
issued straight after a navigation can find nothing and fail on the spot with a
`ListItemNotFoundError`. `Wait.until` is what survives that — it treats an empty match as "not yet"
and polls (`@serenity-js/core`'s `WaitUntil` ignores `ListItemNotFoundError` explicitly, on the
grounds that "lists might get populated later").

**The wait belongs in the locate task, not in the task that follows it** — a `LocateThe...Form` task
should end by waiting for a field to be visible, so the task that fills it in can simply type. This
is not belt-and-braces: the old suite flaked exactly here before those waits existed, and only when
the frontend container was cold enough that Vite still had to compile a route's chunk on demand.

`isVisible()` is safe to wait on even when the element is absent: it is `and(isPresent(), …)`, and
`and` short-circuits, so a conditionally rendered banner polls rather than erroring.

**Submitting a form means clicking *and waiting for the answer*.** A submit task should poll until
the site has had its say — the visitor has either been taken somewhere else or told what was wrong —
because a person doesn't walk away from a form mid-request. This is not defensive coding: the old
suite's login journey had a genuine bug fixed by exactly this wait — without it, a clock advance and
a re-navigation could race a login request still in flight. Check git history from before this suite
was deleted if the worked example is ever needed again.

### Living documentation

Two phases:

1. `make run` — the `@serenity-js/serenity-bdd` crew member writes one raw JSON file per scenario,
   into the directory `ArtifactArchiver` is configured with in `support/hooks.ts`
   (`target/site/serenity/`), and `Photographer.whoWill(TakePhotosOfFailures)` drops a PNG
   beside it whenever a UI step fails. Failures only: a photo per step would swamp the report, and
   a failed UI step can name the element it wanted but not show you the page it was looking at.
2. `make render-living-documentation` — shells out to the Serenity BDD **Java** CLI to aggregate those into a browsable HTML site at `target/site/serenity/index.html`. This is why the Dockerfile installs `default-jre-headless`. It renders whatever the last run produced; it does not run any tests.

`target/` is bind-mounted, so the living documentation opens straight from the host. `make open-living-documentation` does phase 2 and then opens `index.html` in the default browser — the one target that runs on the host rather than in a container, because a browser cannot be launched from inside one. Like `render-living-documentation`, it needs the container up.

Artifacts **accumulate** across runs — if the counts look wrong, or a fixed failure's screenshot is
still sitting there, clear it out and re-run. The files are written by the container as root, so
`docker compose exec app rm -rf target` rather than `rm -rf target` from the host.

The target is named for what it produces, not for the tool that produces it — the npm script it wraps keeps its own name (`npm run report`), the same way `lint-architecture` wraps `npm run depcruise` in the backend.

## Gotchas

**Resource URIs must be relative, with no leading slash.** Serenity's `CallAnApi` resolves them with `new URL(uri, apiBaseUrl)` — *not* axios's `combineURLs`. `new URL('/users', 'http://host/api')` discards the `/api` segment and yields `http://host/users`, so every request 404s. `support/config.ts` guarantees the base URL ends in a slash; always write `PostRequest.to('users')`, never `PostRequest.to('/users')`. Browser navigation is the opposite: `Navigate.to('/login')` resolves against the Playwright context's `baseURL`, and there the leading slash is right.

**`localhost` works because the container shares the host's network.** `docker-compose.yml` sets
`network_mode: host`, so `http://localhost:3001` and `http://localhost:4201` inside the container
reach the ports the backend and frontend test stacks published on the host. There is no shared
Docker network between the three projects, and no service-name DNS — `http://app:3001` would not
resolve. `localhost` is also the only host that works for the browser: Vite's DNS-rebinding defence
403s any `Host` it doesn't recognise, and Chromium force-upgrades `.app` to HTTPS because it is an
HSTS-preloaded TLD. Both traps are documented in `../frontend/CLAUDE.md`.

**Chromium lives in this image.** The Dockerfile installs it with
`npx playwright install --with-deps chromium`, which fetches whatever the installed `playwright`
pins — so upgrading Playwright is an ordinary dependency bump with no image tag to keep in step.
If the build dies with `403 ... this service is not available in your location`, Playwright's CDN is
geo-blocked where you are; set `PLAYWRIGHT_DOWNLOAD_HOST` in `.env` to a mirror. Same arrangement,
and the same reasoning, as `../frontend/Dockerfile.a11y`.

**After a dependency change, the long-lived container needs `--renew-anon-volumes`.** `node_modules`
is an anonymous volume, so `make up` alone will keep reusing the one built before your change and
`make run` fails with `Cannot find module '@serenity-js/...'`. `docker compose up -d
--renew-anon-volumes` fixes it. `docker compose run --rm` builds a fresh volume every time and so
never shows the problem, which is what makes this confusing — and CI never hits it at all.

**`actorCalled()` moves the spotlight.** Steps with no explicit subject resolve their actor via
`actorInTheSpotlight()`, which is whoever was named last. That is what the `{actorName}` parameter
type is for: it yields a bare name string *without* summoning the actor — useful whenever a step
names somebody who is **not** the actor currently in the spotlight, so a following `Then` doesn't
end up reading the wrong actor's (empty) last response.

The parameter types (`support/parameter-types.ts`):

| Type | Matches | Resolves to |
|------|---------|-------------|
| `{actor}` | `Ariana` | `actorCalled(name)` — creates the actor, takes the spotlight |
| `{actorName}` | `Ariana` | the plain string — no actor, no spotlight change |
| `{pronoun}` | `he`, `she`, `they` | `actorInTheSpotlight()` |

Add a new parameter type here when a feature area needs one — the old suite's `{field}` type (which
mapped sign-up field labels to payload keys) is gone with the domain it served; it is not a template
to reuse verbatim; a new one should map whatever field vocabulary the new domain actually uses.

## Environment

`.env` (copied from `.env.example` by `make setup`, which `make up` runs for you):

- `API_BASE_URL` — the backend's API base. Defaults to `http://localhost:3001/api`: the **test**
  stack, not the dev stack on 3000.
- `APP_BASE_URL` — the frontend the browser drives. Defaults to `http://localhost:4201`: again the
  **test** stack, whose `/api` proxy points at the same backend `API_BASE_URL` names. Pointing this
  at 4200 would drive a UI wired to a database this suite never truncates.
- `PLAYWRIGHT_DOWNLOAD_HOST` — build-time only, and commented out by default. See Gotchas.

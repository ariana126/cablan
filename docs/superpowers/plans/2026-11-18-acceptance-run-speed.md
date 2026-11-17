# Acceptance Run Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut every acceptance scenario's fixed cost — fewer bcrypt-bound logins, cheaper bcrypt and Postgres in the test stack, faster polling — without changing what any scenario verifies.

**Architecture:** Two independent tracks. Backend (backend-engineer): a configurable bcrypt cost guarded to production strength outside `NODE_ENV=test`, and a durability-off, tmpfs Postgres for the test stack only. Acceptance-tests (qa-engineer): a scenario-scoped memo of provisioned personas so `LogInAsPersona` stops re-running the admin login + user lookup, and one shared, faster polling interval for waits. The orchestrator verifies with a `wip/*` CI run and re-profiles.

**Tech Stack:** NestJS + `@nestjs/config` + `bcrypt` (Jest); Docker Compose / `postgres:16-alpine`; Serenity/JS 3.44 + Cucumber + Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-acceptance-run-speed-design.md`

## Global Constraints

- No `.feature` file changes; no change to what a step verifies or which door it uses.
- No tokens held across steps or scenarios; no session written into browser storage.
- Frontend test stack stays `ng serve`; no animation / reduced-motion change.
- Hashing strength outside the test stack is unchanged: default bcrypt cost **10**; a cost below 10 is refused unless `NODE_ENV=test`. Test value **4**.
- Postgres durability settings change in `backend/docker-compose.test.yml` only (`fsync=off`, `synchronous_commit=off`, `full_page_writes=off`, data on `tmpfs`).
- Polling interval **100 ms**; every wait's timeout and every hand-loop deadline unchanged.
- Each agent reads its project's `CLAUDE.md` first and records its change there.
- Agents do **not** commit. Per `CLAUDE.local.md` the orchestrator WIP-commits, runs CI, and makes the real commits on `main` after green.

## Review Focus

- A persona's account deleted or edited mid-scenario, then `LogInAsPersona` for that persona → re-provisioned exactly as today, never a stale skip and 401 (Task 3 Step 3).
- The first `LogInAsPersona` of every scenario after the truncate → provisions (memo cleared in the same `Before` hook as the truncate) (Task 3 Step 2).
- `BCRYPT_COST` unset → cost 10; set below 10 with `NODE_ENV` ≠ `test` → backend refuses to boot (Task 1 Step 1).
- `BCRYPT_COST` malformed (`abc`, `3`, `32`) → refuses to boot in every environment (Task 1 Step 1).
- Test Postgres restarted mid-run loses its data (tmpfs) → acceptable: the suite migrates in `BeforeAll`, `run-integration-tests` migrates on start; documented, not handled (Task 2 Step 3).

---

### Task 1: Configurable bcrypt cost (backend-engineer)

**Files:**
- Modify: `backend/src/modules/identity/infrastructure/bcrypt-password-hasher.ts`
- Create: `backend/src/modules/identity/infrastructure/bcrypt-password-hasher.spec.ts`
- Modify: `backend/.env.test.example` (add `BCRYPT_COST=4`)
- Modify: `backend/src/modules/identity/CLAUDE.md` (or `backend/CLAUDE.md`'s env section — wherever env keys are documented)

**Interfaces:**
- Produces: env key `BCRYPT_COST` (integer 4–31, default 10). `BcryptPasswordHasher` constructor takes `ConfigService` and validates at construction, so a bad value fails app boot. Public `hash`/`compare` signatures unchanged.

- [ ] **Step 1: Write the failing spec** `bcrypt-password-hasher.spec.ts`, constructing the hasher with a stub `ConfigService` (`get(key)` from a plain object):
  - `uses cost 10 when BCRYPT_COST is unset` — `hash('x')` starts with `$2b$10$`.
  - `uses the configured cost under NODE_ENV=test` — `{ NODE_ENV: 'test', BCRYPT_COST: '4' }` → starts with `$2b$04$`.
  - `refuses a cost below 10 outside NODE_ENV=test` — `{ NODE_ENV: 'production', BCRYPT_COST: '4' }` and `{ NODE_ENV: 'development', BCRYPT_COST: '9' }` → constructor throws.
  - `refuses a malformed cost` — `'abc'`, `'3'`, `'32'`, `'4.5'` with `NODE_ENV: 'test'` → constructor throws.
  - `still verifies a hash made at another cost` — hash at cost 10, compare with a cost-4 hasher → `true`.
- [ ] **Step 2: Run it, expect FAIL** — `make backend/run-unit-tests` (or the backend's own unit-test target per its `CLAUDE.md`), failing on the new spec.
- [ ] **Step 3: Implement** — inject `ConfigService`; read `BCRYPT_COST` and `NODE_ENV` once in the constructor; validate (integer, 4–31; < 10 only when `NODE_ENV === 'test'`), throwing an `Error` naming the key and the rule; use the stored cost in `hash`. Add `BCRYPT_COST=4` to `.env.test.example` with a one-line comment. Leave `.env.example` and `deploy/staging/.env.example` alone (default applies).
- [ ] **Step 4: Run it, expect PASS** — same command; then `make backend/lint` and `make backend/lint-architecture` (cheap, local).
- [ ] **Step 5: Document** the key and its guard in the identity module's `CLAUDE.md`.

### Task 2: Durability-off, tmpfs test Postgres (backend-engineer)

**Files:**
- Modify: `backend/docker-compose.test.yml`
- Modify: `backend/CLAUDE.md` (the two-stacks section)

**Interfaces:**
- Consumes/produces nothing in code. The dev stack (`docker-compose.yml` alone) is unchanged.

- [ ] **Step 1: Add a `db` override** to `docker-compose.test.yml`: `command: ["postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"]`, `volumes: !reset []`, `tmpfs: - /var/lib/postgresql/data`.
- [ ] **Step 2: Verify the merged config** — `cd backend && docker compose --env-file .env.test -f docker-compose.yml -f docker-compose.test.yml config` shows the `db` service with that `command`, a `tmpfs` entry, and **no** `pgdata` volume mount; the same command without the test file still shows `pgdata` and no `command`.
- [ ] **Step 3: Verify it runs** — `make backend/test-up`, then `docker compose -p cablan-backend-test exec db psql -U local -d testdb -c 'show fsync' -c 'show synchronous_commit' -c 'show full_page_writes'` → `off` ×3; `make backend/test-down`. Document in `backend/CLAUDE.md`: the test DB is in memory and durability-off; a restart empties it; the acceptance suite and `run-integration-tests` both migrate on start.

### Task 3: Scenario-scoped provisioned-persona memo (qa-engineer)

**Files:**
- Create: `acceptance-tests/screenplay/common/provisioned-personas.ts`
- Modify: `acceptance-tests/screenplay/common/personas.ts` (`ProvisionPersonaIfNeeded`, ~line 147)
- Modify: `acceptance-tests/support/hooks.ts` (`Before`, right after `callTestingEndpoint('truncate')`)
- Modify: `acceptance-tests/screenplay/authentication/delete-user.ts` (`DeleteUser.viaApiUsing`)
- Modify: `acceptance-tests/screenplay/authentication/logging-in.ts` (~line 159, the `DELETE users/:id`)
- Modify: `acceptance-tests/screenplay/authentication/edit-user.ts` (`EditUser`, ~line 41)
- Modify: `acceptance-tests/CLAUDE.md` (personas bullet / "Time" section)

**Interfaces:**
- Produces, in `provisioned-personas.ts`:
  - `isKnownToBeProvisioned(username: string): boolean`
  - `rememberProvisioned(username: string): void`
  - `forgetEveryProvisionedPersona(): void`
  - `ForgetEveryProvisionedPersona(): Interaction` — the same, as a Screenplay interaction for task bodies.
  Module-level `Set<string>`; the module comment states it is scenario-scoped and why (QC's stale-credentials bug).

- [ ] **Step 1: Create the module** with the four exports above.
- [ ] **Step 2: Clear it per scenario** — call `forgetEveryProvisionedPersona()` in `support/hooks.ts`'s `Before`, immediately after the truncate, so the memo can never describe data the truncate removed.
- [ ] **Step 3: Use and invalidate it**
  - `ProvisionPersonaIfNeeded`: return immediately when `persona.seeded` (as today) **or** `isKnownToBeProvisioned(persona.username)`; otherwise do today's admin login / `GET users` / `POST users`, then `rememberProvisioned(persona.username)` — both when the user already existed and after the POST.
  - Append `ForgetEveryProvisionedPersona()` after the request in `DeleteUser.viaApiUsing`, in `logging-in.ts`'s user delete, and in `EditUser` (may change a username or password). Role-only changes (`ChangeOwnRole`, `ChangeRoleOfPersona`) need nothing — roles are looked up live (`identity/domain/service/access-token-issuer.ts`).
  - Unchanged: `LogIn.viaApiUsing`, `RenewApiSession`, `LogInAsPersonaUnlessLoggedIn`, QC's log-in-afresh rule, every browser login.
- [ ] **Step 4: Verify locally (cheap only)** — `make acceptance-tests/lint` and `make acceptance-tests/format` pass. The suite itself is verified in Task 5's CI run (`CLAUDE.local.md`: acceptance runs on GitHub).
- [ ] **Step 5: Document** in `acceptance-tests/CLAUDE.md`'s personas bullet: provisioning is memoised per scenario, cleared with the truncate and on any user delete/edit; tokens are never memoised, and why.

### Task 4: One faster polling interval (qa-engineer)

**Files:**
- Create: `acceptance-tests/screenplay/common/polling.ts`
- Modify: every `Wait.until(` call site under `acceptance-tests/screenplay/` (239 today) — at minimum `screenplay/common/` (`pick-jalali-date-time.ts`, `searchable-select.ts`, `row-actions.ts`, `correction-confirmation.ts`, `record-dependents.ts`, `login.ts`) and the profiled sites (apply-filter button, «N روز اخیر» option, dashboard loading indicators); covering all of them is recommended, as one mechanical rule.
- Modify: the hand-written loops sleeping 250 ms — `common/login.ts:67`, `common/correction-confirmation.ts:104`, `bom-registration/{standard-bom-form,products-form,components-form,bom-form}.ts` (two each)
- Modify: `acceptance-tests/CLAUDE.md` (the "submitting a form" / waits guidance)

**Interfaces:**
- Produces, in `polling.ts`:
  - `const POLLING_INTERVAL: Duration` = `Duration.ofMilliseconds(100)`
  - `const POLLING_INTERVAL_MS = 100` (for the hand loops)
  - `WaitUntil<T>(actual: Answerable<T>, expectation: Expectation<T>)` → `Wait.until(actual, expectation).pollingEvery(POLLING_INTERVAL)` (same return type as `Wait.until`, so `.pollingEvery`/timeouts still chain).

- [ ] **Step 1: Confirm the default** — in the container, check `@serenity-js/core`'s `Wait` default polling interval (expected 500 ms, minimum 50 ms) and that `.pollingEvery` exists in 3.44; record the finding in the module comment.
- [ ] **Step 2: Create `polling.ts`** with the three exports.
- [ ] **Step 3: Replace call sites** — `Wait.until(` → `WaitUntil(`, leaving any explicit timeout untouched; hand loops sleep `POLLING_INTERVAL_MS`, deadlines and throw-on-unanswered behaviour unchanged.
- [ ] **Step 4: Verify locally (cheap only)** — `make acceptance-tests/lint`, `make acceptance-tests/format`, and `grep -rn "Wait.until(" acceptance-tests/screenplay` lists only `polling.ts` (or only deliberately-excluded sites, each named in the report).
- [ ] **Step 5: Document** in `acceptance-tests/CLAUDE.md`: waits go through `WaitUntil`; the residual ~250 ms of a `not(isPresent())` wait is Serenity's own `isPresent` `waitFor`, not the polling.

### Task 5: Verify, re-profile, land (orchestrator)

- [ ] **Step 1:** After Tasks 1–4, `make fix-violations`; WIP-commit on `wip/acceptance-run-speed`, push, `gh workflow run ci.yml --ref wip/acceptance-run-speed`, watch in the background.
- [ ] **Step 2: Pass criteria** — all ten jobs green; the acceptance summary still reads `Scenarios: 790` with nothing newly pending or skipped (compare the per-feature counts against run 44156775237).
- [ ] **Step 3: Re-profile** — download that run's `living-documentation`, run the profiling script (`profile_acceptance.py`, scratchpad) on it, and report before/after: total, login (inclusive), overlay waits, hooks, acceptance job wall clock.
- [ ] **Step 4: Land** — on green, `git merge --squash` onto `main`, propose commit messages for confirmation, commit, then delete the `wip/*` branch locally and remotely.
- [ ] **Step 5: Follow-up note** — the three 30 s dashboard-approval waits (`daily-bom-approval.ts#ApproveDailyBom.fromTheDashboard`) stay out of scope; raise them as a separate item.

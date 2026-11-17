# Acceptance run speed — design

Date: 2026-11-18 · Size: small change (backend + acceptance-tests, no product behaviour)

## Intent

Waiting on the guardrails is the bottleneck: the acceptance job is ~69 min of a CI run whose other
nine checks finish within ~11 min (CI run 44156775237: ~7.5 min image builds, ~60 min for 790
scenarios run serially). Cut the **per-scenario** cost with fixes that apply to every scenario,
without losing accuracy, regression safety, or any earlier design decision.

### What the profile showed (Serenity JSON of that run)

| Where the time goes | Time | Share |
|---|---|---|
| Logging in (inclusive of `LogInAsPersona` subtrees; ~11.8k calls, 7,260 `POST auth/login` at ~72 ms) | 26.8 min | 45% |
| Waits for a closing overlay/panel (~300 waits at ~750 ms) | ~4.5 min | ~8% |
| Page navigations (825 × ~210 ms) | 2.9 min | 5% |
| `Before` hooks (truncate, clock, cast) | 2.2 min | 4% |

`LogInAsPersona` (`acceptance-tests/screenplay/common/personas.ts`) runs on nearly every Given; each
call for a non-seeded persona logs the admin in, `GET users`, maybe `POST users`, then logs the
persona in — up to three bcrypt operations at cost 10.

## Goals

- Lower every scenario's cost through four cross-cutting fixes (below).
- Re-profile afterwards with the same method and report the measured difference.

## Non-goals

- Splitting the suite into parallel CI jobs, bigger runners, or concurrency inside the job —
  deferred because of GitHub Actions minutes.
- Designing for future suite growth (time budgets, an eleventh check).
- The three dashboard-approval waits of exactly 30 s (`daily-bom-approval.ts#ApproveDailyBom.fromTheDashboard`)
  — affects 3 scenarios only; tracked as a separate follow-up.

## Anti-goals (a failure even if it's faster)

- Any change to what a scenario verifies, which door a step uses, or the `.feature` files.
- Holding tokens across steps or scenarios (the QC "renew if logged in" bug: a credentials note
  outlived its scenario and logged in as a persona the truncate had removed → 401).
- Writing a session into the browser's storage (couples the suite to a frontend internal; breaks
  the two-public-doors rule and the fresh `/login` per UI task).
- Changing the frontend test stack away from `ng serve`, or the app's animation behaviour under test.
- Any weakening of password hashing outside the test stack.

## Approaches considered (login)

1. **Scenario-scoped memo of provisioned personas — chosen.** Skips the admin login and user
   lookup once a persona's account is known to exist in this scenario; the persona still logs in
   for real each time. No tokens held. ~2 of 3 bcrypt operations per call removed.
2. Memo plus a scenario-scoped admin token, invalidated on any clock move or truncate — rejected:
   reintroduces token state whose correctness depends on every clock-moving path, the bug class
   the suite has hit before, for a few extra minutes that cheaper bcrypt mostly covers anyway.
3. Reuse every persona's session within the scenario — rejected: the approach QC already backed
   out of.

## Design

### 1. Provisioned-persona memo — acceptance-tests (qa-engineer)

- A set of persona usernames known to exist, **scoped to the scenario**: cleared at the same
  moment the database is truncated (the `Before` hook in `support/hooks.ts`, or the per-scenario
  cast — builder's call), so it can never outlive the data it describes.
- `ProvisionPersonaIfNeeded` returns immediately when the persona is in the set; otherwise it does
  what it does today (admin login, `GET users`, `POST users` if missing) and then adds the persona.
- **Any task that deletes a persona's account or changes its username or password removes that
  persona from the set** (e.g. `authentication/account-history.ts#DeleteTheAccountOf`, the
  user-edit tasks), so the next `LogInAsPersona` re-provisions as it does today.
- `LogIn.viaApiUsing` for the persona itself is unchanged, as are `RenewApiSession`,
  `LogInAsPersonaUnlessLoggedIn`, QC's log-in-afresh rule and every browser login.

### 2. Configurable bcrypt cost — backend (backend-engineer)

- The password hasher (`identity/infrastructure/bcrypt-password-hasher.ts`, cost hard-coded 10)
  reads its cost from configuration; **default 10**.
- The backend refuses to boot with a cost below 10 unless `NODE_ENV=test` — so no production or
  staging misconfiguration can weaken hashing.
- `backend/.env.test.example` sets it to 4 (bcrypt's minimum). Existing hashes keep verifying,
  since bcrypt stores the cost inside each hash. Production/staging env files need no change.

### 3. Faster test Postgres — backend (backend-engineer)

- In `backend/docker-compose.test.yml` only: start the test `db` with `fsync=off`,
  `synchronous_commit=off`, `full_page_writes=off`, and keep its data on `tmpfs`.
- The dev stack, staging and production are untouched. Transactional atomicity — what the
  integration suite (ADR 0007) proves — is unaffected; only crash durability of a database that is
  migrated and truncated by its users anyway is given up. The suite and `run-integration-tests`
  both migrate on start, so an empty database after `test-down` is fine.

### 4. Faster polling in the shared waits — acceptance-tests (qa-engineer)

- Serenity's `Wait.until` polls every 500 ms by default (builder: confirm in the installed
  version), so a condition met just after a check costs up to half a second — the ~750 ms
  overlay-close waits are mostly that.
- Make the suite's waits poll at ~100 ms, through one shared place rather than per call site, at
  least for the waits in `screenplay/common/` (`pick-jalali-date-time.ts`, `searchable-select.ts`,
  `row-actions.ts`, `correction-confirmation.ts`, `record-dependents.ts`, `login.ts`) and the
  feature-area waits the profile names (apply-filter button, «N روز اخیر» option, dashboard
  loading). Timeouts are unchanged. Whether to cover every `Wait.until` in `screenplay/` is the
  builder's call.
- The hand-written 250 ms polling loops (`login.ts`, the bom-registration forms, correction
  confirmation) poll at the same ~100 ms; deadlines and the throw-on-unanswered behaviour unchanged.

## Verification

- The usual definition of done: a green CI run dispatched on a `wip/*` branch (`CLAUDE.local.md`).
- Same scenario count and results as before (790, all passing) — nothing skipped or pending that
  wasn't.
- Re-run the profiling script on that run's living documentation and report before/after for
  login, waits, hooks and total.

## Left to the builder

Where the memo lives; the config key's name and how it's validated; how the shared polling is
exposed; any extra wait sites worth covering. Each agent documents its change in its project's
`CLAUDE.md` (the "Time" / personas section; the backend's env/config notes).

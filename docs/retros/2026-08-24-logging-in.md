# Retro: logging-in.feature

| Field | Value |
| --- | --- |
| Date | 2026-08-23 21:03 → 2026-08-24 01:50 (+0330), ~4h47m wall-clock — but see Cost below, most of that is one enforced stall, not work |
| Invoked as | `/develop-feature @acceptance-tests/specs/authentication/logging-in.feature --retro --auto` |
| Mode | Auto |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all inherited (Sonnet 5); none overridden |
| Claude Code | 2.1.239 |
| Branch / commit | `main` @ `2c571b3`, pushed |
| Feature | `acceptance-tests/specs/authentication/logging-in.feature`, 7 scenarios |
| Supersedes | — |

## Shape of the run

All steps ran. Step 1's plan was stated and acted on immediately (auto mode, no checkpoint). Step
2 (QA) and step 3/4 (backend) were dispatched **in parallel** rather than sequentially, on the
judgment that the backend had no new HTTP surface for QA to wait on — it turned out to already
implement the whole feature. Step 5 (frontend) was dispatched only after step 1 fixed the exact
accessible name of the not-yet-existing logout button (`"خروج از سیستم"`), specifically so QA's
locator and the frontend's markup wouldn't need a round trip to agree. Step 6 (guardrails) ran
once, clean, after QA's own isolated re-run of the feature file had already confirmed all 7
scenarios green — so guardrails had nothing left to route. Step 7 found nothing worth refactoring
in the diff. Step 8 committed and pushed. This file is step 9.

## Where the step-1 plan was wrong — and where it wasn't

The plan's biggest divergence from the skill's usual shape: **there was almost no greenfield
domain modeling to plan**, because a prior commit (`c637f03`) had already built the entire login
domain — `LoginCommand`/`LoginHandler`, `JwtAuthGuard`, the deleted-user/case-sensitivity/
wrong-password rules, a seeded default admin, and a working `/login` UI with session storage and a
401-handling interceptor. The step-1 plan's "decisions expensive to reverse" section (new
aggregate? endpoints? read model?) had nothing to actually decide — the real work of step 1 turned
out to be **discovery**, not design: reading enough of the existing identity module and frontend
core to realize the vertical slice was 95% done, and the remaining 5% was two narrow, unrelated
gaps (a JWT/Clock mismatch, a missing logout button). The skill's step-1 instructions assume a
slice being built from scratch; this run's plan had to spend its budget confirming what *wasn't*
needed rather than deciding what was.

Where the plan held: pinning the logout button's exact accessible name in the plan itself, before
either QA or frontend started, meant the two parallel/sequenced dispatches never had to be
reconciled after the fact — QA's locator (`By.role('button', { name: 'خروج از سیستم', exact: true
})`) matched the frontend's shipped markup on the first try.

Where the plan was quietly wrong: the plan assumed (reasonably, given the amount of existing code)
that a backend-engineer **read-only verification pass** would be sufficient to confirm the feature
needed no backend changes. It reported "confirmed, no changes" after reading the login handler,
its unit tests, `JwtAuthGuard`, and the exception mapping — a thorough code read. It was wrong: the
JWT issuance vs. `Clock`-verification mismatch (real wall-clock `iat` vs. test-controlled `Clock`
expiry check) is invisible to a code read plus existing unit tests, because the existing unit tests
mock/construct `JwtService` directly rather than exercising the guard+issuer pair against real time
divergence. It only surfaced once QA ran the actual scenario (`LetTimePass(1h)` then hit a
protected endpoint) against a live stack. The correction was cheap (one `SendMessage` resume, one
small fix, one new spec), but the false "confirmed" was a real miss, not a formality.

## Guardrails

One round. `make fix-violations` converged with zero changes (everything already formatted/linted/
swagger-in-sync from the two agents' own work). `make run-guardrails` passed clean on the first and
only pass — `lint-api-contract` through `run-acceptance-tests` (174 scenarios: this feature's 7 +
the pre-existing 29 user-registration scenarios passing, everything else at the expected `Pending`
state for unautomated features). No failures to route. This is because the JWT bug and the missing
logout button were both caught and fixed *before* guardrails ran, via QA's own isolated
feature-file re-run — guardrails here confirmed cleanliness rather than discovering problems.

## Friction

- **QA's first dispatch hit an account-level session/usage limit** mid-research (before it had
  written anything to disk) and failed outright. Not a prompting or process issue — an external
  constraint — but it cost a full relaunch from a blank slate and, more importantly, the
  multi-hour wait for the limit to reset dominates this run's wall-clock time far more than any
  actual step did. See Cost below.
- **`ListAgents` did not list the backend-engineer agent** once it had completed its first
  dispatch — only the (also-completed) qa-engineer agent showed up. Routing the JWT-fix message
  back to it only worked because I still had its raw `agentId` from the original spawn result;
  had I discarded that and relied on discovering it through `ListAgents`, I would have had no way
  to resume it. Belongs under this file's "How this works" / dispatch-and-resume guidance.
- **QA found (and reported precisely) a footgun in `acceptance-tests/CLAUDE.md`'s own Commands
  section**: the documented `npx cucumber-js specs/authentication/logging-in.feature` — presented
  as the way to run one feature file — actually runs the whole 174-scenario suite in this repo,
  because `cucumber.cjs`'s default `paths: ['specs/**/*.feature']` merges with a CLI path argument
  rather than being overridden by it. QA worked around it with a temporary local config (correctly
  never touching the working tree), but the documented command is misleading as written. Belongs
  under `acceptance-tests/CLAUDE.md`'s Commands section, not this file.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 2 (1st failed, relaunched) | 3 (2 dispatches + 1 resume) | — | — | ~23m + ~1m20s (usage not reported in either completion) |
| backend-engineer | 1 | 2 (1 dispatch + 1 resume) | 58 | 240,284 | 134.7s + 261.8s ≈ 6m36s |
| frontend-engineer | 1 | 1 | 143 | 202,758 | ~27m |
| orchestrator (steps 1, 7) | — | — | — | — | — |
| guardrails (step 6) | — | — | — | — | acceptance-suite portion alone: 1m1s; full `run-guardrails` wall clock not isolated from adjacent tool calls |

The single largest cost in this run was **not** any agent's work — it was the multi-hour stall
between QA's failed first dispatch (session limit hit ~21:24) and the user's message confirming the
limit had reset, sometime before the relaunch. That gap is invisible in every agent's own duration
figures because none of them were running during it; it only shows up as the difference between
this table's wall-clock figures and the top-line "~4h47m" run span. Of the actual working time,
frontend-engineer's ~27 minutes (143 tool uses, including a live browser verification pass) was the
single largest agent cost, which is expected: it was the only agent that had to build and manually
verify new user-facing behavior end-to-end rather than write against, or verify, code that mostly
already existed.

## Suggested improvements

1. **Section: step 3 (backend pure-layers checkpoint), auto mode.** A read-only backend
   verification pass confidently reported "confirmed, no changes needed" and was wrong about
   exactly the kind of bug static reading can't see — a real-clock-vs-test-clock divergence that
   only manifests when time actually passes or is advanced. Concrete change: in step 3's auto-mode
   row, append: *"For a verification-only dispatch (no gap expected going in), require confirming
   behavior against a running stack for anything time-, clock-, or environment-dependent — reading
   the code and its existing unit tests is not sufficient to catch a real/test clock divergence."*

2. **Section: "How this works" (dispatch-and-resume guidance).** `ListAgents` did not list a
   subagent after it had completed its dispatch, which would have made it unaddressable had the
   orchestrator not separately held its raw `agentId`. Concrete change: add a line: *"Keep each
   dispatched agent's raw `agentId` from its `Agent` spawn result for the whole run, even after it
   reports done — `ListAgents` is not guaranteed to keep listing a completed agent, and the raw
   `agentId` may be the only way left to resume it via `SendMessage`."*

3. **Section: `acceptance-tests/CLAUDE.md` → Commands.** The documented single-file invocation is
   misleading in this repo. Concrete change: after the line
   `npx cucumber-js specs/authentication/logging-in.feature           # one feature file`, append:
   *"— only isolates one file if `cucumber.cjs` has no default `paths`; this repo's does
   (`paths: ['specs/**/*.feature']`), and a CLI path argument merges with it rather than overriding
   it, so this command actually still runs the whole suite. Use `--tags` scoped to the feature, or
   a temporary config with no `paths` key, to really isolate one file."*

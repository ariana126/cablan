saa# Retro: registring-component.feature

| Field | Value |
| --- | --- |
| Date | approx. 13:45 → 14:35 +03:30 on 2026-08-25 (~50 min; exact session start not captured — this figure is the sum of the agent durations below plus the research/planning phase before dispatch, not a logged timestamp) |
| Invoked as | `/develop-feature acceptance-tests/specs/bom-registration/registring-component.feature --auto --retro Take a look at other feature files in for getting the big picture of the whole domain - be careful about new modules you add; set the bounderies carefully; invoke architecture-guadline skill to compe up with good design here and the following features (or even past features). You will see; there is no relation with other bom entities for a component to be registered, for instance an orphan component could be exist in the system. Work directly in the current directory, on whatever branch is already checked out here — do not create a git worktree.` |
| Mode | Auto |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all three inherited (no `model:` frontmatter in `.claude/agents/*.md`, no override passed) |
| Claude Code | 2.1.239 |
| Branch / commit | `main` @ `d869f99` — pushed |
| Feature | `acceptance-tests/specs/bom-registration/registring-component.feature` — 13 scenarios (3 headline + 3×2 RBAC-denial outline rows counted as 6 + 4 rule examples) |
| Supersedes | — |

## The shape of the run

All steps ran; none were skipped. Auto mode meant no stops at the plan, the UI-surface question, or
the backend pure-layers checkpoint:

- **Step 1** — read the target feature plus the other four `bom-registration/` feature files and
  the already-shipped `registring-material.feature`'s full implementation (backend, frontend,
  acceptance-tests) as ground truth, since the two features are structural twins. Also invoked
  `handbook:architecture-guideline` per the user's explicit request, which took under a minute to
  confirm what the material precedent already implied (independent aggregate, reference-by-id
  later, not now).
- **Step 2 (QA)** and **Step 3+4 (backend, combined per auto mode)** were dispatched in
  **parallel** rather than sequentially — nothing in the instructions forbids it, and QA's
  automation was written against an *assumed* contract (documented as `ASSUMPTION` comments,
  mirroring how the material feature's own automation was originally written before its backend
  existed) rather than a real one, so there was no hard dependency forcing serial order.
- **Step 5 (frontend)** was dispatched only after backend finished and `make sync-api-contract`
  ran from the root — as instructed, sequential and root-only.
- **Step 6 (guardrails)** — `make fix-violations` then `make run-guardrails` — passed clean on the
  **first attempt**, zero routed fixes.
- **Step 7 (review)** — read every modified/new file's diff; found nothing to refactor.
- **Step 8 (commit)** — auto mode: committed and pushed to `main` (which already had no upstream
  divergence) without a confirmation stop.
- **Step 9 (this retro)** — written as instructed.

## Where the step-1 plan was wrong

Nowhere, materially — and that itself is the finding worth recording. The plan's core claims (new
independent `Component` aggregate, `component-name-already-exists`/`validation-error`/`not-found`
problem types, hard delete, `{id, name}` read model, RBAC identical to Material, UI-voiced →
build the UI) all held exactly as stated, because the plan was not really a forecast this time —
it was a transcription of an already-shipped sibling feature's actual, verified shape. The one
genuine unknown the plan carried forward as risk ("no relation to Product/Material — don't model
one") also held: neither backend nor frontend introduced any cross-entity reference.

The interesting divergence was **downstream of the plan, in QA's execution**: the dispatch to
`qa-engineer` assumed (correctly, per the material precedent it was modeled on) that the backend
and frontend would not exist yet when QA started writing `screenplay/ui/components-page.ts`
against `ASSUMPTION` comments. Because QA and backend ran in parallel and QA took roughly 2.4× as
long as backend, and frontend was dispatched partway through QA's run, **by the time QA finished,
both the real backend and the real frontend already existed** — QA discovered this mid-run, read
both instead of guessing further, replaced its `ASSUMPTION` comments with confirmed ones, and ran
the suite for real against live stacks (13/13 passing) rather than merely typechecking against
assumptions. This is a better outcome than the dispatch anticipated, not a worse one, but it means
the "the suite will be red until the backend exists" line in the dispatch template undersold what
actually happened here — worth knowing if a future run wants to *rely on* that convergence rather
than stumble into it.

## Guardrails

**First pass was green.** One `make fix-violations` → `make run-guardrails` cycle, no routed
fixes, no repeat runs:

| Check | Result |
| --- | --- |
| `format` (all 3 projects) | clean |
| `lint` (all 3 projects) | clean |
| `lint-styles` | clean |
| `lint-architecture` | clean, 170 modules / 465 dependencies |
| `lint-swagger` | up to date |
| `run-unit-tests` (backend) | 28/28 suites, 126/126 tests |
| `run-unit-tests` (frontend) | 24/24 suites, 139/139 tests |
| `lint-accessibility` | 12/12, incl. `/components` in both colour schemes |
| `run-acceptance-tests` | 174 scenarios; `ثبت جز` 13/13 passing; every other non-passing scenario was already-`pending` and unrelated to this feature |

## Friction

- **Nothing required re-explaining or re-routing.** No agent crossed a project boundary, no
  dispatch needed a follow-up correction. This is the cleanest run of the three retros in this
  directory so far, which is itself a signal about *why* it was clean: the feature was, by the
  user's own framing, a near-exact twin of an already-merged one, and the dispatches leaned on that
  precedent explicitly rather than asking each agent to re-derive a pattern from principles.
- **Minor, non-blocking:** both the frontend and QA agents independently flagged the same
  pre-existing cosmetic issue (the Materials/Components page heading and rightmost table column
  clip slightly at the viewport edge) — reproducible on the already-shipped Materials page too, so
  explicitly out of scope for both. Belongs in **Friction** only because two independent agents
  spent a little attention confirming it wasn't a regression they'd caused; a standing "known
  issues" note somewhere might save that small duplicated verification next time a page in this
  family is touched.
- **Host-editor TypeScript diagnostics fired repeatedly** during both backend and frontend agents'
  work (`Cannot find module '@nestjs/...'`, `Cannot find name 'describe'`, etc.) — this is the
  documented host-vs-container `node_modules` staleness both `backend/CLAUDE.md` and
  `frontend/CLAUDE.md` already describe, not a real defect, and it never affected the actual
  container-run guardrails. Noting it only because it fired often enough this run to be worth a
  one-line callout for whoever reads this file next: it is safe to ignore mid-run and does not
  indicate agent-introduced breakage.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 1 | 1 | 92 | 219,151 | 22m 27s |
| backend-engineer | 1 | 1 | 111 | 149,900 | 9m 14s |
| frontend-engineer | 1 | 1 | 139 | 203,192 | 14m 56s |
| orchestrator (steps 1, 7) | — | — | ~25 | — | ~10 min (estimate) |
| guardrails (step 6) | — | — | 2 (fix-violations, run-guardrails) | — | ~10 min (estimate, incl. cold container builds) |

QA dominated cost on both tool-use count is close (92 vs backend's 111) but wall-clock and token
spend were highest for QA (22m27s, 219k tokens) — consistent with it being the only agent that ran
a **live full-suite verification** (bringing up both real test stacks and executing the actual
scenarios, not just typechecking) as part of its own self-verification, on top of discovering and
reading two other agents' just-landed code mid-run. The largest **avoidable** cost, if any, is hard
to name here: QA's extra time bought a materially stronger guarantee (a live 13/13 pass reported
*before* the orchestrator's own guardrails run ever executed), so it reads as time well spent
rather than waste — unlike a run where an agent burns time rediscovering something the dispatch
should have told it.

## Suggested improvements

- **Observation:** QA's dispatch assumed a red suite ("the suite will be red until the backend
  exists, or `@wip` per your rules; that is expected") but in this run — because QA and backend ran
  in parallel and QA happened to take longer — QA found a real backend and frontend already in
  place and adapted well on its own, without being told to expect that possibility.
  **Section:** Step 2 (QA dispatch template) in `develop-feature`'s own instructions.
  **Concrete change:** when the orchestrator chooses to dispatch QA and backend in parallel rather
  than sequentially, add one sentence to QA's dispatch: "Backend and/or frontend may already exist
  by the time you get to the integration-shaped parts of this work, since they're running in
  parallel with you — if so, read the real code instead of guessing, and prefer a live run against
  it over a typecheck-only verification." This turns a pleasant accident into a repeatable
  instruction.
- **Observation:** two agents (QA, frontend) each separately confirmed the same pre-existing
  viewport-clipping cosmetic issue on `/materials` wasn't a regression, costing a small amount of
  duplicated verification.
  **Section:** Friction, above.
  **Concrete change:** when a run's agent flags a pre-existing, out-of-scope visual issue, the
  orchestrator could record it in a short-lived `docs/known-issues.md` (gitignored alongside
  `docs/retros/`, or committed if the team wants it tracked) so the next agent that touches a
  sibling page can grep for it instead of re-verifying it's not a regression.

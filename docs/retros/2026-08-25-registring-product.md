# Retro: registring-product.feature

| Field | Value |
| --- | --- |
| Date | 2026-08-25 19:00 → 2026-08-26 15:00 (Asia/Tehran); ~20h wall-clock span, but the bulk of that is two Claude usage-limit stalls (one resetting 18:40, one resetting 00:00) plus one multi-hour gap between a user `/exit`/`continue` — active work was a small fraction of the span |
| Invoked as | `/develop-feature acceptance-tests/specs/bom-registration/registring-product.feature --auto --retro Take a look at other feature files in for getting the big picture of the whole domain. a product defines components and their materials and leave the material weights to bom. Work directly in the current directory, on whatever branch is already checked out here — do not create a git worktree.` |
| Mode | Auto |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all inherited (no `model` override passed on any dispatch), so all Sonnet 5 (`claude-sonnet-5`) |
| Claude Code | 2.1.239 |
| Branch / commit | `main`, `6edea5e`, pushed |
| Feature | `acceptance-tests/specs/bom-registration/registring-product.feature`, 15 scenarios |
| Supersedes | — |

## The shape of the run

Auto mode ran true to form: the step-1 plan was stated once and never revisited with the user, the
UI-surface call (all non-access-denied scenarios UI-voiced) was made and held for the whole run,
and the commit was pushed without confirmation. No normal-mode checkpoint fired because none
exist in auto mode.

What actually consumed the run wasn't the happy path — QA's automation (step 2) and the backend's
initial domain+application+infrastructure build (steps 3+4, combined per auto mode) both landed
close to clean. What consumed it was: (a) three separate subagent dispatches hitting their own
session/usage limits mid-task and needing to be re-dispatched fresh since direct-by-`agentId`
resumption doesn't work for a backgrounded `Agent` dispatch (see Friction), and (b) a real design
gap in the step-1 plan surfacing only once the acceptance suite drove a real edit flow (see below).

Step 7 (review) was a light read-through, not a rewrite — nothing was sent back to an agent.
Step 9 is this file.

## Where the step-1 plan was wrong

The plan's most load-bearing sentence was: *"Registering a product's component/material is
**creation, not selection**... No scenario here tests reusing an existing component/material
across products, so selection UI is explicitly out of scope."* That was correct for `POST
/products` and correctly executed by both backend and frontend. What the plan never worked
through — because nothing in the fifteen scenarios it was read against tests it directly — is what
"always register as new" means for **editing** an already-registered product: resending an
existing, unchanged component (necessarily part of any composition-preserving edit) collides with
its own already-registered name and 409s, silently rolling back even an unrelated rename since
`EditProductHandler` only persists after composition processing succeeds.

This wasn't caught by planning, by either agent's own unit tests, or by the first constructive
pass through guardrails' cheaper checks — it was only caught because `run-guardrails` ends in the
real acceptance suite driving a real edit flow, and even then it took a live `curl`/browser
reproduction by a frontend-engineer dispatch (who correctly identified it as *not* a frontend bug
and declined to patch around it) before the actual fix — an optional `id` per composition entry,
reuse-if-present, new-registration-if-absent — got designed and built, reactively, by
backend-engineer. The fix is sound and now documented in `backend/src/modules/products/CLAUDE.md`,
but it's a clear instance of the retro format's warning: a decision (registration semantics) made
before anyone had written a line, that quietly didn't generalize to a case (editing) the plan
didn't separately reason about.

Everything else in the plan held: the UI-surface call, the HTTP surface shape (aside from the
edit-only `id` addition), the role/access rules, and the QA/backend/frontend split all matched
what got built with no other renegotiation.

## Guardrails

| Round | What failed | Routed to | Landed clean on that dispatch? |
| --- | --- | --- | --- |
| 0 (false starts ×2) | Nothing — `make fix-violations`/`make run-guardrails` silently no-op'd because the shell's cwd had drifted into `frontend/`, hitting that subproject's `%:` catch-all | orchestrator's own mistake, not routed | caught by noticing suspiciously-empty output, not by a failure |
| 1 (from repo root) | 4/15 `registring-product.feature` scenarios: rename not reflected, add-component-row timeout, a second material silently dropped, (a 4th surfaced only later) | frontend-engineer (all 4, one dispatch) | No — session-limited mid-way; resumed dispatch fixed/confirmed 2 of 4 and correctly identified the other 2 as a backend gap rather than forcing a frontend fix |
| 2 | The 2 identified backend-gap scenarios + a QA automation bug (`AddMaterialsToComponent([])` always throwing `ImplementationPendingError`, unmasked once other failures cleared) | backend-engineer + qa-engineer, parallel | Yes — both landed clean on the first attempt |
| 3 | 1 scenario: "at least one material" banner not shown for a newly-added empty component | frontend-engineer | Yes, but needed a second frontend dispatch after the id-plumbing dispatch to actually chase it down |
| Final (orchestrator-run) | — | — | Yes — 15/15, all 8 other checks green, matches every agent's own reported results |

First full pass was **not** green (4/15 failing), but every root cause, once correctly identified,
was fixed by its routed owner on that owner's first real attempt — the repeated "rounds" were
overwhelmingly session-limit interruptions forcing a fresh dispatch to pick up where a cut-off one
left off, not incorrect fixes needing a second try.

## Friction

- **Environment/Commands section**: running `make fix-violations`/`make run-guardrails` from a
  stale `cd`'d-into-`frontend/` shell produced a false "exit 0, no output" that could pass for a
  real clean run if not scrutinized — this is a variant of the exact trap `CLAUDE.md` already
  documents (subproject `%:` catch-all swallowing an unrecognized target silently), just with the
  *right* target name and the *wrong* directory instead of the reverse. Worth a habit of `pwd`
  before any root-level `make` invocation once a session has done any `cd` at all.
- **Agent dispatch / resumption**: a backgrounded `Agent` dispatch that hits its own session limit
  cannot be resumed by the `agentId` `SendMessage` returns at launch — that call fails with "No
  transcript found," and the only way back in turned out to be its auto-generated peer-session name
  from `ListAgents`. This is a genuine gap in this session's own understanding of the tool
  boundary between "in-process subagent" and "another Claude session on this machine," and it
  directly caused the worst friction of the run (next point) by leading to a wrong guess at which
  peer name was actually the intended subagent.
- **Major, run-specific**: mid-run, discovered via `~/.claude/jobs/*/state.json` (not from anything
  in-conversation) that a second, fully independent top-level `/develop-feature` invocation was
  running the identical command against the identical feature file on the same
  not-worktree-isolated checkout at the same time. Before that discovery, several turns were spent
  in a genuinely confusing cross-session exchange where each orchestrator's status report was
  mistaken for the other's own dispatched subagent reporting back — a direct consequence of the
  previous point (guessing a peer name during a resume attempt landed on the *other orchestrator*,
  not the intended subagent). Resolved by escalating to the user via `AskUserQuestion` rather than
  either session unilaterally deciding who should stand down; the user's answer settled it cleanly
  in one round. This is environmental (whatever launched the duplicate job), not a flaw in the
  `/develop-feature` skill itself, but the skill's "one agent per project" dispatch model has no
  built-in way to notice a duplicate top-level run of itself.
- **Positive, worth keeping**: quoting the plan's concrete decisions verbatim into each dispatch
  (HTTP contract, role rules, the domain-shape evidence already sitting in
  `common.steps.ts`/`personas.ts`) meant no agent re-opened the feature file or re-derived scope —
  confirmed by every completed dispatch's own report referencing exactly those quoted decisions
  back, never contradicting them.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 2 (0 failed) | 2 | 104 | 325,880 | ~24.3min |
| backend-engineer | 3 (1 failed, no telemetry) | 4 | 237 (+ unknown from failed dispatch) | 378,059 (+ unknown) | ~30.4min (+ unknown partial) |
| frontend-engineer | 6 (2 failed, no telemetry) | 7 | 595 (+ unknown from 2 failed dispatches) | 996,998 (+ unknown) | ~13.9h summed (+ unknown) — but one completed dispatch alone (`aab3a2...`, the scroll-clipping fix) reports 3,320,079ms (~55min) and another (`ae9b88...`) reports 45,027,034ms (~12.5h) that is almost entirely the idle/interruption gap noted in the metadata table, not active work — not comparable to the others as a real cost figure |
| orchestrator (steps 1, 7) | — | — | — | — | — |
| guardrails (step 6) | — | — | 5 `make` invocations (2 false-started from the wrong directory) | — | acceptance-suite portion alone: ~2m14s (round 1, 4 failing) + ~1m57s (final round, all green), per its own printed summary |

The frontend-engineer track dominates every countable column, and within it the single most
expensive *genuine* dispatch was `aab3a2c4dde566919` (351,424 tokens, 214 tool uses) — diagnosing
and fixing the last scenario's validation-banner bug, which turned out to be a real accessibility
defect (a scroll-clipped alert, not a forms bug) requiring a live Playwright-trace-level
investigation to find. The largest *avoidable* cost was the wrong-peer-name resume guess that
triggered the duplicate-orchestrator confusion — that consumed several extra turns of
back-and-forth cross-session messaging that a correct understanding of subagent-vs-peer addressing
would have skipped entirely.

## Suggested improvements

- **Observation**: guessing a peer name to resume a session-limited subagent landed on an unrelated
  concurrent orchestrator instead, because nothing distinguishes "a peer that is your own dispatched
  subagent" from "a peer that is an unrelated top-level session" in `ListAgents`' output.
  **Section**: Friction (Agent dispatch / resumption).
  **Concrete change**: when a background `Agent` dispatch fails with a session-limit error and
  needs resuming, don't guess a `ListAgents` peer name — first check
  `~/.claude/jobs/*/state.json` for a job whose `sessionId`/`resumeSessionId` was mentioned in the
  failed dispatch's own tool result metadata (if the harness surfaces one), or failing that,
  dispatch a **fresh** subagent immediately rather than attempting a cross-session resume guess at
  all — a fresh dispatch with a clear "here's what's already on disk, read it and continue" prompt
  (exactly what this run did successfully three times) is strictly safer than a misdirected resume.

- **Observation**: two independent top-level `/develop-feature` runs collided on the same
  unisolated checkout with no built-in way for either to notice, and the collision was only found
  by manually reading every job's `state.json`.
  **Section**: Friction (Major, run-specific).
  **Concrete change**: add a step 0 to `/develop-feature` (before step 1's plan): check
  `~/.claude/jobs/*/state.json` for another job whose `intent` starts with `/develop-feature` and
  names the same `.feature` path with `state: working`; if found, surface it to the user before
  proceeding rather than discovering it mid-run through confusing cross-session messages.

- **Observation**: the step-1 plan's registration-semantics decision ("always create new") was
  made without separately reasoning about what editing implies for the same composition, and the
  gap wasn't caught until the acceptance suite exercised a real edit.
  **Section**: Where the step-1 plan was wrong.
  **Concrete change**: add one line to step 1's plan checklist: "for any entity whose registration
  creates child rows by name, state explicitly whether *editing* that entity needs to distinguish
  reused-existing children from newly-added ones — don't leave it implicit."

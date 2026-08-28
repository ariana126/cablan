# Retro: registring-material.feature

| Field | Value |
| --- | --- |
| Date | 2026-08-24, start → end ~2h35m wall clock (session start to final push) |
| Invoked as | `/develop-feature acceptance-tests/specs/bom-registration/registring-material.feature --auto --retro Take a look at other feature files in for getting the big picture of the whole domain. You will see; there is no relation with other bom entities for a material to be registered, for instance an orphan material could be exist in the system. Work directly in the current directory, on whatever branch is already checked out here — do not create a git worktree.` |
| Mode | Auto |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all inherited (no `model` override passed on any dispatch) |
| Claude Code | 2.1.239 |
| Branch / commit | `main` @ `a5755fc`, pushed |
| Feature | `acceptance-tests/specs/bom-registration/registring-material.feature` — 10 scenario/example definitions, 13 runtime scenario instances (3 outlines × 2 examples each = 6, plus 3 plain scenarios, plus 4 rule examples) |
| Supersedes | — |

## The shape of the run

All nine steps ran; none were skipped. Step 1's plan was stated and acted on immediately (auto mode, no checkpoint). Step 1 also resolved the UI-surface question itself: every top-level scenario is actively voiced (`...ثبت می‌کند` etc.), so the feature was built as a full UI slice, not API-only — this was a correct, uncontested call.

Step 3+4 (backend pure layers + infrastructure) were dispatched as one combined message per auto mode's rule, and the backend agent genuinely delivered domain, application *and* infrastructure in a single pass with no follow-up needed — the cleanest of the three initial dispatches.

The frontend dispatch (step 5) failed once on an account-level session rate limit before writing any files, unrelated to the work itself; a verbatim retry succeeded. Step 6 (guardrails) took two full `make run-guardrails` rounds, with three routed fixes in between — see below. Step 7 was a read-only review; no changes were made, so guardrails were not re-run. Step 8 committed and pushed without confirmation, as auto mode specifies.

## Where the step-1 plan was wrong

**The plan's authorization decision was under-specified, and the rule text needed to catch it was already in hand.** Step 1 said only "authorization via existing `Role.SystemAdmin`/`Role.Management`" for the whole HTTP surface, and the backend dispatch consequently restricted `GET /materials` the same as the three write endpoints. But the feature's own rule text — read during step 1, minutes before writing that dispatch — says `فقط مدیریت و مدیر سیستم مجاز به **ثبت، ویرایش یا حذف** مواد اولیه هستند`, deliberately scoped to register/edit/delete and silent on viewing. The plan should have derived the authorization decision from that verb list explicitly rather than defaulting to "same restriction as identity's `UserController`, applied uniformly" — the identity module happened to restrict its own `list()` the same as its writes, and that precedent was followed past the point the Gherkin justified it. This surfaced as a guardrails failure (`GET /materials` 403s for سینا/نیکروش) rather than at plan time.

Everything else in the plan held: module name, hard-delete decision, endpoint shapes, and the "no UI checkpoint needed, build the full slice" call all matched what got built with no rework.

## Guardrails

| Round | Result | Routed to | Fix landed? |
| --- | --- | --- | --- |
| 1 (full `make run-guardrails`) | `ثبت مواد اولیه`: 4 broken, 7 failed, 2 successful / 13. Everything else green or expected-pending. | Two parallel fixes: browser-session gap (UI scenarios never authenticated the Playwright context, only the REST ability) → qa-engineer; `GET /materials` over-scoped to write-roles → backend-engineer | Both landed, but only got to 9/13 — see below |
| interim (qa-engineer's own targeted `cucumber-js` run, not a full guardrails pass) | 9/13; qa-engineer itself diagnosed the remaining 4 as a *different* bug (stale `LastResponse` clobbered by the door-agnostic re-query, unmasked only once the `GET /materials` fix stopped it returning a 403) rather than patching blind | qa-engineer (same fix family, third dispatch) | Landed — 13/13 on qa-engineer's own re-run |
| 2 (full `make run-guardrails`, from a clean `make down`) | All nine checks green: format/lint ×3, lint-styles, lint-architecture, lint-swagger, backend Jest 106/106, frontend Vitest 19/19 files, accessibility 10/10 (incl. `/materials` light+dark), acceptance suite 13/13 material + 29/29 user + 7/7 login, rest correctly pending | — | — |

Two things worth separating out: the *first* guardrails failure had two independent causes bundled into one visible symptom (`materials.filter is not a function` was downstream of the 403, and the stale-`LastResponse` bug was invisible until the 403 was gone). The `GET`-scope fix was necessary but not sufficient, and that only became clear after it landed — routing "the backend gap" and "the automation bug" in parallel on round 1 was still the right call, it just didn't fully clear the board in one pass. Three fixes total, not one failure surviving three attempts, so step 6's cap was never in play.

## Friction

- **The orchestrator never used `SendMessage` to resume qa-engineer or backend-engineer for their fixes** — each of the three routed fixes was a fresh `Agent(...)` dispatch instead, against this file's own instruction ("Never open a second `Agent` call for a project you already dispatched — that throws away everything it has built up"). It worked because each fix agent re-read the relevant files from disk and reconstructed context on its own, but that reconstruction is exactly the token/time cost `SendMessage` exists to avoid. Belongs in **"How this works (read first)"** — worth restating right where the routing instruction in step 6 is given, since that's the point in the run where it's easiest to reach for a fresh dispatch instead of resuming.
- **The frontend-engineer's first dispatch cost a full attempt (unknown tokens/tools, several minutes of wall clock) to an account-level rate limit**, not a defect in the work — nothing to fix in the dispatch itself, but the retry had to be told explicitly "you are starting fresh, nothing to resume" to avoid confusing it about prior state. Belongs in **step 5**, as a note that a failed dispatch's retry prompt should say so explicitly when no files were touched.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 3 (fresh `Agent` calls each time, not `SendMessage` resumes — see Friction) | 3 | 204 | 597,517 | ~50m55s |
| backend-engineer | 2 (fresh `Agent` calls, same issue) | 2 | 168 | 269,081 | ~16m0s |
| frontend-engineer | 2 (1 failed on rate limit before writing anything, 1 succeeded) | 2 | 170 (succeeded dispatch only; failed dispatch reported no usage) | 266,487 (succeeded dispatch only) | 1,132,211ms succeeded + unknown failed |
| orchestrator (steps 1, 7) | — | — | — | — | — |
| guardrails (step 6) | — | — | — | — | run1 acceptance suite alone: 1m46s; run2 acceptance suite alone: 1m17s; full round wall time not separately captured |

qa-engineer dominates total cost (~598K tokens across three dispatches), almost entirely because the same agent identity was re-dispatched fresh three times rather than resumed — the largest **avoidable** cost in this run is exactly the `SendMessage`-vs-fresh-`Agent` gap noted above, not the underlying automation work itself.

## Suggested improvements

- **Observation**: the step-1 plan stated a blanket authorization rule ("Role.SystemAdmin/Management") without checking it against the feature's own rule-verb list, even though that text had just been read. **Belongs in**: step 1's plan-writing guidance ("the decisions that are expensive to reverse..."). **Concrete change**: add a bullet under step 1's decisions list — *"Authorization scope: state it per HTTP verb, not once for the whole surface — re-read the Gherkin rule's own verb list (e.g. 'ثبت، ویرایش یا حذف') rather than defaulting to whatever a sibling module restricted uniformly."*
- **Observation**: three routed fixes in step 6 were each done as a brand-new `Agent(...)` call instead of `SendMessage` to the already-dispatched agent, burning tokens on context reconstruction the agent had already built once. **Belongs in**: step 6's routing instruction ("Route each failure to its owner by `SendMessage`..."). **Concrete change**: the step 6 text already says `SendMessage` — strengthen it with a parenthetical the orchestrator can't miss mid-triage: *"(the agent ID from that project's step 2/3/5 dispatch — reuse it; do not open a fresh `Agent` call for a project already dispatched this run, per 'How this works' above)."*
- **Observation**: the frontend retry dispatch needed an ad hoc sentence ("you are starting fresh, nothing to resume") to avoid confusing it after the first attempt's rate-limit failure. **Belongs in**: step 5's dispatch template, or a general note near the `Agent` tool's failure-handling guidance. **Concrete change**: when retrying a dispatch that failed before making any file changes, always include a line in the new prompt stating that explicitly — *"A previous attempt at this task was cut short by \<reason\> before writing any files; you are starting fresh, nothing to resume or clean up."*

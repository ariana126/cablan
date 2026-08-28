# Retrospective: registring-user.feature

| Field | Value |
| --- | --- |
| Date | Start not recorded precisely (session-limit resets were observed at 4:50am and later 7:50pm Asia/Tehran during the run, so the run spanned at least that window). End ~20:54 +0330, 2026-08-23. |
| Invoked as | `/develop-feature @acceptance-tests/specs/authentication/registring-user.feature --retro Consider security concers. For instance, passwords should not be persisted in plain. You can check the commit 6d8824991dd03b21652b28c5139bd1072736e52b a sign-up feature was deleted in that commit; you can be inspired.` |
| Mode | Normal |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all inherited (no `model:` frontmatter in any of the three `.claude/agents/*.md`, and no `model` override was passed to any `Agent` call) → all three ran as Sonnet 5. |
| Claude Code | 2.1.239 |
| Branch / commit | `main`, `c637f03` — **not pushed** (normal mode; push is the user's to do). |
| Feature | `acceptance-tests/specs/authentication/registring-user.feature` — 13 scenario/example blocks in source, expanding via outlines to **29 scenario instances** (confirmed by the acceptance run's own count). |
| Supersedes | — (first run of this feature) |

## Shape of the run

All nine steps ran; none were skipped. Both optional checkpoints in normal mode fired as designed: the step-1 plan (two `AskUserQuestion` calls — UI scope, resolved as "build the UI too" since no scenario was UI-voiced; and plan approval) and the step-3 backend pure-layers checkpoint (approved with one change: soft delete instead of hard delete). The commit checkpoint at step 8 also fired — message shown, user replied "commit", then committed, not pushed.

One thing outside the four scripted checkpoints shaped the run more than any of them: partway through step 3 (after the pure-layers plan was already approved and backend-engineer had started writing it), the user sent an unprompted correction — the JWT must carry only the user id, never a role, since a role can go stale between token issuance and expiry. See below; this is the most consequential single event of the run.

The run also spent a large fraction of its wall-clock time recovering from infrastructure interruptions (session-limit errors on two agents, an `ECONNRESET` on the third) rather than on the feature itself — see Friction.

## Where the step-1 plan was wrong

**The JWT/role decision was wrong, and no checkpoint caught it before code existed.** My step-1 plan stated: "AuthenticatedUser/the JWT payload gains a role claim (today it only carries sub)" as decision #3. Backend-engineer's own detailed pure-layers plan carried the same design forward unchanged, down to the concrete `AuthenticatedUser`/`JwtAuthGuard`/`RolesGuard` shapes. I relayed that plan to the user at the step-3 checkpoint (condensed, but the role-in-JWT mechanism was present in the summary: "a `role` claim newly added to the JWT payload and `AuthenticatedUser`"). The user approved the plan at that checkpoint — but only flagged the delete-strategy issue (hard vs. soft), not the token issue. The JWT correction arrived later, as a separate chat message, by which point backend-engineer had already written `AuthenticatedUser`, `CurrentUser`, `JwtAuthGuard`, and `RolesGuard` with role baked into the token. The information needed to catch this *was* in the relayed plan, but phrased as an implementation mechanism ("gains a role claim") rather than surfaced as a security-relevant design choice — nothing about how I presented it drew the user's attention to it specifically. See Friction below and the suggestion at the end.

**The delete-strategy checkpoint worked exactly as designed, in contrast.** Backend-engineer's plan defaulted to hard delete, reasoned about but not the right call; my step-1 plan hadn't committed to either. Relaying the plan at the step-3 checkpoint caught it before a single line of the aggregate existed, and the fix (soft delete + a hand-added partial unique index) cost nothing beyond a `SendMessage` correction. This is the version of the checkpoint working.

**The register-response shape (`POST /api/users` returning `{id}` vs. `void`) was never specified at the step-1 altitude, correctly.** QA's automation reasonably assumed a created-resource id would come back (`body.id`); backend-engineer's independent plan and implementation didn't specify a return type and defaulted to `void`. Both are individually reasonable; step 1's "high-level plan" deliberately doesn't get this granular ("the endpoints and their problem types" only covers *error* shapes, not success-response bodies), and this is exactly the kind of divergence the workflow expects guardrails/integration to surface rather than something step 1 should have predicted. It surfaced there — 3 acceptance scenarios failing identically at guardrails round 2 — and was fixed in one routed pass. Not a plan failure; a correctly-deferred detail.

## Guardrails

Four rounds; the first pass was **not** green.

| Round | Failure | Routed to | Fixed first try? |
| --- | --- | --- | --- |
| 1 | `run-acceptance-tests` — backend test stack unhealthy. `DefaultAdminSeeder` ran at boot before migrations existed, an unhandled Prisma `P2021` crashed the whole Nest process. | backend-engineer | Yes — plus a self-found bonus fix: `EventBus.publish()` is fire-and-forget, so the truncate endpoint could return before the seeder's re-seed actually finished, a race that would have caused intermittent login failures at the start of scenarios. Replaced with an awaited `PostTruncateHook`. |
| 2 | `run-acceptance-tests` — 3/29 `registring-user.feature` scenarios failed (edit, delete, edit-into-duplicate-username), all `PATCH`/`DELETE users/undefined` → 404. Root cause: `POST /api/users` returned no body, so QA's `body.id` capture was `undefined`. | backend-engineer | Yes. |
| 3 | `run-acceptance-tests` — 1/29 scenario failed (edit-success assertion expected HTTP 200; `PATCH` correctly returns 204). | qa-engineer | Yes. |
| 4 | Clean. All 8 CI-mirroring checks plus the full acceptance suite (174 scenarios total, `registring-user.feature` 29/29 successful, everything else `pending` as expected for not-yet-automated features). | — | — |

No single failure ever required a second routed attempt — the workflow's three-strikes cap was never approached, despite four rounds total.

## Friction

- **Session-limit interruptions dominated the run's wall-clock cost.** backend-engineer hit the session limit twice, qa-engineer once, and frontend-engineer once (plus a separate `ECONNRESET` on frontend-engineer). Each required a full "status check — here's exactly what's already in place, continue from X" resume message rather than a bare "continue," to avoid the resumed agent re-deriving or duplicating work it couldn't see the result of. This is squarely a "Cost" item (see below), but it's worth naming as friction too: a run during a period of tight session limits should expect this pattern and budget attention for it, not treat it as anomalous.
- **The JWT/role correction landed mid-flight, after the relevant checkpoint had already passed.** Belongs to the step-3 checkpoint specifically: when relaying a subagent's plan for approval, a security-relevant mechanism decision (what a bearer token carries, what gets persisted, what's exposed) got folded into general architecture description rather than called out as its own, separately-flagged bullet. The user caught it anyway, but from their own security instincts on a later, unprompted read — not because my relay drew their eye to it.
- **I hand-edited five framework files myself instead of routing the JWT fix through backend-engineer**, because both the JWT-correction resume and the previous soft-delete-approval resume had failed with the same session-limit error, and I judged that leaving a partially-wrong, already-approved design sitting in the working tree while waiting on an uncertain resume was worse than making the (small, well-scoped) fix directly and verifying it myself (`tsc --noEmit` + the existing Jest suite) before resuming the agent with a status recap. This was the right call under the circumstances, but it's a real deviation from "the owning agent implements its own layer," which the workflow's project-boundary rules exist to prevent in the general case — worth naming rather than letting it pass as unremarkable, since a future run might reach for it too readily.

## Cost

Figures below are agent-self-reported per completed leg (each session-limit resume started a fresh reporting leg; failed legs reported no usage at all, so totals are a floor, not exact). Orchestrator step counts are my own tally of tool invocations from this conversation's transcript, not an automated log — reasonably accurate, not claimed exact.

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock (agent-reported, summed) |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 1 | 2 | 298 (2 of 3 legs reported; 1 failed leg unreported) | 725,185 | ~21.8 min |
| backend-engineer | 1 | 6 | 1,084 (5 of 7 legs reported; 2 failed legs unreported) | 1,561,902 | ~70.9 min |
| frontend-engineer | 1 | 2 | 382 (1 of 3 legs reported; 2 failed legs unreported) | 524,672 | ~15.8 min |
| orchestrator (steps 1, 7) | — | — | ~6 (step 1) + ~11 (step 7, including the commit itself) | — | — |
| guardrails (step 6) | — | — | ~19 (4 `make run-guardrails` rounds, log inspection, `sync-api-contract`, container teardown) | — | — |

**backend-engineer dominated cost** by a wide margin — over half the total reported subagent tokens and tool uses across all three agents, and by far the most session-limit interruptions (2 of the run's 3 such failures). The largest **avoidable** cost was the JWT/role rework: backend-engineer wrote `AuthenticatedUser`/`CurrentUser`/`JwtAuthGuard`/`RolesGuard` once with role-in-token, then had to have all four re-touched (by me directly, then reconciled with the agent) once the design changed — work that a correction landing *before* the step-3 checkpoint's approval, rather than after code existed, would have avoided entirely.

## Suggested improvements

- **Observation:** the JWT/role decision was present in the plan relayed at the step-3 checkpoint but phrased as an implementation detail, and the user only caught the problem later, unprompted, after code already existed to redo. **Belongs in:** step 3 (the backend pure-layers checkpoint). **Concrete change:** add a line to step 3's checkpoint instructions — "When relaying the plan, list any decision that determines what a token, session, or persisted record carries or exposes as its own explicit bullet (e.g. 'Token contents: X'), separate from the general architecture description, even if it's just one line — don't let it ride inside a paragraph about guard/decorator mechanics."

- **Observation:** two of three subagents lost significant, already-completed work to session-limit failures mid-task, requiring hand-written "here's exactly what's already done, continue from X" recovery messages each time; getting this wrong risks duplicated or contradictory work. **Belongs in:** the top-level "How this works" section. **Concrete change:** add: "If a dispatched agent's turn ends in `status: failed` with a session-limit or connection error rather than a normal completion, treat the resume message as mandatory scaffolding, not an afterthought: state plainly what was interrupted, summarize (from `git status`/`git diff`, not memory) exactly what already exists on disk, and say explicitly what to do next — never send a bare 'continue' after this kind of failure."

- **Observation:** I edited framework code directly rather than through backend-engineer, once, because the agent was unreachable and the fix was small and time-sensitive — a reasonable call, but the workflow has no stated policy on when the orchestrator may do this. **Belongs in:** the top-level "How this works" section, near "Never cross project boundaries." **Concrete change:** add a narrow, explicit escape hatch: "The orchestrator may edit a project's files directly, bypassing the owning agent, only when: the owning agent is unreachable (a failed dispatch that resuming doesn't fix) *and* the fix is small enough to verify with that project's own tools (typecheck, unit tests) before resuming the agent. Always tell the agent what was changed and why in the next message to it, so it doesn't redo or contradict the fix. This should stay rare — prefer waiting for the agent whenever the situation allows it."

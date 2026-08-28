# Retro: registring-standard-bom.feature

| Field | Value |
| --- | --- |
| Date | unknown start (session began mid-run, before my visible context) → 2026-08-27 02:06 +0330 (push) |
| Invoked as | `acceptance-tests/specs/bom-registration/registring-standard-bom.feature --auto --retro Take a look at other feature files in for getting the big picture of the whole domain. in a standard bom the standard weights of materials (driven from the its product) should be determined. weights are in gram. changes to its relations should not affect it, they should be cloned for registring, for instance if a new component added to its product the registered standard boms will be unchanged Work directly in the current directory, on whatever branch is already checked out here — do not create a git worktree.` |
| Mode | Auto |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all inherited (no `model:` frontmatter on any `.claude/agents/*.md`, no override passed to `Agent()`) |
| Claude Code | 2.1.239 |
| Branch / commit | `main`, `c860dd3` — pushed |
| Feature | `acceptance-tests/specs/bom-registration/registring-standard-bom.feature`, 20 scenarios (confirmed by `--dry-run` and by the final guardrails run's own count) |
| Supersedes | — |

## The shape of the run

All nine steps ran; none were skipped. Step 1's plan was stated and acted on without a stop (auto mode). Step 2 (QA) was one dispatch. Steps 3+4 (backend) were one initial dispatch for domain+application followed by one `SendMessage` for infrastructure, on the same agent — the intended auto-mode shape. Step 5 (frontend) was one dispatch, plus `make sync-api-contract` run by the orchestrator itself first, as instructed. Step 6 (guardrails) needed **two** full `run-guardrails` passes: the first failed on 14/20 scenarios of this feature; recovery took two routed fixes (well under the three-strike cap) plus one direct, zero-risk edit by the orchestrator (below). Step 7 was a read-only diff review — nothing needed changing. Step 8 committed and pushed without a confirmation stop, per auto mode. This file is step 9.

## Where the step-1 plan was wrong

The plan's HTTP-surface guess (`POST/PATCH/DELETE /standard-boms`, `GET /standard-boms`) held almost exactly — backend built precisely that, and QA's independently-guessed contract matched it with zero deviations reported. That part of "decide the expensive-to-reverse things now" worked as intended.

What the plan never pinned down: **whether a Standard BOM's cloned composition can be further edited after cloning** — can a user add an extra component/material beyond what the chosen product currently has? The plan's own "decisions that are expensive to reverse" bullet asked for "what the read model looks like" but not this. Left unresolved, it was answered twice, independently, by two agents that never saw each other's answer:

- QA (dispatched first, before either UI or backend existed) guessed **yes** — wrote `addComponentButton`/`addMaterialButton`/per-row `mat-select` locators, and test-data flows that register brand-new, unrelated master components/materials via the API and try to attach them to an already-registered standard BOM.
- backend-engineer (independently) built the **correct** answer implied by the cloning invariant itself: `StandardBomCompositionFactory` rejects any `(componentId, materialId)` that isn't part of the referenced product's *current* composition — so QA's approach could never have worked against the real system regardless of what the UI looked like.
- frontend-engineer (independently, reading the backend it had just been handed) built a fully-cloned, weight-only-editable composition with no add affordance at all — the design that actually matches the invariant.

That three-way mismatch (plus a heading-text guess that also differed, `مدیریت آنالیز استاندارد` vs `مدیریت آنالیزهای استاندارد`) is what caused every one of the first run's 14 failures. It was a single missing sentence in the step-1 plan, not three separate small mistakes.

## Guardrails

**Round 1** (`make run-guardrails`): `lint-api-contract`, `format`, `lint-styles`, `lint`, `lint-architecture`, `lint-swagger`, `run-unit-tests`, `lint-accessibility` all passed on the first try. `run-acceptance-tests` failed: 14/20 scenarios in this feature, all `AssertionError: Timeout ... waiting for page heading to become visible` — the accessible-name mismatch above.

Routed to **frontend-engineer** first (align copy to QA's locators) — that dispatch **terminated mid-task on an account/session usage-limit error** before making any change; it never appeared in a later `ListAgents` listing, so it could not be resumed. Rather than retry blindly or stall, the orchestrator:
1. Read QA's Lean Page Object and the actual frontend components directly, and found the mismatch was structural (control type, addability), not just text.
2. Applied the one genuinely trivial, zero-risk part itself — the heading-text string — since the owning agent was unreachable and a one-line copy fix carried no real risk of crossing project boundaries in spirit.
3. Routed the substantive correction to a **freshly dispatched** qa-engineer (not a resume — the original was gone). That dispatch fixed the assumed control types and composition-editability model, and its own live-stack verification pass surfaced a further, genuine defect: `PATCH /standard-boms/:id` clearing `standardLength` returned a raw 500 instead of a 400.
4. Routed that to a **freshly dispatched** backend-engineer (same reason — the original agent was also gone by then), which fixed it cleanly (a `class-validator` `@IsOptional()`-vs-`null` gap, the same class of bug `products/CLAUDE.md` already documents for a different field).

**Round 2**: full `run-guardrails` green, including 20/20 on this feature and no regressions elsewhere. Two routed fixes used, cap not hit.

## Friction

- **Step 5's dispatch never pointed frontend-engineer at QA's own Lean Page Object.** `acceptance-tests/screenplay/ui/standard-boms-page.ts` already existed by the time frontend-engineer was dispatched, and every locator in it was explicitly commented `ASSUMPTION` — written that way precisely so a later implementer could reconcile against it. The step-5 dispatch template only said "look at the existing 'new product' UI slice as your closest template"; it should also have said something like: *"Before designing markup, read `acceptance-tests/screenplay/ui/<feature>-page.ts` and `screenplay/<area>/<feature>-form.ts` in full — every locator QA wrote is commented `ASSUMPTION` about markup that didn't exist yet. Match your accessible names/roles to them where the assumption is reasonable; where you deliberately build something different (and say why in your report), the orchestrator will reconcile QA's side afterward."* This belongs in step 5 of `develop-feature`.
- **No guidance for a routed agent that's simply gone.** Step 6 assumes `SendMessage` always reaches the agent a failure is routed to. Here the frontend-engineer agent exited on a usage-limit error and never reappeared in `ListAgents`; the orchestrator had to improvise (dispatch fresh vs. fix directly) with no instruction to lean on. Worth a line in step 6: *"If the owning agent isn't reachable in `ListAgents`, dispatch a fresh one with full context rather than waiting or resuming a dead reference; the orchestrator may make a trivial, single-line, zero-risk fix directly only when no agent is reachable, and must say so plainly in the final report."*
- **What worked well, worth keeping**: QA's discipline of marking every one of its UI locators as an explicit `ASSUMPTION`, each with a one-line rationale, made the round-2 corrective dispatch fast to write precisely — the dispatch prompt could quote exact lines and exact reasons rather than re-deriving them. This is the reason round 2 needed only two routed fixes instead of more.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 2 | 2 | 269 | 736,542 | ~81 min |
| backend-engineer | 2 | 3 | 220 | 626,376 | ~30.6 min |
| frontend-engineer | 1 | 2 (1 completed, 1 terminated on a usage-limit error mid-task, no usage reported) | 283 (completed dispatch only) | 423,637 (completed dispatch only) | ~41 min (completed dispatch only) |
| orchestrator (steps 1, 6 direct fix, 7) | — | — | ~45 (estimate from visible tool calls; not instrumented) | — | — |
| guardrails (step 6) | — | — | 3 (`fix-violations` ×1, `run-guardrails` ×2) | — | round 2's acceptance-suite portion alone: 2m 49s; full chain not separately measured |

The largest single dispatch was frontend-engineer's initial UI build (~41 min, 423,637 tokens) — expected, since it's the only step that opens a real browser and drives it end to end. The largest **avoidable** cost was the round-2 recovery: qa-engineer's corrective dispatch alone (~51 min, 396,403 tokens) plus backend-engineer's bug-fix dispatch (~4.4 min) plus the orchestrator's own investigation time — nearly all of it downstream of the one missing sentence in step 5's dispatch template above. Pointing frontend-engineer at QA's `ASSUMPTION`-commented locators up front would very plausibly have prevented the composition-editability and control-type mismatches, if not the heading string itself.

## Suggested improvements

1. **Add a decision to step 1's plan template**: when a feature clones data from another aggregate (as this one clones a product's composition), the plan should explicitly state whether the clone is further editable post-registration, not just what gets cloned. *Observation source: "Where the step-1 plan was wrong," above.*

2. **Add to step 5's dispatch template** (`develop-feature`, step 5): *"Before designing markup, read `acceptance-tests/screenplay/ui/<feature>-page.ts` and its companion `<feature>-form.ts` in full — every locator QA wrote is commented `ASSUMPTION` about markup that didn't exist yet when they wrote it. Match your accessible names/roles to them where the assumption is reasonable; where you deliberately build something different, say so and why in your report so the orchestrator can reconcile QA's side."* *Observation source: "Friction," first bullet.*

3. **Add to step 6** (`develop-feature`): *"If the agent a failure is routed to isn't reachable in `ListAgents` (dispatches can terminate on account-level usage limits, not just task failures), dispatch a fresh one with full context rather than resuming a dead reference. The orchestrator may make a trivial, single-line, zero-risk fix directly only when no agent is reachable for that project, and must disclose doing so in the final report."* *Observation source: "Friction," second bullet.*

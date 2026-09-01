# Retro: exporting-bom.feature (daily BOM Excel export)

| Field | Value |
| --- | --- |
| Date | 2026-09-01 (exact wall-clock span not recorded — no start/end timestamps captured; see Cost) |
| Invoked as | `/develop-feature acceptance-tests/specs/bom-reporting/exporting-bom.feature --auto --retro the export should contain the whole availbe data in the database, not only the data shown in web with pagination. examine the exported excel file. Work directly in the current directory, on whatever branch is already checked out here — do not create a git worktree.` |
| Mode | Auto |
| Orchestrator model | Sonnet 5 (`claude-sonnet-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer — all inherited (no `model:` frontmatter in any of the three `.claude/agents/*.md`, no `model` override passed to any `Agent` call) |
| Claude Code | 2.1.257 |
| Branch / commit | `main` @ `0d273b0`, pushed |
| Feature | `acceptance-tests/specs/bom-reporting/exporting-bom.feature`, 4 scenarios |
| Supersedes | — |

## The shape of the run

Ran the full outside-in flow: step 1 (research + plan, no checkpoint since auto), steps 2+3 (QA and
backend dispatched in parallel), step 4 folded into the backend dispatch (this was a pure read-side
addition — no separate "infrastructure" pass was needed, so I merged what would have been steps 3+4
into one backend dispatch), step 5 (frontend), step 6 (guardrails, two `fix-violations` rounds then
one `run-guardrails` round), step 7 (review — read-only, no refactors applied), step 8 (commit +
push), step 9 (this file).

One deliberate addition beyond the skill's own steps: the user's free-form note ("examine the
exported excel file") wasn't provable by the feature's own tiny background dataset (4 BOMs, well
under one page), so after guardrails went green I brought the dev stack up by hand, registered 25
daily BOMs via the API, and diffed a paginated `POST /boms/report` call (20 items, `total: 25`)
against the new `POST /boms/report/export` call (25 items) to prove the fix at a scale the acceptance
suite structurally can't reach. Then cleaned the synthetic data back out and brought the stack down
again.

## Where the step-1 plan was wrong

Almost nowhere, on the two decisions that mattered most for reconciling three parallel agents:

- **The HTTP contract held with zero deviation.** The plan pinned `POST /boms/report/export`, the
  exact `ExportBomsDto`/`BomExportItem` field names, and "no `@Roles()`" before any agent started.
  backend-engineer's own report said "No deviation from the spec you gave me," and frontend's/QA's
  generated types matched on the first `make sync-api-contract`. This is the plan doing its actual
  job — the one place a wrong call would have been expensive to unwind across three agents, and it
  wasn't wrong.
- **The client-side-Excel-generation decision held too.** The plan's reasoning (no Jalali code in the
  backend; reuse the frontend's existing dependency-free formatter rather than write a third copy)
  was accepted by frontend-engineer without pushback and is exactly what got built.
- **What the plan correctly declined to pin**: the exact UI control shape (menu vs. two buttons) and
  the xlsx library choice. Both were left to QA's/frontend's judgment with an explicit reconciliation
  step (frontend told to read QA's `ASSUMPTION`-tagged locators). QA guessed a single "خروجی اکسل"
  button opening a menu with one item per format; frontend matched it exactly. This is the one place
  the plan *could* have over-specified and deliberately didn't — worth remembering as the right call,
  not just as something that happened to work.
- **One implementation detail the plan had no way to anticipate**: frontend-engineer's first attempt
  at the download trigger was a plain exported function, mockable with `vi.mock`; Angular's
  `@angular/build:unit-test` refuses `vi.mock` on a relative import outright, so it was rebuilt as an
  injectable `XlsxDownloader` service. This isn't a plan error — it's a framework-tooling constraint
  three levels below anything step 1 reasons about — but it's the only real course-correction that
  happened anywhere in this run.

## Guardrails

- **Round 1 (`make fix-violations`)**: failed in `acceptance-tests` — 8
  `@typescript-eslint/no-unsafe-*` errors in `screenplay/common/downloads.ts` on the
  `readSheet(buffer)` call and its downstream `.map`s. Routed to qa-engineer (see Friction below for
  how). Diagnosis: not a code defect — a stale anonymous `node_modules` Docker volume that predated
  `read-excel-file` being added to `package.json`, reproduced by deliberately removing the package
  from the running container and getting byte-identical errors back, then restored. This is a gotcha
  already documented in `acceptance-tests/CLAUDE.md` ("the long-lived container needs
  `--renew-anon-volumes`"). No source file changed.
- **Round 2 (`make fix-violations` retry)**: clean across all three projects.
- **`make run-guardrails`**: green on its first (and only) invocation — all 9 checks, 174 scenarios,
  including all 4 `exporting-bom.feature` scenarios passing and the 4 (out-of-scope,
  `exporting-standard-bom.feature`) scenarios correctly still `pending`.

So: one real guardrails round-trip, caused by container staleness rather than agent work, resolved
without touching source.

## Friction

- **Orchestrator process error, in the "Guardrails" section's own rule.** When routing the
  `downloads.ts` lint failure, I dispatched a fresh `Agent(qa-engineer, ...)` instead of
  `SendMessage`-ing the already-running qa-engineer's `agentId` (`a470f4f1949c4e554`) — exactly the
  thing "How this works" says never to do ("Never open a second `Agent` call for a project you
  already dispatched — that throws away everything it has built up"). It happened to work out (the
  prompt carried the full error text and file path, and the fresh agent diagnosed the stale-volume
  root cause correctly), but it was luck, not design — a `SendMessage` would have let the agent reuse
  everything it already knew about `downloads.ts` rather than re-deriving context from a cold start.
- **Host-side LSP noise, not a "Guardrails" problem but adjacent to it.** Every subagent turn
  triggered a burst of `<new-diagnostics>` system-reminders — "Cannot find module '@nestjs/...'" /
  "'@angular/...'" / "'vitest'" — because this host's own language server has no access to any
  project's Docker-only `node_modules`. These are 100% false positives (confirmed repeatedly by the
  agents' own in-container `tsc`/lint runs going clean), but each burst cost a moment of "is this
  real?" triage, and once a stale-cache diagnostic referenced a file (`smoke-test-download.ts`) that
  QA had already deleted and reported as cleaned up, which took an explicit `find`/`git status` to
  rule out as a real leftover.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| qa-engineer | 2 (1 initial `Agent`, 1 fresh `Agent` that should have been a `SendMessage` — see Friction) | 0 | 301 | 421,402 | ~53 min (35.9 + 17.4, sequential) |
| backend-engineer | 1 | 0 | 55 | 136,203 | ~5.5 min |
| frontend-engineer | 1 | 0 | 213 | 326,678 | ~31 min |
| orchestrator (steps 1, 7) | — | — | ~30 (research reads/greps in step 1; diff review in step 7) | — | — |
| guardrails (step 6) | — | — | ~10 (2× `fix-violations`, 1× `run-guardrails`, 2× `make down`) | — | 6m52s recorded for the acceptance-suite portion alone (from its own summary); the other 8 checks' individual durations weren't captured, and `run-guardrails` exceeded the 600s foreground timeout and finished in the background |

qa-engineer dominates by tokens and tool-uses, split across two dispatches for one project — the
second dispatch (the misrouted lint fix) is the largest **avoidable** cost in this run: a
`SendMessage` to the existing agent would have skipped whatever context-rebuilding the fresh agent
did before it could even start reproducing the failure (it re-read `downloads.ts`, the tsconfig, and
re-derived the module-resolution question from scratch before finding the real, unrelated cause).

## Suggested improvements

- **Observation**: the misrouted lint-fix dispatch (Friction, Cost). **Section**: "Steps → 6.
  Guardrails" and "How this works." **Concrete change**: add a sentence directly in step 6's routing
  bullet, not just relying on the general rule stated earlier in the doc: "Before calling `Agent`
  here, re-check the agentId table from steps 2/3/5 — routing a guardrails failure is exactly the
  moment this rule is easiest to forget, because the failure is fresh and the temptation is to just
  describe it to a new agent from scratch."
- **Observation**: repeated false-positive `<new-diagnostics>` bursts from a host LSP with no
  Docker-only `node_modules` visibility (Friction). **Section**: "How this works" or a new
  environment note. **Concrete change**: a standing note such as "This repo's dependencies are
  Docker-only; expect `<new-diagnostics>` noise (`Cannot find module '@nestjs/...'`/`'@angular/...'`)
  after every subagent turn that touches `backend/`or `frontend/` or `acceptance-tests/` — treat it
  as real only if a subagent's own in-container `tsc`/lint run also fails" would have let me skip the
  couple of verification round-trips spent confirming each burst was noise.
- **Observation**: the feature's own background dataset (4 BOMs) can never exercise the exact bug the
  user asked about (pagination truncating an export), so guardrails going green doesn't by itself
  answer the user's question. **Section**: "Steps → 6. Guardrails" or a new step between 6 and 7.
  **Concrete change**: when a user's free-form note describes a behavior at a scale the feature's own
  fixture data can't reach, make the "prove it at scale" pass (register N+1 pages of data, diff
  paginated vs. unpaginated, clean up) an explicit optional step rather than something the
  orchestrator has to notice and improvise on its own — e.g. "if the user's notes describe a
  data-volume-dependent behavior the feature's own background can't exercise at the size it's
  written, do a throwaway scale check against the dev stack after guardrails go green, and clean up
  after."

# Run retro — `approving-bom`

## Run metadata

| Field | Value |
| --- | --- |
| Date | 2026-10-20T21:03:16Z → 2026-10-21T09:12Z (~12h wall-clock, most of it one frontend dispatch that ran ~6h overnight and three session restarts) |
| Invoked as | `/develop-feature @acceptance-tests/specs/bom-analyzing/approving-bom.feature "This changing of behavior affected other existing specs as well which you can find in git staged; those scenrios are also has to be implemented. current daily boms in the system are unapproved by default so consider this in the migration" --retro --auto` |
| Mode | Auto |
| Orchestrator model | Opus 5.5 (`claude-opus-5-5`) |
| Subagent models | qa-engineer, backend-engineer, frontend-engineer, book reviewer, code reviewer — all inherited (no `model:` override passed on any dispatch) |
| Claude Code | 2.1.289 |
| Branch / commit | `main` / this run's `feat(boms)` commit (pushed) |
| Feature | `acceptance-tests/specs/bom-analyzing/approving-bom.feature` (9 scenarios/outlines, 15 examples), plus the user-edited `bom-dashboard`, `reporting-bom`, `exporting-bom`, `exporting-standard-bom` and `viewing-audit-log` features |
| Supersedes | — |

## The shape of the run

Every step ran in auto mode: design and plan, then QA and backend in parallel against a pinned wire contract, a book review of the backend's pure layers, infrastructure, then the frontend. Next came guardrails (three full rounds) and a code review whose accepted fixes went through the owners, then CLAUDE.md updates, this retro and three commits.

The change is approval as state on the existing `Bom` aggregate. A `BomApproval` value object keeps the status and the approver consistent by construction. `approve` and `revokeApproval` are no-ops in the same state, and the handlers skip `save()` when nothing changed. An edit that changes something resets the approval and appends the `approvalStatus`/`approvedBy` lines to the same `BomEdited` audit entry. The migration adds `approval_status TEXT NOT NULL DEFAULT 'unapproved'` and a nullable `approved_by`, so every existing daily BOM is unapproved (the user's note). Report, export, detail and dashboard reads all carry the status and the approver. The report gets two filters, the export's perBom layout moves to the shared `جز n / مواد اولیه n / وزن n` slot columns, and the dashboard gets per-card approve/revoke plus inline weight edit.

## Where the step-1 plan was wrong

1. **It named a field that wasn't on the wire.** The dashboard row was specified to carry `bomId`, but the existing response already used `id`. The backend kept `id`, and the plan's table was wrong from the start.
2. **`null` vs `''` for "no approver" was decided twice, differently.** The plan put `approvedBy: null` in audit change lines. The audit module's existing convention is `''` for an absent value. The backend followed the convention, so QA's first draft and the plan disagreed.
3. **`updateComponents()` doesn't exist.** The plan told the domain to reset approval in `edit()` / `updateComponents()`. Only `edit()` exists, and it covers the composition too.
4. **Audit labels were placed on the frontend.** Task F3 asked the frontend to translate `approvalStatus`/`approvedBy`. The feature's audit details are API-voiced, and the field labels already resolve where the existing ones do. F3 shrank to action labels and value display.
5. **F2 said "refresh score after save" on a page that shows no score per card.** The frontend did a reload that restores focus instead.
6. **The standard-BOM export path in the contract table was a guess.** It happened not to matter, because the shared framework helper was the real change point (decision 7 was right).
7. **The approver filter had a trap the plan didn't see.** "Absent = unfiltered" meant that ticking every named approver sent no filter at all, so unapproved rows with no approver still showed. It surfaced as a round-1 acceptance failure. The fix was a «بدون تایید کننده» option sent as `''`, which the backend reads as `IS NULL`.

## Guardrails

- **Round 1** (`make run-guardrails`, 23:58 → ~00:31): every check green up to acceptance, which had 8 of 208 scenarios red, all routed to the frontend.
  - 7 were the /boms actions-menu button. The new 10-column table overflowed and scrolled the button off-screen. Fixed with `stickyEnd` on the actions column.
  - 1 was the approver-filter trap above. It also needed a backend change (`''` → `IS NULL`).
- **Round 2** (07:15 → 07:37): green through format, lint-styles, lint, lint-architecture, lint-swagger, unit and integration. It then failed in `lint-accessibility`'s image build on a Docker Hub TLS handshake timeout. This was environmental: I had just pruned the builder cache to recover disk, so the base images had to be re-pulled. A retry loop pulled `node:24-bookworm-slim` and `nginx:1.27-alpine` after about ten timeouts.
- **Round 3** (08:08 → ~08:45): all ten checks green, including acceptance at 208/208. The frontend's last cleanup (deleting the unused `ui/weight-difference/`, its CLAUDE.md edit) landed mid-run. Format, lint-styles, lint, unit and the contract check were re-run on the final tree afterwards.

## Friction

- **Three session restarts**, and after each, files changed under an agent I had just resumed. I call this the "phantom writer". A peer session (cablan-14) confirmed it had dispatched nothing. The likely cause is the interrupted run's in-flight writes landing after the resume. Declaring a single owner per tree settled it, but it cost a round of confused messages. The backend also received an earlier, conflicting instruction about one review item and needed a final consolidated message.
- **The Agent tool has no foreground mode here**, so every dispatch ran async. Ordering steps (contract sync before the frontend, review fixes before guardrails) depended entirely on completion notifications, and the restarts dropped some of them.
- **QA refused to edit its own `acceptance-tests/CLAUDE.md`** at step 8, reading the instruction as outside its authorization. It produced exact replacement text instead. I applied it verbatim with a script, as an orchestrator direct edit, disclosed.
- **Disk.** Free space fell to 3.7 GB mid-run. Pruning volumes and the builder cache reclaimed about 11 GB, but that is what caused round 2's TLS failure: every base image had to come back from Docker Hub on a flaky link.
- **The guard hook forbids hand-editing migrations**, so the code review's "add a CHECK constraint on `approval_status`" could not be done without a schema-level construct Prisma doesn't express. It was skipped, and the domain value object is the only guard.

## Cost

| Agent / step | Dispatches | Messages | Tool uses | Tokens | Wall clock |
| --- | --- | --- | --- | --- | --- |
| backend-engineer | 1 | 5 | 37 + 11 + 112 + 3 + 5 + 9 + 9 (review fixes) = 186 | — | ~1260 + 552 + 3183 + 531 + 672 + 1263 s ≈ 2h05m |
| qa-engineer | 1 | 4 | 5 + 7 + 7 after resumes (interrupted first run not reported) | — | ~1150 + 216 + 241 s ≈ 27m, plus the interrupted first run |
| frontend-engineer | 1 | 7 | 4 + 3 + 27 + 5 + 6 = 45 (two interrupted runs not reported) | — | 151 + 714 + 21,437 + 1296 + 424 s ≈ 6h40m, of which ~6h was one overnight dispatch |
| book reviewer | 1 | 1 | 1 after resume | 98,571 after resume (first run unknown) | 21 s after resume |
| code reviewer | 1 | 0 | 40 | 158,928 | 190 s |
| guardrails | — | — | — | — | R1 ~33m, R2 ~22m (aborted on env), R3 ~37m |

The single most expensive item was the frontend's ~6h dispatch, which ran overnight across a restart. The approval feature itself was not large: the dashboard card refactor, inline edit with focus restore, and the move of the filter dialog into `ui/` all ran together in one turn with no checkpoint. The largest avoidable cost was round 2, caused by my own cache prune.

## Suggested improvements

1. **Observation**: plan errors 1–2 (`bomId` vs `id`, `null` vs `''`). **Section**: Where the step-1 plan was wrong. **Change**: in `/develop-feature` step 1, add: "Before pinning the wire contract, read the existing response DTOs and the audit module's change-line convention for every endpoint the table touches. Name only fields that exist, or mark them **new**."
2. **Observation**: plan error 7 (all approvers ticked meant no filter). **Section**: Where the step-1 plan was wrong. **Change**: add to the plan template's Review Focus: "For every new optional-value filter, state how a row with no value is selected, and what 'every option ticked' sends."
3. **Observation**: the phantom writer after restarts. **Section**: Friction. **Change**: in `/develop-feature`'s resume guidance, add: "After a session restart, `git status` each project tree and wait one notification cycle before resuming its agent. Resume exactly one agent per tree, and tell it the files changed since its last report."
4. **Observation**: QA's CLAUDE.md refusal. **Section**: Friction. **Change**: in the step-8 dispatch template, say outright: "You are authorized to edit your project's own `CLAUDE.md` in this step."
5. **Observation**: the disk prune causing round 2's failure. **Section**: Friction. **Change**: in the long-runs memory/notes, prefer `docker volume prune -f` and `docker image prune -f` (dangling only) over `docker builder prune -a`. Re-pull base images right after any builder prune, before starting guardrails.
6. **Observation**: the 6h frontend dispatch. **Section**: Cost. **Change**: in `/develop-feature` step 5, split a frontend task with more than one page into one dispatch per page (F1/F2/F3), each ending in its own unit run, so a restart loses one page's work, not all of it.

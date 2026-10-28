# Daily BOM edit reason and edit details — plan

Design: `docs/superpowers/specs/2026-10-28-daily-bom-edit-details-design.md`. Features:
`acceptance-tests/specs/bom-analyzing/daily-bom-edit-details.feature` (new), changed examples in
`bom-analyzing/approving-bom.feature` and `audit-logging/viewing-audit-log.feature`.

## Contract (pinned)

- `PATCH /api/boms/:id` body gains
  - `editReason?: string` — required non-blank (after trim) for an edit that changes something;
    otherwise **400** problem type **`edit-reason-required`**, nothing changes.
  - `editSource?: 'dailyBoms' | 'dashboard'` — default `'dailyBoms'`. `'dashboard'` by Management /
    SystemAdmin = review edit (management note); everything else = correction (edit details).
- New read shape `BomEditRecord`:
  `{ "editedBy": string, "editedAt": string /* ISO */, "reason": string, "heading": string, "changes": string[] }`
  where `heading` = `کاربر {editedBy} در {yyyy/MM/dd} ساعت {HH:mm} به علت {reason} تغییرات زیر را انجام داد`
  (Jalali, Asia/Tehran, Latin digits).
- `editHistory: BomEditRecord[]` on `GET /boms/:id`, on each `POST /boms/report` item, and on each
  `POST /boms/dashboard/:productId/daily-boms` item. Empty array when never corrected.
- `managementNote` on approval = for each review edit of the current review, `heading` then its
  change lines, all joined by `\n`.

## QA (acceptance-tests)

1. Step definitions for `daily-bom-edit-details.feature` in
   `step-definitions/bom-analyzing/daily-bom-edit-details.steps.ts`; reuse the existing Background
   steps; shared «اکنون {string} ساعت {string} باشد» in `common.steps.ts` (FreezeTimeAt on the
   Tehran instant, updates `systemClock`).
2. Update approving-bom's and viewing-audit-log's changed steps (`از داشبورد با دلیل …`,
   `editSource: 'dashboard'`; management note table compares with the heading; audit cell joins
   lines with «؛ »).
3. Every existing edit path gets a default reason: `PATCH` payloads in edit/precondition tasks send
   `editReason` (and `editSource: 'dashboard'` where the step says «از داشبورد» or the existing
   dashboard-edit preconditions); UI edit tasks fill «دلیل ویرایش».
4. UI tasks/questions: `/boms` edit dialog's «دلیل ویرایش»; row button «جزئیات ویرایش» and its
   dialog's list items; dashboard reason dialog and the card's «جزئیات ویرایش» list.

## Backend (boms module)

1. Domain: `EditReasonRequired` (`DomainException`, 400 `edit-reason-required`); `BomEditRecord`
   value; `Bom.edit(..., editor, editSource, reason, editedAt)` decides review vs correction,
   appends to edit history or pending review edits; heading renderer (Asia/Tehran Jalali) in the
   domain or a pure application service.
2. Application: `EditBomCommand` gains `editReason`, `editSource`, `editedBy`; handler passes
   `Clock.now()`. Read models gain `editHistory`.
3. Infrastructure: `UpdateBomDto` fields; controller resolves `editedBy` via `DisplayNameProvider`;
   migration adding `bom.edit_history JSONB DEFAULT '[]'` and adapting `pending_review_changes`;
   mapper/column readers; report/detail/dashboard repositories select it; exception mapping; OpenAPI
   regenerated; unit + integration specs (`bom-approval.int-spec.ts` updated).

## Frontend

1. `make sync-api-contract` (orchestrator).
2. `/boms` form dialog: «دلیل ویرایش» textarea in edit mode (incl. preview edit), server error
   «نوشتن دلیل ویرایش لازم است».
3. `/boms` list: «جزئیات ویرایش» row button + dialog listing every line.
4. Dashboard card: reason dialog for inline weight edit, reason field in description dialog,
   `editSource: 'dashboard'`; inline «جزئیات ویرایش» list.
5. Specs; a11y unchanged routes, dialogs keep labels.

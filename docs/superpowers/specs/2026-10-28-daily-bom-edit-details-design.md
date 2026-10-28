# Daily BOM edit reason and edit details (دلیل و جزئیات ویرایش) — design

**Date:** 2026-10-28 · **Mode:** auto · **Issue:** #73 · Gherkin approved in the issue (latest
`<!-- cablan:gherkin-proposal -->`, approved by the stakeholder), added as
`acceptance-tests/specs/bom-analyzing/daily-bom-edit-details.feature` plus the changed scenarios in
`bom-analyzing/approving-bom.feature` and `audit-logging/viewing-audit-log.feature`.

## Capability

Every edit of a daily BOM that really changes something needs a written reason, whoever makes it and
wherever it is made. The system keeps three separate texts:

1. **توضیحات** — the description entered at registration (unchanged).
2. **جزئیات ویرایش** (edit details) — one record per *correction* edit, i.e. an edit from the daily
   BOMs page (`/boms`) or from the post-registration preview: who, when (Jalali date and time), why,
   and one line per change. A new record is appended after the previous ones. Every user sees them,
   on `/boms` and on the dashboard.
3. **توضیحات مدیریت** (management note) — only for a *review* edit, made by a reviewer (Management,
   SystemAdmin) on the dashboard before approving. The note now carries the same heading (reviewer,
   time, reason) above the change lines. A review edit never enters the edit details; a correction
   edit — even by a reviewer — never enters the note.

A save that changes nothing is not an edit: no reason needed, nothing recorded, no audit event, the
review left alone (already true today for the last two).

## Scenarios

`daily-bom-edit-details.feature`:
- UI-voiced (active `When`s): «… از لیست آنالیز های روزانه با دلیل … تغییر می دهد» (outline + the
  detail examples), «… از داشبورد با دلیل … تغییر می دهد», «… از پیش نمایش … با دلیل … تغییر می
  دهد» (two examples), «… جزئیات آنالیز روزانه … را مشاهده می کند» (all five users),
  «… آنالیز روزانه … را در داشبورد مشاهده می کند».
- API: the refused «تلاش می کند …» attempts (400 `edit-reason-required`), the no-change save, the
  dashboard edit-then-approve, the passive `Given`s, and every `Then` that reads a fact
  (`GET boms/:id`, audit log).
- New shared `Given`: «اکنون "1403/06/15" ساعت "10:00" باشد» — freezes the backend clock (and the
  suite's mirror) at that Jalali date-time in **Asia/Tehran**.

`approving-bom.feature` (API throughout, as today): the management-note examples now edit
«از داشبورد با دلیل …» and expect the heading line; new «ویرایش مدیریت از صفحه آنالیز های روزانه در
توضیحات مدیریت نمی آید». `viewing-audit-log.feature`: the approval event's note carries the heading
(the Gherkin cell joins the note's lines with «؛ »; the stored note keeps `\n`).

## Decisions

1. **Behaviour on the existing `Bom` aggregate**, not a new module: the reason requirement and both
   histories are invariants of the edit the aggregate already performs in one transaction.
2. **One endpoint, two new body fields** on `PATCH /boms/:id`:
   - `editReason?: string` — trimmed, digits normalised like the description. An *effective* edit
     with a missing/blank reason throws `EditReasonRequired` → **400 `edit-reason-required`**; the
     BOM is untouched (status and review included). Checked only once the edit is known to change
     something, so a no-change save without a reason is a 200 that records nothing. Like
     `RejectBomDto.reason`, the DTO is only `@IsOptional() @IsString()` so a blank reason reaches the
     domain.
   - `editSource?: 'dailyBoms' | 'dashboard'` — default `'dailyBoms'`. An edit is a **review edit**
     iff `editSource === 'dashboard'` **and** the editor is a reviewer (`BOM_REVIEWER_ROLES`);
     otherwise it is a correction. (A non-reviewer cannot reach the dashboard's edit controls; if one
     sends `dashboard` anyway it is treated as a correction, not refused.)
3. **The heading is rendered by the backend**, in **Asia/Tehran** with Latin digits:
   `کاربر {editedBy} در {yyyy/MM/dd} ساعت {HH:mm} به علت {reason} تغییرات زیر را انجام داد`. The
   management note is stored text (and audited as such), so it must be rendered server-side; the
   edit details use the same renderer so the two can never disagree. Fixed zone, not the reader's:
   this is a stored record of when the plant saw the edit, and Cablan is an Iranian product.
   `editedBy` is the display name, resolved by the controller through `DisplayNameProvider` (as
   `registeredBy`/`reviewedBy`); `editedAt` comes from `Clock`.
4. **Change lines are today's management-note lines**, unchanged (`وزن جز … مواد اولیه … از … به …
   تغییر کرد`, scalar fields first, then composition order).
5. **Edit details** are persisted on the BOM as a new JSONB column `bom.edit_history` (default
   `[]`), append-only, one record `{ editedBy, editedAt, reason, changes: string[] }` per effective
   correction edit.
6. **Management note** = the review edits of the current review, **one block per edit** in order
   (heading + its change lines), joined with `\n`. This replaces today's per-field merge across
   edits (first-old / latest-new / back-to-start drops out): with a reason and a time per edit,
   folding two edits into one line would lose whose reason it was. The pending review edits stay in
   `bom.pending_review_changes`, now as a list of `{ editedBy, editedAt, reason, changes }`
   records; approving renders and clears them, rejecting uses the reason and clears them, and a
   correction edit **no longer clears them** (it is not part of the review). Legacy rows holding the
   old shape must still load — the migration converts them (or the column reader accepts the old
   shape and renders its lines without a heading); backend picks, and says which.
7. **Read side**: `GET /boms/:id`, every `POST /boms/report` item and every dashboard daily-BOM row
   (`POST /boms/dashboard/:productId/daily-boms`) carry
   `editHistory: { editedBy: string; editedAt: string; reason: string; heading: string; changes: string[] }[]`
   (`editedAt` ISO 8601, `heading` the rendered line). The UI shows `heading` then `changes`, one
   line each, record after record — it never formats the date itself.
8. Audit log: `BomEdited` and its audit entry are unchanged (no reason column); the approval event's
   `managementNote` change line carries the new note text.

## UI scope

- `/boms` edit dialog (also used by the preview's «ویرایش»): a textarea **«دلیل ویرایش»** in edit
  mode only (not registration, not re-sampling), sent as `editReason`. A 400
  `edit-reason-required` shows «نوشتن دلیل ویرایش لازم است» on that field and keeps the dialog
  open.
- `/boms` list: rows with a non-empty `editHistory` get a button **«جزئیات ویرایش»** opening a
  dialog titled «جزئیات ویرایش» that lists every line (heading, changes, next heading, …) as list
  items, one per line. Visible to every role, including the reporter.
- Dashboard card: inline weight edit and description dialog both ask for **«دلیل ویرایش»** before
  saving (weight: a small dialog with that textarea and «ثبت»/«انصراف»; description dialog: an extra
  field), sent with `editSource: 'dashboard'`; the same server error is shown in the dialog. A card
  whose BOM has edit details shows them inline under a «جزئیات ویرایش» heading, one list item per
  line.

## Risks

- Every existing UI edit path (registring-bom's edit and preview edit, bom-dashboard's weight and
  description edits) and every API edit precondition in the suite now needs a reason — QA supplies a
  default reason where the Gherkin names none.
- Freezing the clock at 1403/06/15 (2024-09-05) moves it *back* from the scenario start
  (2026-01-01): BOMs registered before the freeze carry a later `createdAt`. A dashboard step that
  relies on a "today" date range must widen it or register after the freeze.
- Dropping the per-field merge changes the note of a BOM edited twice on the dashboard before one
  approval (two blocks instead of one merged line). No scenario covers the old merge; accepted.

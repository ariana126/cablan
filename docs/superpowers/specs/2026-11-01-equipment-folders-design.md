# Equipment technical files as digital folders — design (issue #92)

## Capability

«پرونده فنی تجهیزات» becomes the digital equivalent of the technical unit's per-machine binders.
`/pm-plans` opens on a board of folder-like cards, one per **active** registered equipment — whether
or not it has a PM plan — titled «تجهیزات فعال», searchable by name. Retired equipment sits in a
collapsed «تجهیزات کنار گذاشته شده» archive. Clicking any card opens that equipment's own folder at
`/pm-plans/:equipmentId`: a distinct view (not sheets under the board) with the equipment's name in
its header, its status (فعال / کنار گذاشته شده), a way back to the folders, and two sections —
«برنامه PM» and «سابقه PM». This replaces issue #81's rule that only equipment with an active plan
item has a card, and the «تعریف برنامه برای تجهیز» side path.

No Gherkin proposal was approved on the issue, so — as for #81 — no feature file changes. The
UI-voiced maintenance-management scenarios that drive `/pm-plans` (add to a plan, change an
interval, remove an item) keep their wording and are re-automated against the folder view. The
issue's eleven acceptance scenarios are covered by frontend unit tests and the a11y audit.

## Decisions

- **No backend change.** `GET /api/equipment` already lists every equipment with `retired` and
  `activePlanItemCount`; `GET /api/equipment/:id` (plan, `retired`) and
  `GET /api/equipment/:id/maintenance-history` already serve the folder. Due-date maths,
  permissions, audit and history are untouched.
- **Board** («تجهیزات فعال», a region named by its heading) = every non-retired equipment, API
  order. Each card is a link/button whose accessible name is exactly the equipment name, styled as a
  folder; it shows «N فعالیت فعال» when N > 0 and «بدون برنامه PM» otherwise (visible text only).
- **Archive** «تجهیزات کنار گذاشته شده» — a `mat-expansion-panel`, collapsed by default, always
  rendered (an empty note when there is none), holding a card per retired equipment.
- **Search** «جستجوی تجهیز» narrows both the board and the archive by name.
- **Folder route** `/pm-plans/:equipmentId` — same guard/roles as `/pm-plans`, lazy-loaded. Header:
  `<h1>` = equipment name, a status chip «فعال» / «کنار گذاشته شده», and a «بازگشت به پرونده‌ها»
  link back to `/pm-plans`. Its resources are keyed on the route param, so another folder never
  shows the previous one's data. An unknown id shows an error banner with the way back.
- **Sections** are separate components (`pm-plan-section`, `pm-history-section`) stacked in the
  folder, each a data sheet named «برنامه PM» / «سابقه PM» — a future section (failures, spare parts,
  documents) is one more component in the folder, no restructuring. No placeholders for them now.
- **Plan section** keeps «افزودن فعالیت», the row menu (ویرایش / حذف) and the due dates. An empty
  plan still shows the section with «افزودن فعالیت», so the first activity is defined from inside the
  folder. Retired equipment: read-only — no add button, no actions column.
- **Removed**: «تعریف برنامه برای تجهیز» and the add-item dialog's «تجهیز» picker (candidates mode).
  Removing the last item leaves the card on the board (it is no longer conditional).

## Risks

- The a11y audit must grade the folder route (active and retired) with mocked API responses.
- QA's task that adds the first activity no longer branches: it always opens the folder.

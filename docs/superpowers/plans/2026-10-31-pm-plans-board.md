# PM plans board — plan (issue #81)

Design: `docs/superpowers/specs/2026-10-31-pm-plans-board-design.md`.

## Backend (`backend/`)

1. `ListEquipmentHandler` / `EquipmentReadModel`: add `activePlanItemCount: number` — items currently
   in the equipment's PM plan (removed ones excluded), from what the repository already loads.
2. List response DTO + Swagger: `activePlanItemCount` (integer, example 2). Regenerate the spec.
3. Unit tests: 0, several, after a removal; retired equipment keeps its count.

Response item: `{ id: string, name: string, retired: boolean, activePlanItemCount: number }`.

## Frontend (`frontend/`)

1. `EquipmentGateway.list()` → `AppEquipment` gains `activePlanItemCount`.
2. `/pm-plans` replaces the picker with:
   - search field «جستجوی تجهیز»;
   - button «تعریف برنامه برای تجهیز» above the board;
   - region «تجهیزات دارای برنامه PM» — CSS-grid board (auto-fill, minmax) of card buttons
     (`aria-pressed`, accessible name = equipment name, visible «N فعالیت فعال»), empty states;
   - expansion panel «تجهیزات کنار گذاشته شده» with cards for retired equipment;
   - the existing «برنامه PM» / «سابقه PM» sheets for the selection (empty state before any).
3. `AddPmPlanItemDialog`: optional equipment `combobox` «تجهیز» (candidates passed in); on success
   the page reloads the list and selects that equipment.
4. After add/change/remove: reload plan **and** equipment list.
5. Specs: board filter, count, selection/aria-pressed, switching, search, define-plan flow, last-item
   removal (card gone, history kept), retired read-only.

## QA (`acceptance-tests/`)

1. `ui/pm-plans-page.ts`: drop the equipment picker; add `equipmentCard(name)` (button, exact name),
   `definePlanButton()` («تعریف برنامه برای تجهیز») and the dialog's `combobox` «تجهیز».
2. `pm-plan.ts`: choosing equipment clicks its card; adding to equipment with no card goes through
   «تعریف برنامه برای تجهیز» and picks the equipment in the dialog. No feature-file changes.

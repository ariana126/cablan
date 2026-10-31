# PM plans board — design (issue #81)

## Capability

On `/pm-plans` («پرونده فنی تجهیزات») the technical manager sees, on arrival, every active piece of
equipment that has at least one PM plan item as a card on a responsive board, searchable by name,
instead of picking it from a dropdown. Clicking a card selects it (visibly) and shows its «برنامه PM»
and «سابقه PM» sheets below — the same sheets, dialogs and rules as today.

No Gherkin proposal was approved on the issue, so no feature file changes. The existing
maintenance-management scenarios that drive `/pm-plans` (add to a plan, change an interval, remove an
item — all UI-voiced) keep their wording and are re-automated against the board. The issue's eight
acceptance scenarios are covered by frontend and backend unit tests.

## Decisions

- **One request for the board.** `GET /api/equipment` gains `activePlanItemCount: number` per
  equipment — the number of items currently in its PM plan (removed items excluded). No new endpoint,
  no per-equipment fetch for the board. The detail (`GET /api/equipment/:id`) and history endpoints
  are unchanged; PM due-date maths, permissions, audit and history are untouched.
- **Board** = non-retired equipment with `activePlanItemCount > 0`, in the API's order (Persian
  alphabet). Each card is a `<button>` with `aria-pressed`, accessible name exactly the equipment
  name, showing the name and «N فعالیت فعال» (Persian digits).
- **Search**: a text field labelled «جستجوی تجهیز» filters both the board and the retired section
  by name (substring).
- **«تعریف برنامه برای تجهیز»** (button above the board) opens the existing add-item dialog with an
  extra equipment picker (searchable `combobox` «تجهیز») offering non-retired equipment whose
  `activePlanItemCount` is 0. On success the equipment list reloads, the new card appears and is
  selected.
- **Removing the last item**: the list reloads after every plan change, so the card disappears; the
  selection stays, so the (now empty) plan and the untouched history stay on screen.
- **Retired equipment**: never on the main board. A separate region «تجهیزات کنار گذاشته شده»
  (an expansion panel, collapsed by default) holds cards for every retired equipment. Selecting one
  shows its plan read-only (no add, no row menu) and its history, as today.
- Selecting another card replaces both sheets (both resources are keyed on the selected id).

## Risks

- The UI scenario «افزودن فعالیت به برنامه تجهیز» starts from equipment with no plan — it must go
  through «تعریف برنامه برای تجهیز», not a card. QA's task chooses the route by whether a card exists.
- The card's accessible name is the bare equipment name; the count is visible text only.

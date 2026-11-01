# Equipment technical folders — plan (issue #92)

Design: `docs/superpowers/specs/2026-11-01-equipment-folders-design.md`. No new HTTP fields; no
backend task.

## Frontend (frontend-engineer)

1. `/pm-plans` board page: region «تجهیزات فعال» with every non-retired equipment as a folder card
   (accessible name = equipment name; detail «N فعالیت فعال» or «بدون برنامه PM»); search
   «جستجوی تجهیز»; collapsed archive panel «تجهیزات کنار گذاشته شده» (always present). Clicking a
   card navigates to `/pm-plans/:equipmentId`. Remove the define-plan button and the plan/history
   sheets from this page.
2. New lazy route `/pm-plans/:equipmentId` (same roles), page `EquipmentFolderPage`: `<h1>` equipment
   name, status chip «فعال»/«کنار گذاشته شده», link «بازگشت به پرونده‌ها», then `PmPlanSection`
   («برنامه PM»: add, edit interval, remove, due dates; read-only when retired; empty state still
   offers «افزودن فعالیت») and `PmHistorySection` («سابقه PM», «جزئیات» dialog).
3. Drop the add-item dialog's candidates/equipment-picker mode.
4. Specs for each; a11y audit covers `/pm-plans`, an active folder (with and without plan) and a
   retired folder.

## QA (qa-engineer)

1. `ui/pm-plans-page.ts`: board region «تجهیزات فعال»; card by exact equipment name in that region;
   folder heading (h1 = name); back link «بازگشت به پرونده‌ها»; drop `definePlanButton` and
   `dialogEquipmentPicker`.
2. `maintenance-management/pm-plan.ts`: choosing equipment = open `/pm-plans`, click its card, wait
   for the folder's «افزودن فعالیت» in «برنامه PM»; the add-item dialog always opens from there (no
   `HasACardOnTheBoard` branch).

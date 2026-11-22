# Factory Manager role and a narrower QC Inspector — design

Issue #130. Gherkin approved in the issue's latest `cablan:gherkin-proposal` comment.

## Capability

A seventh role, **مدیر کارخانه** (`factory_manager`), does everything Management, the Technical
Manager, both inspectors and the Reporter do, and reads the system's audit log — but never manages
users, never uses a System-Admin-only power (bulk-import reversion, PM-plan Excel import, deleting
PM/QC executions, deleting inactive plan rows or retired equipment, reactivating equipment,
completing legacy activity specialties) and never gets the System Admin's dependency exceptions
(issue #110/#126 corrections). At the same time the **QC Inspector** loses orders, the standard-BOM
list and export, and the daily-BOM dashboard (the whole «گزارشات» folder), while keeping daily BOMs
(register, edit, delete, re-sample, list, export) and the in-production inspection — and daily-BOM
registration still finds the order by number and offers its MI codes. Every other role is untouched.

## Scenarios (UI-voiced marked ★)

- home/role-based-home-page: ★ «میانبرهای بازرس کنترل کیفیت» (changed), ★ «میانبرهای مدیر کارخانه»,
  ★ «تغییر نقش بازرس کنترل کیفیت به مدیر کارخانه», «مدیر کارخانه ای که بازرس کنترل کیفیت شده دیگر
  سفارشات را نمی بیند», «بازرس کنترل کیفیتی که مدیر کارخانه شده بلافاصله سفارشات را می بیند».
- authentication/registring-user: کامرانی added to the four denied outlines; «مدیر کارخانه» added to
  the valid roles.
- planning/registring-order: ★ «تعریف سفارش توسط مدیر کارخانه», «تلاش بازرس کنترل کیفیت برای مشاهده
  سفارشات», ★ «بازرس کنترل کیفیت آنالیز روزانه سفارش را با کد MI آن ثبت می کند».
- bom-reporting/reporting-standard-bom: two QC-inspector denials (list, export).
- bom-analyzing/bom-dashboard: QC-inspector denial; the feature's viewer moved from نیکروش to سینا.
- bom-registration: «ثبت اطلاعات پایه توسط مدیر کارخانه» (component, material, product, standard BOM —
  ★ active voice), the two «مدیر کارخانه … در حال استفاده» refusals (material, standard BOM).
- bom-registration/registring-bom: ★ «ثبت آنالیز روزانه توسط مدیر کارخانه».
- approving-bom / resampling-bom / QC features / maintenance features / technical dashboard:
  کامرانی added to the allowed outlines; single کامرانی examples for QC assign, QC history,
  activity, plan, daily schedule, audit log; کامرانی refused for every System-Admin-only power.

Placement note: the proposal grouped several rules under feature names that don't exist as files
(«ثبت محصول، جز و مواد اولیه», «ثبت و بررسی آنالیز روزانه», «تعمیرات و نگهداری», «فعالیت های QC»).
Each example went to the existing feature file owning that behaviour, under that file's rule renamed
to name مدیر کارخانه. The combined base-data outline lives in registring-product.feature. The
maintenance «ثبت انجام توسط کاربر مجاز» outline keeps its existing steps (the proposal abbreviated
them) with کامرانی added to its examples.

## Slice

- **Backend.** No new module, aggregate or endpoint. `Role.FactoryManager = 'factory_manager'` in
  `framework/domain/role.ts`; added to `PRODUCTION_ROLES` and every role list that today names
  Management, the Technical Manager or the PM Inspector, plus the audit log's three read endpoints.
  `Role.QcInspector` removed from: the orders list and `GET orders/:id` (keep
  `GET orders/by-number/:n` and whatever else the daily-BOM form uses), the standard-BOM list,
  report and export endpoints the standard-BOM page uses (keep any standard-BOM read the daily-BOM
  register/edit/resample path needs), and the dashboard controller. `route-roles.spec.ts` updated to
  pin the new matrix. Users endpoints stay `SystemAdmin` only; every `@Roles(Role.SystemAdmin)` stays
  as is. Roles are already read per request (`RolesGuard` → `UserRoleProvider`), so a role change
  applies without re-login. OpenAPI regenerated (the `Role` enum grows).
- **Frontend.** `Role.factory_manager` from the regenerated client; Persian label «مدیر کارخانه»,
  selectable in the user form; `navigation.ts` gives it every page but users and takes orders,
  standard BOMs and the reports folder away from `qc_inspector` (menu + route guards);
  `permissions.ts` adds it to every writer list but the System Admin's exceptions/imports/reversions;
  home shortcuts per the Gherkin, including a new «اسکن QR تجهیز» shortcut that opens the
  in-production inspection's QR scanner directly.
- **QA.** New persona **کامرانی** (`factory_manager`); new/changed steps for the scenarios above.

## Risks

- The daily-BOM form's reads: closing a read the form needs would break registration for the
  inspector (acceptance criterion 9). Backend must trace the form's calls before narrowing.
- `PRODUCTION_ROLES` doubles as "anyone in production" for many reads; adding the factory manager
  there is intended, and removing the inspector from specific endpoints must not touch that list.

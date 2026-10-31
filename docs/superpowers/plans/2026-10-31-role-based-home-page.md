# Role-based home page — plan (issue #79)

Design: `docs/superpowers/specs/2026-10-31-role-based-home-page-design.md`. No backend task, no
HTTP surface change.

## Shortcut table (exact)

| Role | Group (category label) | Shortcut label | Target |
|---|---|---|---|
| qc_inspector | کنترل کیفیت | ثبت آنالیز روزانه جدید | `/boms?register=true` |
| qc_inspector | کنترل کیفیت | آنالیز های روزانه | `/boms` |
| qc_inspector | کنترل کیفیت | آنالیز های استاندارد | `/standard-boms` |
| management | کنترل کیفیت | داشبورد روزانه | `/boms/dashboard` |
| management | کنترل کیفیت | آنالیز های روزانه | `/boms` |
| management | کنترل کیفیت | آنالیز های استاندارد | `/standard-boms` |
| management | اطلاعات پایه | محصولات | `/products` |
| reporter | کنترل کیفیت | آنالیز های استاندارد | `/standard-boms` |
| pm_inspector | فنی | برنامه روزانه PM | `/pm-schedule/daily` |
| technical_manager | فنی | برنامه روزانه PM | `/pm-schedule/daily` |
| technical_manager | فنی | وضعیت تعمیرات و نگهداری | `/pm-schedule/overview` |
| technical_manager | فنی | برنامه PM تجهیزات | `/pm-plans` |
| system_admin | مدیریت سیستم | رویداد های سیستم | `/audit-log` |
| system_admin | کنترل کیفیت | داشبورد روزانه | `/boms/dashboard` |
| system_admin | کنترل کیفیت | آنالیز های استاندارد | `/standard-boms` |
| system_admin | فنی | وضعیت تعمیرات و نگهداری | `/pm-schedule/overview` |

## Markup contract (shared by frontend and QA)

- `/` keeps its single `h1` (greeting «خوش آمدید، <name>»).
- Each group: `<section aria-labelledby="…">` (ARIA role `region`) named by an `h2` whose text is
  exactly the category label. Only non-empty groups render.
- Each shortcut: an `<a>` inside its group's section, accessible name exactly the shortcut label.
  No other links inside the group sections.
- `/boms?register=true` opens the daily-BOM registration dialog (the same one «ثبت آنالیز روزانه»
  opens), for roles allowed to register.
- The drawer (main menu) is unchanged.

## Tasks

### Frontend (`frontend-engineer`)
1. `navigation.ts`: shortcut model + table + `shortcutsFor(role)` returning groups
   `{ category: NavigationCategory-id/label, shortcuts: { label, path, queryParams? }[] }`, in menu
   order, filtered by `canReach`. Unit specs per role (exact table above), group derivation, no empty
   groups.
2. `home-page.ts`: render greeting + groups per the markup contract; remove the `?category=`
   drill-down; responsive (desktop/tablet/mobile), design-system tokens only.
3. Breadcrumb/app shell: category crumbs no longer link to home levels.
4. `boms-page.ts`: honour `?register=true` (open registration dialog once if `canManageBoms`,
   then clear the parameter).
5. Update specs; a11y audit still covers `/`.

### QA (`qa-engineer`)
1. Business Flow for every scenario in `specs/home/role-based-home-page.feature`.
2. Lean Page Object `screenplay/ui/home-page.ts`: group regions + shortcut links per the contract.
3. «میانبرهای صفحه اصلی او دقیقاً …» compares the set of (group, shortcut) pairs exactly.
4. Registration from home: click «ثبت آنالیز روزانه جدید», then reuse the existing daily-BOM form
   filling/submission; «آنالیز روزانه جدیدی ثبت شده باشد» is the existing step.
5. Role change `Given` through the API (existing `EditUser.viaApiUsing`); then the actor logs in
   through the browser and views home.
6. «… را از منوی اصلی باز می کند»: open the drawer entry (expand categories as needed); `Then`s
   check the page heading/list is shown.
7. Update the root/acceptance CLAUDE.md door table.

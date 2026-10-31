# Role-based home page — design (issue #79)

## Capability

After logging in, every user lands on a home page that offers the frequent tasks of **their role**
as direct shortcuts, grouped under the main menu's top-level categories — instead of a one-level-at-
a-time copy of the menu tree. Phase 1 only: no counters, no inbox, no per-user customisation.

Feature file: `acceptance-tests/specs/home/role-based-home-page.feature` (approved Gherkin, issue
comment of 2026-10-31). Scenarios — all **UI-voiced** (the home page and the main menu are the
point):

- میانبرهای بازرس کنترل کیفیت / مدیریت / گزارشگیر / بازرس PM / مدیر فنی / مدیر سیستم
- بازرس کنترل کیفیت آنالیز روزانه جدیدی را از صفحه اصلی ثبت می کند
- تغییر نقش مدیریت به گزارشگیر (the role change itself is a passive `Given` → API)
- گزارشگیر همچنان به داشبورد روزانه دسترسی دارد
- مدیریت همچنان به اجزا دسترسی دارد

## Vertical slice

- **Backend: nothing.** Permissions do not change (issue: «تغییر مجوزها و نقش‌های موجود» is out of
  scope); the API's `RolesGuard` keeps enforcing access. The role arrives in `GET /users/me`, which
  the frontend already loads on every page load, so a role change shows on the next visit.
- **Frontend:** the shortcut table lives next to `NAVIGATION` in
  `frontend/src/app/core/identity/navigation.ts` — the existing single source of truth for pages,
  categories and roles (issue rule 4.7: reuse the existing roles/permissions/categories, no
  parallel structure). A shortcut **references a page by path**; its group is that page's
  top-level category (derived via `trailTo`, never restated), and it is shown only when
  `canReach(path, role)` also holds, so a shortcut can never advertise a page the role may not open.
  Adding a role or a shortcut is one table row; adding a module adds pages to `NAVIGATION` and,
  optionally, rows to the table — no layout change (issue rule 4.6).
- **Home page:** greeting `h1` kept; below it one `<section>` per non-empty group, named by an `h2`
  whose text is the category label, each containing a list of links (the shortcuts). Groups render
  in menu order. The current `?category=` drill-down is removed from home; every permitted page
  stays reachable through the drawer (main menu), which is unchanged. The toolbar breadcrumb's
  category crumbs, which linked to home levels, become plain text.
- **«ثبت آنالیز روزانه جدید»** links to `/boms?register=true`; the daily BOMs page opens its
  existing registration dialog when it sees that parameter (and drops the parameter from the URL,
  so a reload or back does not reopen it). Shown only to roles that may both reach `/boms` and
  `canManageBoms`.

## Decisions

- **Shortcut labels follow the approved Gherkin.** Two shortcuts carry names that differ from the
  pages' current menu labels, because the menu was renamed after the stakeholder approved the
  scenarios: `pm-schedule/overview` (menu «گزارش PM») is offered as «وضعیت تعمیرات و نگهداری», and
  `pm-plans` (menu «پرونده فنی تجهیزات») as «برنامه PM تجهیزات». A shortcut therefore has an
  optional label override; the rest reuse the page label. Flagged to the stakeholder.
- Group order and order within a group are ours (menu order); the Gherkin compares as a set of
  (group, shortcut) pairs, "exactly" — no extra shortcut and no empty group.
- No new endpoint, no new state; nothing to load, so no loading/error states beyond the existing
  `CurrentUserStore`.

## Risks

- Removing the `?category=` drill-down touches the shell breadcrumb and existing unit tests.
- Existing acceptance scenarios that reached a page through home cards (if any) must move to the
  drawer — QA verifies.
- The dashboard list task waits on the home heading after some action; the `h1` is preserved.

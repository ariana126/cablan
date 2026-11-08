# Technical module UX redesign — design (issue #112)

## Capability

The «فنی» pages (daily PM schedule, equipment folder board and folder, PM schedule calendar/table,
PM dashboard) and two «اطلاعات پایه» pages (equipment, maintenance activities) get a clearer
information hierarchy — primary information first, secondary information quieter, management
actions least prominent — and fewer dead ends between pages. **No business rule, permission, data
or calculation changes.**

The approved Gherkin proposal (comment of 2026-11-08 13:00, approved 13:02) changes one scenario:
`home/role-based-home-page.feature` «میانبرهای مدیر فنی» gains a fourth shortcut «داشبورد مدیریتی
فنی» in group «فنی». It is UI-voiced (the home page is read in the browser). The stakeholder
removed two items from scope: the active-PM-activity count per equipment (and «فاقد برنامه PM»),
and the "which equipment use this activity" view on the activities page.

## Slice

- **Backend: nothing.** Every summary the redesign shows (folder header: active item count,
  overdue count, nearest due; daily-schedule box headers) is derived on the client from data the
  pages already load. Filtering of PM history and of activities by specialty is client-side over
  lists the pages already load in full.
- **Frontend:** the bulk of the work — see Decisions.
- **Acceptance tests:** the home scenario's new row (the step is table-driven, so likely no new
  automation), and reconciling Lean Page Objects / tasks with the new markup wherever an action
  moved into a «عملیات بیشتر» menu, a label changed («ثبت تجهیز», «ثبت فعالیت», «ذخیره تغییرات»),
  the daily schedule became per-equipment boxes, or a section became collapsible. No step wording
  changes.

## Decisions

1. **Home shortcuts:** the technical manager's list in `core/identity/navigation.ts` appends
   `pm-dashboard`. Other roles unchanged.
2. **Row actions:** a row keeps its most frequent action visible as a low-emphasis (text/icon)
   button; rarely used and dangerous actions go into a `mat-menu` behind an icon button named
   «عملیات بیشتر …». Dangerous items (کنار گذاشتن, حذف, غیرفعال‌سازی) are visually separated
   (divider, error colour + text). Menus are keyboard/touch reachable — nothing is hover-only.
3. **Equipment page:** name is the row's primary text, status (فعال / کنارگذاشته‌شده) as a
   text+icon chip. A «مشاهده پرونده فنی» link per row (route `pm-plans/:equipmentId`) for roles
   that can open the folder. Form: create → title «ثبت تجهیز», button «ثبت تجهیز»; edit → «ذخیره
   تغییرات». After create, the success feedback offers «مشاهده پرونده فنی». Edit restrictions are
   shown before saving where the page knows them (the dependency 409 still shows inside the dialog
   as today). The retire confirmation states: equipment leaves active status, its PM stops while
   retired, history is kept, and the System Admin can reactivate it — never "irreversible".
4. **Maintenance activities page:** name primary, specialty secondary; edit low-emphasis. A
   specialty filter (همه / برق / مکانیک, default همه) combining with the name search, and a clear
   button. Form buttons «ثبت فعالیت» / «ذخیره تغییرات».
5. **Daily PM schedule:** one bordered, rounded `<section>` per equipment (heading = equipment
   name, header summary = due count and overdue count when non-zero), mechanical then electrical
   groups inside, empty groups omitted, equipment name not repeated per row. Rows: activity name,
   due date, status, delay. «ثبت انجام» stays a direct button. All boxes open; nothing collapses.
   After recording, a snackbar confirms and the list reloads.
6. **Equipment folder:** a summary strip under the header (status, active item count, overdue
   count, nearest due). Inactive items section collapsed by default (`mat-expansion-panel`), its
   title carrying the count. PM history gets a name search, a date range and a specialty filter.
7. **Folder board (pm-plans):** a search matching retired equipment says so and opens/reveals the
   archive so the match is visible.
8. **PM schedule (calendar/table):** equipment and specialty filters inline; activity, status and
   performer under «فیلترهای بیشتر»; active filters shown as removable chips with «پاک کردن همه».
   Filters survive switching views. Table rows open the occurrence details and link to the folder.
   A short note explains the calendar (by due date) vs table date display; late executions show
   both the due date and the actual date.
9. **PM dashboard:** KPI figures dominate; adherence and completion percentages get a short
   explanatory tooltip/hint; the next-7-days list links to each equipment's folder.

## Risks

- **Locator drift.** Moving actions into menus and renaming buttons can break the blended
  acceptance suite with no other check failing first. The frontend reports every changed
  accessible name/role; QA reconciles page objects after.
- **Accessibility.** New menus, chips and expansion panels must keep `make lint-accessibility`
  green in both colour schemes.

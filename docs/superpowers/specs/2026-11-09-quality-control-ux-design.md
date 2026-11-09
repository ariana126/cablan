# Quality control UX redesign — design (issue #113)

## Capability

The «کنترل کیفیت» pages — daily analyses (`/boms`), standard analyses (`/standard-boms`), the daily
dashboard (`/bom-dashboard`) and their dialogs — get a clearer information hierarchy, honest action
names, and a multi-select filter that does what a person expects from it. **No business rule,
permission, data, calculation or audit behaviour changes.** The issue carries no Gherkin proposal,
so no `.feature` file changes; every change is UI-only, and the existing scenarios must stay green.

UI surface: yes. Backend: nothing — every summary and scope line is derived on the client from what
the pages already load, and every filter already exists server-side.

## Decisions

1. **One filter model, everywhere in this section** (`ui/checkbox-filter-dialog` +
   `ui/checkbox-filter-list`, used by `/boms`, the dashboard's approval filters and the standard-BOM
   report filter dialog). The current model opens an unfiltered field with *every* value ticked, so
   finding one value by search and pressing «اعمال» keeps all the unseen values selected. New model:
   - **Three states named in the dialog's summary line:** «بدون محدودیت — همه مقادیر» (no filter),
     «N مقدار انتخاب‌شده», and, while searching, «N نتیجه جستجو».
   - An unfiltered field opens with **nothing ticked** and «بدون محدودیت» stated. Ticking a value
     starts a selection of exactly that value — no need to untick everything first.
   - **Selections survive searches:** search, tick, search again, tick; both stay. Every selected
     value is shown as a removable chip in an «انتخاب‌های فعلی» strip above the list, including
     values hidden by the current search.
   - **Enter in the search box:** exactly one match → add it to the selection and clear the search
     (stays open for the next search); several matches → no guess, a polite live message «چند نتیجه
     یافت شد؛ مورد موردنظر را انتخاب کنید»; no match → nothing changes; empty search → «اعمال».
   - The group checkbox names its scope: «انتخاب همه» without a search, «انتخاب همه N نتیجه جستجو»
     with one; it adds/removes only the visible matches.
   - A search with no result changes nothing (the previous selection is kept and shown).
   - Footer: «حذف محدودیت» (lift the filter: close with `selected: undefined`), «انصراف» (close
     unchanged), «اعمال». Applying with nothing ticked lifts the filter. Applying with every value
     ticked keeps the existing "all ticked = no filter" rule for the result.
   - Persian and Latin digits match alike (already `normalizeForSearch`).
   - The dashboard default «در انتظار تایید» is an explicit selection, so it opens ticked as today.
   - The filter button and the active-filter chips under the bar keep showing every effective
     selection; filters of different fields combine (AND) as today.
2. **Daily analyses page (`/boms`).** A one-line page description of what it is for. Row primary
   text: product name; order number and tracking number (and MI code) readable and labelled, so two
   analyses of one order/product are told apart. Review status as a text+icon badge (not colour
   alone). A small «ویرایش‌شده» marker when the analysis has edit history and a resample indication
   where the page already knows it. Row actions: the most frequent visible as a low-emphasis
   button, the rest (edit details, resample, delete) in a «عملیات بیشتر» menu, destructive items
   separated. Near the export buttons a scope line: «خروجی شامل N آنالیز مطابق فیلترها و بازهٔ فعلی».
   Empty data vs no search result vs load error stay three distinct states.
3. **Daily analysis form (create/edit/resample).** Ordered sections with headings: سفارش → MI →
   محصول → وزن‌ها; a disabled select explains why («ابتدا سفارش را انتخاب کنید», and when an order has
   no MI, that MI assignment belongs to planning). A sticky sample-identity header (product, order,
   tracking number) stays visible while scrolling the weights. Each weight row names component,
   material and unit. Invalid fields are marked and the first one focused on submit; a failed save
   keeps every entered value. Editing an already-reviewed analysis states before saving that its
   review status returns to pending (only if that is the existing rule — never invent one).
   Resample states the difference: a new sample is registered; the previous one stays in history.
4. **After registering (ثبت ≠ تایید).** No action titled «تأیید» unless it is a management approval:
   the preview's confirming button reads «ثبت آنالیز»; after saving, the feedback says the analysis
   was saved and awaits management review, names the analysis (product, order, tracking number) and
   offers a link to the dashboard. Buttons that only close are «بستن».
5. **Standard analyses page.** Page description; rows read product → MI code → brand, with active
   status as a text+icon badge. The weight basis (per-metre) is stated in headers using the
   existing unit. Reference information and component/material weights are visually separate
   sections in detail and form. Where the page can know a record is in use, the edit/delete
   restriction is shown before the dialog is opened, with the reason in plain Persian; the 409
   inside the dialog stays as the fallback.
6. **Dashboard.** Under the header a scope summary listing what is being viewed: date range,
   approval-status filter (calling out the default «فقط در انتظار تایید (پیش‌فرض)»), reviewer and
   number searches, with «پاک کردن فیلترها». Stat labels say they count the filtered results.
   Product cards keep detail secondary (collapsed where it is long); the comparison reads
   استاندارد | ثبت‌شده | اختلاف with the difference signed and worded (more/less than standard) in a
   neutral colour — never green/red implying pass/fail; a missing value shows «ثبت نشده», never 0.
   The rejection reason is prominent on rejected analyses. After approve/reject/edit, a snackbar
   names the analysis and its new status, and says so when it leaves the list because of the active
   filter. Focus moves sensibly so review of the next analysis continues without extra clicks.
7. **Consistency and access.** Same filter dialog, same empty/no-result/error states, same row
   action pattern on the three pages; everything keyboard-reachable; layouts reflow at phone width;
   closing a dialog restores focus to its trigger.

## Risks

- **Locator drift and the filter semantics change.** The acceptance suite drives these filter
  dialogs (unticking «انتخاب همه», then ticking values) and buttons whose names change. The frontend
  reports every changed accessible name/role/behaviour; QA reconciles page objects and tasks without
  changing step wording.
- **Accessibility.** New menus, chips, sticky header and live messages must keep
  `make lint-accessibility` green in both schemes.
- **Scope size.** If time is short, decision 1 (the filter) and 4 (ثبت ≠ تایید) are the must-haves;
  the rest are improvements to the same pages.

# Dashboard default approval filter — design

Issue #63. The BOM dashboard is where Management reviews the day's daily BOMs, so it should open on
the work still to do: its «وضعیت تایید» filter starts on «تایید نشده».

## Scenarios (`acceptance-tests/specs/bom-analyzing/bom-dashboard.feature`)

New rule «داشبورد آنالیز های روزانه به طور پیش فرض فقط آنالیز های روزانه تایید نشده را نشان می دهد»,
all UI-voiced:

- مشاهده لیست محصولات داشبورد بدون تغییر فیلتر وضعیت تایید
- مشاهده آنالیز های روزانه یک محصول بدون تغییر فیلتر وضعیت تایید
- مشاهده آنالیز های روزانه تایید شده و تایید نشده با تغییر فیلتر وضعیت تایید
- آنالیز روزانه ای که از داشبورد تایید می شود دیگر در داشبورد نمایش داده نمی شود
- فیلتر وضعیت تایید با ورود دوباره به داشبورد به پیش فرض برمی گردد

Changed: the approver-only filter examples now also tick «تایید شده» (filters AND together, so an
approver filter under the default status would match nothing); «مشاهده وضعیت تایید …» ticks both
statuses; dashboard approve/revoke now assert the approval over the API rather than on the page.

## Slice

- **Frontend only.** The dashboard's approval-filter signal starts at
  `{ approvalStatuses: ['unapproved'] }` instead of `{}`; it lives in the page component, so it
  resets on every visit. Approve/revoke re-fetch both lists so an approved BOM leaves the view.
- **Backend: none.** `POST boms/dashboard` and its daily-BOM endpoint already filter by
  `approvalStatuses`.
- **QA:** new steps for the five examples and the approver-plus-status variants; the
  status-filter task sets exactly the requested values over the pre-ticked default; revoking from
  the dashboard widens the status filter first to reach the approved BOM.
- The `/boms` report keeps no default filter.

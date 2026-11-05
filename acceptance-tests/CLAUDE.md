# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Black-box BDD acceptance suite (Cucumber + Serenity/JS + TypeScript) for the sibling `../backend`
and `../frontend` projects, written with the **Screenplay Pattern**.

**Skills.** `handbook:screenplay-guideline` is the authority on this suite's structure and anti-patterns (with `handbook:test-guideline` for black-box test design) — invoke it before writing automation.

The suite reaches the system two ways and no others: **HTTP to the backend**, and **a browser
pointed at the frontend**. No importing code from either project, no direct database access —
preconditions that can't be set up through one of those two doors don't get set up.

It runs against both projects' **test stacks** — separate Compose projects with their own
databases, so a run can never touch anything a developer is working in:

| Stack               | Compose project     | Port     |                                              |
| ------------------- | ------------------- | -------- | -------------------------------------------- |
| backend **test**    | `cablan-backend-test`  | **3001** | `NODE_ENV=test`, own database                |
| frontend **test**   | `cablan-frontend-test` | **4201** | proxies `/api` to the backend test stack      |

Not the dev stacks on 3000/4200. The testing endpoints this suite depends on
(`POST /api/testing/migrations`, `/truncate`, `/clock` and `/clock/advance`) mount only at
`NODE_ENV === 'test'`, so they simply don't exist on 3000 — and a run can never truncate dev data.
The frontend has no such switch; what keeps it honest is `API_PROXY_TARGET`, which points 4201 at
3001 and 4200 at 3000.

Start them with `make -C ../backend test-up` and `make -C ../frontend test-up`, or let the root
`make run-acceptance-tests` do the whole sequence: both test stacks up, this container up, suite run.

## Which door a step goes through

The suite is **blended** (BDD in Action, ch15): the browser where the browser is the point, HTTP
everywhere else — ch10 lists four reasons to reach for a UI test, and ch10 also puts UI tests at
"a small minority" of an acceptance suite as the norm.

**Every Cablan feature file is automated**, and each scenario's door is chosen deliberately. Keep
this table current as scenarios are added:

| Feature area | Door |
| --- | --- |
| authentication/logging-in | UI for the active `When`s; API for `Given` preconditions |
| authentication/registring-user | **API throughout** — `RegisterUser`, `EditUser`, `DeleteUser` have only `viaApiUsing` variants |
| bom-registration | UI for the active `When`s; API for `Given` preconditions and access-denied attempts |
| bom-registration/registring-bom — the daily-BOM preview rule | **UI**, including the passive «… ثبت کرده و پیش نمایش آن به او نشان داده شده باشد» `Given`: the preview opens only after a registration through the form, so no API call can set it up. Facts about the system go through the API — «آنالیز روزانه جدیدی ثبت شده باشد» and «… بدون تغییر …» read `GET boms`, «رویداد ثبت و سپس رویداد ویرایش …» reads the audit log as یاشار. See `screenplay/bom-registration/bom-preview.ts`. |
| bom-registration/importing-materials | UI for the active non-«تلاش» `When`s: «… اکسلی با … بارگذاری می کند» uploads a real `.xlsx` through `/materials`' «بارگذاری از اکسل» (answering the browser's file chooser — `common/uploads.ts`) and the change-list dialog is read by column header («ردیف», «تغییر», «خطا»); «… را از لیست تغییرات حذف و آن را تایید می کند» / «… لیست تغییرات را تایید می کند» click each row's «حذف ردیف N» and «تایید». Also **UI**: the passive «اینکه … اکسلی بارگذاری کرده باشد که لیست تغییرات آن … است», because its `When` acts on the dialog that upload left open. API for the background, the «تلاش …» attempt (`POST materials/import-preview`, multipart `file`) and every fact about the materials (`GET materials`, read by an **observer** — یاشار, or مصطفی when یاشار just acted — so the actor's last response survives for «پیغام خطای …»; `registered-materials.ts`). The `.xlsx` is built by `accounting-excel.ts` (`write-excel-file`): row 1 blank, header on row 2, Gherkin rows from row 3, an empty cell for an empty Gherkin cell — so «ردیف «مسی»» is found by its spreadsheet row number. «خطای تکراری بودن کد» said of one row is `code-taken`, said of several rows together `duplicate-code-in-file` (likewise «… اسم …»); the Persian error texts are asserted, never codes. «هیچ تغییری …» compares with the materials noted by the step that imported/confirmed/reverted. See `screenplay/bom-registration/material-import.ts`. |
| audit-logging — bulk import («بارگذاری گروهی») rules | UI for the active «یاشار آن بارگذاری گروهی / بارگذاری گروهی اول را برمی گرداند»: the import's row on `/audit-log` (its «جزئیات تغییرات <import id>» button), then «برگرداندن» in the details dialog (`ui/audit-log-page.ts`). API for every precondition — uploads, confirmations (`POST materials/imports`), reversions — and the «تلاش …» reversions (`POST materials/imports/{id}/reversion`, 409 `material-import-not-latest` / `material-import-not-revertible`). The `Then`s read the audit log (`MaterialImport` / `Imported` / `Reverted`; change lines `importedMaterial:<code>`, `materialCode:<name>`, `materialName:<code>`, compared in file order) and the materials over the API. Import preconditions let a minute pass first, so the import sorts after the background on the frozen clock, and wait for the `Imported` entry. The background's row 5 registers a «مسی», so «مواد اولیه "مسی" با کد "M-101" … ثبت شده باشند» edits its code rather than registering a second. See `screenplay/audit-logging/material-import-audit.ts`. |
| bom-reporting (report lists, exports) | UI; the «… توسط مصطفی تایید شده باشد» / «… با دلیل "…" عدم تایید شده باشد» preconditions and exporting-bom's «… تغییر داده و سپس آن را تایید کرده باشد» go through the API (a dashboard review edit). The export's «توضیحات مدیریت» column is compared on its change lines only — edit heading lines removed (`bom-report-export.ts#withoutEditHeadings`) — because that Gherkin predates issue #73's mandatory heading and states no reason or time; every other column is compared exactly. exporting-bom's «آنالیز استاندارد با کد MI … با مجموع وزن مواد اولیه N …» comes after a background that already registered daily BOMs on that standard BOM, which can no longer be edited (issue #94): a `Before` hook reads the totals off the pickle, the background registers the standard BOM with those weights (`bom-report-weight-totals.ts#weighedAsPlannedFor`, applied in `bom-report-fixtures.ts`), and the step only confirms the total |
| bom-reporting/reporting-bom-persian-digits | UI for the `When` (types into the filter dialog's search box «جستجو در مقادیر», clears every value first, ticks «انتخاب همه نتایج جستجو», applies); API for the `Given`, whose table names only order/tracking/MI and is filled with defaults by `bom-report-fixtures.ts#registerDailyBomsWithDefaults`. A separate file because reporting-bom.feature's Background registers conflicting daily BOMs. |
| bom-analyzing/bom-dashboard | UI, including «از داشبورد» approve and reject (reject: the card's «عدم تایید» opens a dialog with a «دلیل عدم تایید» textarea), the inline weight edit (whose «ذخیره» opens a reason dialog — «دلیل ویرایش», «ثبت») and the description-edit dialog (with its own «دلیل ویرایش» field; its `Then` reads the card's description once the dialog has closed) — both give a routine reason, since the Gherkin names none; the score `Then`s go through the API (see below). The approve outline's `Then`s are approving-bom's API reads; the reject outline's «… در داشبورد "عدم تایید" و تایید/رد کننده …» reads the card — a reviewed BOM leaves the default «در انتظار تایید» view, so it re-enters the dashboard with the status filter widened to every status (`ApprovalFilter.everyStatus`) |
| bom-analyzing/approving-bom | **API throughout** — who may approve or reject, the mandatory reason, the management note and what an edit does to a review are backend rules (`POST boms/:id/approval`, `POST boms/:id/rejection`, `PATCH boms/:id`). The browser variants are the dashboard's `ApproveDailyBom.fromTheDashboard` / `RejectDailyBom.fromTheDashboard`. Review `Then`s read `GET boms/:id` as the system admin, so the refused actor's last response (403, 400 `rejection-reason-required`, 409 `bom-already-reviewed`) survives for the step that judges it. «از داشبورد …» edits are sent with `editSource: 'dashboard'` (a review edit: the note gets its heading line); «از لیست آنالیز های روزانه …» and every unqualified edit with `'dailyBoms'` (a correction). The background registers ORD-5002 with «مغزی/مسی» 3 and «روکش/آلومینیوم» 6, so the weight preconditions normally edit nothing; when one must, it edits as نیکروش. |
| bom-analyzing/daily-bom-edit-details | UI for the active non-«تلاش» `When`s: «… از لیست آنالیز های روزانه با دلیل …» (the `/boms` edit form, reason in «دلیل ویرایش»), «… از پیش نمایش … با دلیل …» (the preview's «ویرایش»), «… از داشبورد با دلیل …» (the card's inline edit, under the product the background registered, dashboard opened with **no** date range), «… جزئیات آنالیز روزانه … را مشاهده می کند» (the `/boms` row's «جزئیات ویرایش» dialog, all five users) and «… را در داشبورد مشاهده می کند» (the card's «جزئیات ویرایش» list); their «جزئیات ویرایش زیر به … نشان داده شود» reads whichever the actor opened (kept on the actor's notepad). API for the refused «تلاش می کند …» attempts (and «به او گفته شود که نوشتن دلیل ویرایش لازم است», 400 `edit-reason-required`), the no-change save, the dashboard edit-then-approve (approving-bom's step), every passive `Given`, and every fact-reading `Then` (`GET boms/:id` as یاشار; the audit log for «هیچ رویداد ویرایشی …», watched for 1.5 s since projection is fire-and-forget). Preconditions never *edit* to set a value — an edit would land in the edit details the scenarios assert exactly — so «شماره ردیابی آن … باشد» replaces the daily BOM (delete, re-register with the same order number and weights). See `screenplay/bom-analyzing/daily-bom-edit-details.ts`. |
| bom-analyzing/resampling-bom | UI for the active «… نمونه گیری مجدد می کند» (the `/boms` row's «نمونه گیری مجدد» button, the form dialog it opens with order/tracking/MI locked, every weight filled, submitted) and «… آنالیز های روزانه شماره ردیابی … را مشاهده می کند» (its `Then` checks which rows offer the button). API for the passive `Given`s («… نمونه گیری مجدد کرده باشد», «… به ترتیب ثبت با وضعیت های …») and the refused «تلاش می کند …» attempts (`POST boms/:id/resampling`; the «همان …» one also asserts 409 `bom-not-resamplable`). Outcome `Then`s read `POST boms/report` filtered by tracking number as یاشار. «جدیدی» means *not registered by a precondition*: every precondition records its daily BOMs per tracking number in registration order and lets a minute pass afterwards, since «آخرین» is decided by `createdAt` on a frozen clock. «… نمونه گیری مجدد می کند» is used both alone and amended by an «اما …» step, so the step file's `Before` hook looks ahead in the pickle and, when an amending step follows, the `When` fills the form without submitting. See `screenplay/bom-analyzing/resampling-bom.ts`. |
| audit-logging | API throughout, except the bulk-import rules (their own row, above). Review events (`Approved`, `Rejected`, `ReturnedToPending`) are found by kind *since a baseline* the precondition takes just before the change (`approval-audit-fixtures.ts`). A multi-line management note is written in one Gherkin cell with its lines joined by «؛ » (`audit-log-details.ts#auditValueFor` splits it back on `\n`). The weight-edit example's «… که وزن مواد اولیه "مسی" جز "مغزی" آن "3" است …» registers a fresh daily BOM and rebinds the `77777777-…` placeholder to it (`rebindRecordIdPlaceholder`), since row 8's composition has no such line. A weight field label «وزن جز X مواد اولیه Y» maps to the key `materialWeight:X:Y` |
| home/role-based-home-page | **UI** — the home page and the main menu are the point. «{actor} صفحه اصلی را مشاهده می کند» logs in through `/login` (landing on `/`) and waits for the shortcut groups; «میانبرهای صفحه اصلی او دقیقاً …» reads every group (`region` named by its `h2`) and the text of every link in it, and compares the sorted set of (گروه, میانبر) pairs exactly — an empty group counts as a pair of its own, so it fails too — then finds each expected shortcut by accessible name inside its group. The registration example clicks «ثبت آنالیز روزانه جدید» (which opens `/boms`' registration dialog directly) and reuses the daily-BOM form (`RegisterBom.fromTheHomePageUsing`); the standard BOM it needs is registered by یاشار over the API first, and registring-bom's «آنالیز روزانه جدیدی ثبت شده باشد» reads `GET boms`. «… را از منوی اصلی باز می کند» opens the drawer if shut, expands each category on the page's trail (`main-menu-access.ts#MAIN_MENU_TRAILS`) and follows the link; its `Then`s check the page's heading at its address (plus, for اجزا, the loaded list with no alert). API for the role-change `Given` (`ChangeRoleOfPersona`: provision/log in the persona, then the admin checks the old role and `PATCH users/:id`). See `screenplay/home/`. |
| maintenance-management | UI for the plain-voice actions: register/rename equipment and activities (`/equipment`, `/maintenance-activities`), add to a plan / change an interval / deactivate an item (issue #91 — nothing is removed from a plan any more: the row menu's «غیرفعال‌سازی», then the confirmation; `/pm-plans` — equipment is chosen by clicking its card, a link named by the equipment, on the «تجهیزات فعال» board, which shows every non-retired equipment, plan or not (issue #92); that opens its folder at `/pm-plans/:equipmentId` (`<h1>` = the equipment's name), and every add goes through the folder's «افزودن فعالیت» in «برنامه PM», present even when the plan is empty — `pm-plan.ts#OpenTheAddItemDialogFor`), retire equipment, view the daily list (`/pm-schedule/daily`, its `Then`s read that table by column header) and the overview (`/pm-schedule/overview`, «برنامه PM» — see below), and recording **with** or **without** notes (the daily row's «ثبت انجام» dialog). API for every «تلاش …» attempt (403; the hours-based plan → 400 `usage-based-interval-not-supported`; on a deactivated row, `PATCH …/pm-plan-items/:itemId` and `POST …/executions` — 409 `pm-plan-item-deactivated` — and the reactivation no route offers, `DELETE …/:itemId/deactivation` → 404; their `Then`s read the plan, not the response, and a «تلاش …» recording logs its persona in first if no step did — `personas.ts#LogInAsPersonaUnlessLoggedIn`), every precondition (deactivation: `POST equipment/:id/pm-plan-items/:itemId/deactivation` → 204; «… بوده و غیرفعال شده باشد» lets a minute pass afterwards, so the inactive list's `deactivatedAt` order is the Gherkin's), and the plain «… انجام … را ثبت می کند» — who may record and which occurrence it lands on are backend rules, and an early recording has no daily row to click. Facts are read by یاشار over the API (`GET equipment/:id`, `…/maintenance-history`, `pm-schedule/daily`, `pm-schedule/overview?from&to` — a range is required since issue #90, so single-occurrence reads send the one due date as both bounds). «… در برنامه روزانه «<date>» نباشد» moves the clock to that day first. «وضعیت … برای موعد … «…» باشد» reads the overview page after «برنامه کلی … را مشاهده می کند», the overview API otherwise (`common/pm-schedule-view-context.ts`); «مقدار تاخیر … در برنامه کلی … «…» باشد» likewise (the page's «مقدار تاخیر» column, or `daysLate`), and «مقدار تاخیر … در سابقه تعمیرات … «…» باشد» always reads the history API. The active plan is `planItems`, the deactivated rows `inactivePlanItems`; «فعالیت های غیرفعال تجهیز …» reads the folder's «فعالیت‌های غیرفعال» sheet after an add or a deactivation through the folder, `inactivePlanItems` otherwise (`common/pm-plan-folder-context.ts`; «زمان غیرفعال شدن» is `deactivatedAt` in Tehran Jalali `yyyy/MM/dd HH:mm`). Its locators are `ASSUMPTION`s until the frontend builds it (`ui/pm-plans-page.ts`). `daysLate` is written «N روز», null as «-» (`maintenance-api.ts#delayAmountLabel`). Unquoted «تعویض روغن اکسترودر 1» is `{maintenanceTask}`, split at the equipment registered in the scenario (`maintenance-records.ts#theMaintenanceTaskNamed`). Dates cross HTTP as ISO `YYYY-MM-DD` (`jalali-datetime.ts#jalaliDateToIsoDate`). See `screenplay/maintenance-management/`. |
| maintenance-management/pm-schedule-overview | **UI** for every «… مشاهده می کند»: the page opens on its calendar, so the table steps click «جدول PM», choose the filter the step names («تجهیز», «انجام دهنده» — `mat-select`s, a performer by the name the backend stores) and pick «از تاریخ» / «تا تاریخ» from the Jalali calendars, then wait until nothing loads **and** every row answers the choice (so the default month's rows are never read as the range's); the `Then`s read the table by column header. The calendar step turns the month with «ماه بعد» / «ماه قبل» (click count worked out once from the month title) and its `Then`s open every chip's details dialog — the chip shows no due date or delay — keyed by the day's `aria-label`; a day with «+N مورد دیگر» is refused, not half read. Older scenarios' no-range «… برنامه کلی … را مشاهده می کند» switches to the table and keeps its default (current Jalali month by the synced browser clock — their dates are all in «امروز»'s month). **API** for the «تلاش …» invalid-range outline (`GET pm-schedule/overview` without `from`/`to` or reversed → 400 `invalid-pm-schedule-range`) and every precondition — recordings, removal (now carried out by deactivating — `POST equipment/:id/pm-plan-items/:itemId/deactivation`, issue #91) and retirement (`POST equipment/:id/retirement`) on a named day by a named persona (`maintenance-records.ts#asPersonaOn`: clock first, then log in). The access-denied overview attempt sends a valid range so only a 403 can refuse it. Every locator is an `ASSUMPTION` until the page exists (`ui/pm-overview-page.ts`). See `screenplay/maintenance-management/pm-schedule-overview.ts`. |
| maintenance-management/technical-management-dashboard | **UI** for every «… داشبورد مدیریتی فنی را (برای «…») (با بازه «…») مشاهده می کند»: `/pm-dashboard` («داشبورد مدیریتی فنی»), choosing the «تجهیز» and «بازه زمانی» `mat-select`s only when the step names them (otherwise the page's default, «30 روز اخیر» and «همه تجهیزات»), then waiting until both filters show the choice and nothing loads. Every `Then` reads that page: the four current cards (buttons named by their title, number first after it), the «عملکرد PM» and «پوشش برنامه PM» panels' `<dt>`/`<dd>` figures, the «فاقد برنامه» list (links to `/pm-plans/:id`, opened unless already showing, compared as a set), and the «بیشترین عقب افتادگی» / «برنامه هفت روز آینده» tables by column header, exactly and in order. Figures are compared with Latin digits and `%`, «—» kept. **API** for the «تلاش …» outline (`GET pm-dashboard` → 403) and every precondition, as the system admin on the day it names; «حذف» is deactivation (issue #91). The bulk preconditions live in `pm-dashboard-fixtures.ts`: «در 30 روز اخیر موعد 10 کار گذشته باشد …» counts back from the system's today (ten invented activities on the background's equipment, all due a third of the period back, recorded that day / the next / never, then the clock restored); «20 تجهیز فعال … که 15 تای آن ها …» tops up what the system has and notes the unplanned ones for «همان 5 تجهیز»; «از موعدهای … فقط موعد «…» بدون انجام مانده باشد» precedes the scenario's «امروز …», so a `Before` hook reads that day off the pickle and the step records every other occurrence due before it, on its due date. «انجام موعدهای … به صورت زیر ثبت شده باشد» would also match daily-pm-schedule's «انجام {maintenanceTask} ثبت شده باشد», which is therefore a regular expression refusing «موعدهای …». Every locator is an `ASSUMPTION` until the page exists (`ui/pm-dashboard-page.ts`). See `screenplay/maintenance-management/pm-dashboard.ts`. |
| issue #94, dependency-based edit/delete policy — bom-registration (material, component, product, standard BOM) | **UI** for every action, the «تلاش …» attempts included (this area's table sends only *access-denied* attempts through the API): deletions through `Delete*.using`, renames and code/MI/brand edits through `Edit*.using`, a standard weight through the edit form's weight field (`record-dependencies.ts#ChangeAStandardWeightOf`), and the three composition changes through `edit-product.ts#ChangeProductComposition` (rows found by their picker's value — `ProductsPage.componentRowNamed` / `materialRowNamed`). A refusal leaves the dialog open, and «به او گفته شود که … در N <محصول/آنالیز استاندارد/آنالیز روزانه> "…" استفاده شده است» reads its alert (`ui/dialog-alert.ts`): «N <label>» and the name, digits made Latin (the page writes «۱ محصول») and whitespace collapsed (`common/record-dependents.ts`). **API** for every precondition and fact, as یاشار via `observer.ts#performAsTheSystemAdmin` (`bom-registration/record-dependencies.ts`). «… فقط در آنالیز استاندارد "MI-100" …» is unreachable publicly (a standard BOM clones its product, which then stays), so it is a product plus MI-100 and the `Then` asserts only the `standard-bom` entry. «… ویرایش نشده باشد» / «ترکیب … تغییر نکرده باشد» compare with a snapshot the attempt's own step takes first. |
| issue #94 — resampling-bom, registring-equipment, registring-maintenance-activity | **API** for the «تلاش …» attempts, as these areas do for every attempt (and a re-sample shares the order number the `/boms` row actions are named by): `DELETE boms/:id` of the re-sampled rejected BOM (`resampling-bom.ts#AttemptToDeleteTheResampledDailyBom`, logging مصطفی in first), `PATCH equipment/:id` / `maintenance-activities/:id`. «به او گفته شود …» asserts the 409 `record-has-dependents` envelope and one `dependents` entry: `resampled-daily-bom`; `equipment-pm-plan` with the equipment's name; `equipment-pm-plan` with count N. The shared plan-item preconditions («فعالیت … در برنامه تجهیز … باشد / بوده و غیرفعال شده باشد») now register the equipment unless registered, since these two features state them with no background. |
| issue #108 — activity specialty, operating hours | Every activity has a `specialty` (`electrical` «برق» / `mechanical` «مکانیک», null for legacy ones); a step that names none registers «مکانیک» (`maintenance-api.ts#UNSTATED_SPECIALTY`), and an API rename sends the specialty back unchanged. **UI** for «… فعالیت جدیدی با نام … و تخصص … ثبت می کند», «… بدون تخصص …» (the dialog's «تخصص» radio group left empty) and «… تخصص فعالیت … را به … تغییر می دهد»; **API** for «… با هر دو تخصص …» (a radio group can't hold two — `specialty: [both]` → 400 `validation-error`), so «پیغام خطای تخصص فعالیت» branches on `maintenance-activity.ts#attemptedTheSpecialtyThrough`. «تلاش … تخصص … تغییر دهد» is `PATCH` (409). Legacy activities come from the test-only `POST testing/maintenance/legacy-activities`; the full «… تخصص فعالیت های قبلی را به صورت زیر تعیین می کند» goes through the system admin's sign-in modal (`ui/specialty-assignment-dialog.ts`), the partial one and the «تلاش …» through `POST maintenance-activities/specialty-assignment` (400 `specialty-assignment-incomplete` / 403). When یاشار himself just acted, facts are read by رضازاده (`maintenance-records.ts#asAMaintenanceObserver`), since provisioning or reading as یاشار would overwrite the response being judged. Operating hours: **UI** for every «… با / بدون ساعت کارکرد … ثبت می کند», valid or not (the record dialog's «ساعت کارکرد دستگاه», a text field — the Gherkin types «abc»); «ساعت کارکرد آن در سابقه تعمیرات …» reads the newest history entry over the API («N ساعت» / «ثبت نشده», `operatingHoursLabel`). Overview: the «تخصص» `mat-select` beside «انجام دهنده», chosen in the table view or, for «… تقویم … برای ماه … و تخصص … مشاهده می کند», on the calendar after turning to the month (`ViewPmCalendar.forMonthAndSpecialty`). The daily list and the folder's «فعالیت‌های غیرفعال» sheet are read across every table on the page (one per specialty group — `ui/specialty-group`, headed «برق» / «مکانیک» / «تخصص تعیین نشده», in that order — `TheRowsOfEveryTable`); an inactive listing's deactivation order therefore holds only within one specialty, and every scenario reading it uses the one unstated specialty. An empty daily list draws no table, only its «امروز کار سررسیده …» paragraph. |
| issue #94 — registring-user (history survives account changes) | **API throughout**. The history is made by the persona: «… آنالیز روزانه "…" را ثبت کرده باشد» registers it as them on a fresh standard BOM; «اینکه مسلمی انجام … را در "…" ساعت "…" ثبت کرده باشد» first sets up equipment, activity and a plan item due that day (equipment = the trailing «<name> <number>» of the unquoted task, since nothing is registered — `execution-history-fixtures.ts`). Facts: `GET boms/:id`'s `registeredBy`, the maintenance history's `performedBy` (`pm-executions.ts#EnsureExecutionPerformerIs`), the user list by persona username (`authentication/account-history.ts`). |
| issue #110 — System Admin exceptions (corrections, deletions, reactivation) | **UI** for the five corrections («… تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند» / «… اما … تایید نمی کند»): the record's edit dialog, then the correction confirmation stacked over it (`ui/correction-confirmation-dialog.ts`, «اعمال در اطلاعات و سوابق مرتبط», «تایید» / «انصراف»; `common/correction-confirmation.ts`). The duplicate-code case confirms only if asked (`ConfirmTheCorrectionIfAsked`), because the order of the uniqueness and dependents checks is not pinned. **UI** for «سابقه انجام … را حذف می کند» (the folder's «سابقه PM» row's «حذف سابقه»), «همه سوابق ردیف فعال … را حذف می کند» (the row menu's «حذف همه سوابق»), «ردیف غیرفعال N روزه … حذف می کند» («فعالیت‌های غیرفعال» row's «حذف ردیف»), «تجهیز … را حذف می کند» and the reactivations («فعال سازی دوباره», a radio per active row; regular-expression steps parse «را با …», `equipment-lifecycle.ts#reactivationChoicesIn`). The per-row buttons share one name and are reached through their row (`maintenance-pages.ts#ClickInTheRowWhere`). **API** for every «تلاش …» attempt and every precondition: `DELETE …/executions[/:executionId]`, `DELETE equipment/:id/pm-plan-items/:itemId`, `DELETE equipment/:id`, `POST equipment/:id/reactivation`, and the audit precondition `PATCH materials/:id` with `applyToRelatedRecords: true`. Facts are read over the API, renamed or deleted equipment by its current name (`readTheEquipmentNamed`). «پیش از ردیف فعلی، ردیف دیگری …» deletes the background's active row (and its executions), makes and deactivates the earlier row on its day, re-adds the row and re-records its executions as یاشار, then restores the clock (`putAnEarlierInactiveRowBeforeTheActiveOne`). «انجام X و Y … ثبت شده باشد» records each task (`theMaintenanceTasksNamed`). The prefixes «ردیف فعال / ردیف غیرفعال …» are told apart inside the shared history steps. Audit labels: `audit-logging/system-admin-exception-audit.ts`. The background's row 5 registers «مسی» with «M-100». |
| planning/registring-order (issue #101, orders) | **UI** for the plain active `When`s on `/orders` («سفارشات», `ui/orders-page.ts`, every locator an `ASSUMPTION` until the page exists): «… سفارش … را با کد(های) MI … تعریف می کند» («تعریف سفارش», the «کدهای MI» multiple select, «ثبت»), «… اطلاعات سفارش جدید … وارد میکند» + «اما شماره سفارش را خالی میگذارد», «… کد MI … را به سفارش … اضافه می کند» (row's «افزودن کد MI»), «… شماره سفارش … را به … تغییر می دهد و کد MI … را از آن برمی دارد» (row's «ویرایش»), «… سفارش … را حذف می کند» (row's «حذف», then the dialog's «حذف») and the System Admin's renumbering «… و اعمال آن … را تایید می کند / اما … تایید نمی کند» (edit dialog, then the shared correction confirmation; onto a number already taken the confirmation is given only if asked — told apart by the orders noted first). **API** for every «تلاش …» (`POST orders`, `POST orders/:id/mi-codes`, `PATCH orders/:id` — `miCodes` replaces the list, so removing a code sends the list without it — `DELETE orders/:id`; ids looked up by یاشار first, `GET orders/by-number/:n`), every precondition and every fact (`GET orders`, read by یاشار — or by مصطفی, with the session the Background gave him, when یاشار is the actor under test, since reading as یاشار would overwrite the response the next «به او گفته شود …» judges: `observer.ts#performAsAnObserverOtherThanTheActor`). Every «تلاش …» notes the orders first (`planning/order-details.ts#NoteTheOrders`), so «… ویرایش نشده باشد» / «سفارش جدیدی ثبت نشده باشد» compare with that. Refusals: 403 (`EnsureAccessWasDenied`), 400 `validation-error` field `miCodes`, 409 `order-number-taken`, 400 `order-mi-code-not-found`, 409 `order-mi-code-already-assigned`, and 409 `record-has-dependents` (kind `daily-bom`, read by registring-standard-bom's «به او گفته شود که … در N آنالیز روزانه …»). «پیغام خطای شماره سفارش تکراری …» follows both an API attempt and the browser correction, so it dispatches on `common/order-door-context.ts`. The legacy carry-over uses the test-only `POST testing/boms/legacy-daily-boms` (as یاشار, then reviewed by مصطفی into the row's status) and `POST testing/boms/order-backfill`; «… هیچ یک از آنالیزهای روزانه قبلی تغییر نکرده باشد» compares `GET boms/:id`'s order/tracking number, MI code, components, `approvalStatus` and `editHistory` with a snapshot taken after the precondition. See `screenplay/planning/`. |
| issue #101 — orders across the suite | **A daily BOM can only be registered for a defined order holding its MI code.** `register-bom.ts#RegisterBomAndRememberIt` — the funnel every API daily-BOM precondition in the suite goes through — has یاشار define the order or assign it the missing MI code first (`planning/define-order.ts#defineOrderAsTheSystemAdminUnlessDefined`, idempotent, keeps the spotlight); every UI registration (registring-bom's steps, the preview preconditions in `bom-preview.ts`, `home/register-from-home.ts`) and every edit onto a fresh order number does the same before driving the form. The audit-log background defines row 8's order at its noise instant, so the order's own audit event never sorts among the ten rows. The daily-BOM form now starts from «شماره سفارش»; «کد MI» (`BomsPage.miCodeSelect`, a plain `mat-select`) offers only that order's codes and is pre-selected when there is one — so an MI code is chosen, never typed, and «۰۰۰۱» picks the «0001» option. registring-bom's new rules: plain registrations and edits (MI code chosen in the edit form's «کد MI»; order number typed) through `/boms`; every «تلاش …» over HTTP (`POST boms` without `standardBomMiCode` → 400 `bom-mi-code-required`, «پیغام خطای کد MI نشان داده شود» then dispatched on `common/mi-code-error-context.ts` against registring-standard-bom's form error; `bom-mi-code-not-in-order`; `bom-order-not-defined`; `PATCH boms/:id` with the new `standardBomMiCode` and the composition cloned from it). «اما شماره سفارش را خالی میگذارد» / «پیغام خطای شماره سفارش نشان داده شود» are said of both forms and dispatch on `common/order-number-form-context.ts`. registring-standard-bom's order rule reuses its issue #94 UI attempts; «… در 1 سفارش "…" استفاده شده است» reads the `order` dependents kind («سفارش»). See `bom-registration/daily-bom-order.ts`. |

**Grammatical voice is the signal.** A passive `Given` («اینکه یک جز در سیستم ثبت شده باشد») means
the precondition just needs to be *true*, so it takes the API (`RegisterComponent.viaApiUsing`); an
active `When` («{actor} جز جدیدی با اطلاعات معتبر ثبت می کند») means the scenario is demonstrating
*how*, so it drives the browser (`RegisterComponent.using`). Cucumber matches the two voices with
different expressions, so the split happens at the step-definition level with nothing to configure
— and the feature file knows nothing about it: no `@ui`/`@api` tags, no Cucumber profiles.

It's a signal, not a law — a backend rule with no screen as the point stays on the API door even
when phrased actively. The access-denied attempts («{actor} تلاش می کند جز جدیدی ثبت کند») are
active but go through `viaApiUsing`, since the rule under test is the backend's 403. Likewise
`bom-dashboard.feature`'s score rule: its `When`s open the dashboard in the browser, but the page
shows no per-analysis score (only the score-desc order of its panels), so the two score `Then`s
read it from `POST boms/dashboard/:productId/daily-boms` — the ordering one still checks the
on-screen order of the order numbers too. See
`screenplay/bom-analyzing/bom-dashboard-product-details.ts`.

**An open dialog hides the page from role locators.** Angular CDK's overlay marks everything
behind a `mat-dialog` `aria-hidden`, and `By.role` skips `aria-hidden` content — so a list row is
unreachable while a dialog is up. A successful daily-BOM registration leaves the preview dialog
open, which is why «آنالیز روزانه جدیدی ثبت شده باشد» checks `GET boms` rather than the list
(`register-bom.ts#EnsureBomWasRegistered`). Any new step that reads the `/boms` list after a UI
registration must close the preview first, or read the API.

## Commands

Runs in Docker via the Makefile. Prerequisites: Docker, Docker Compose, `make`, and **both test
stacks running** — `make run` drives a browser at the frontend on 4201, so a suite run against the
backend alone fails rather than merely covering less. The root `make run-acceptance-tests` starts
both in the right order.

```bash
make setup               # create .env from .env.example (no-op once it exists; `up` runs it)
make up                  # build (if needed) and start this container in the background
make down                # stop and remove the container
make restart             # down, then up
make build               # rebuild the image
make logs                # tail the container's logs
make ps                  # container status
make sh                  # open a shell in the container
make run                 # run the full acceptance suite
make render-living-documentation   # render the living documentation from the last run
make open-living-documentation     # render it, then open it in the browser
make npm <script>        # run any package.json script inside the container
make help                # list all available make targets
```

Code-quality checks. The bare targets are read-only; the `fix-` ones write:

```bash
make lint                # ESLint check (read-only, no changes)
make fix-lint            # ESLint + auto-fix
make format              # Prettier check (read-only, no changes)
make fix-format          # Prettier auto-format
```

These need nothing running — each is a throwaway `docker compose run --rm` (the `fix-` ones still
write, through the bind mount). They cover **only** the `.ts` files under `screenplay/`,
`step-definitions/` and `support/` — `cucumber.cjs`, `scripts/`, configs, Markdown and `.feature`
files are neither linted nor formatted. ESLint runs Prettier as a rule, so `make fix-lint` already
reformats. `.prettierrc` sets no `printWidth`, so this project wraps at 80 columns, narrower than the
frontend's. Prefer the targets over `make npm <script>`: `make npm lint` runs the linter twice.

From a shell inside the container (`make sh`):

```bash
npm test                                                          # cucumber-js --tags 'not @wip'
npx cucumber-js -p selected specs/authentication/logging-in.feature    # one feature file
npx cucumber-js -p selected specs/authentication/logging-in.feature:7  # one scenario, by line number
npx cucumber-js --tags '@wip'                                     # only @wip scenarios
npx cucumber-js --dry-run --format summary                        # resolve every step without running it
npx tsc --noEmit                                                  # typecheck
```

**Running part of the suite needs `-p selected`.** The `default` profile sets
`paths: ['specs/**/*.feature']`, and Cucumber *adds* command-line paths to it — so a bare
`npx cucumber-js specs/….feature` silently runs the whole suite (behind an easy-to-miss "specified
paths in both your configuration file and as CLI arguments" warning). `selected` is the same
configuration without `paths`. Tag filters need no profile.

`--dry-run` is the cheapest way to prove a new step definition is neither missing nor ambiguous: it
matches every step and runs none of them, so it needs no stack up.

`npm test` is `node --env-file=.env … cucumber-js`, so **it fails outright if `.env` is
missing**. The `npx` forms skip that flag and still get the variables from Compose's `env_file` — so
they only work *inside* the container.

`tsconfig.json` lists `"dom"` in `lib` on purpose (Playwright's types describe browser APIs); don't
tidy it away.

### Pending scenarios, and what `@wip` actually means

Two different things can be unfinished about a scenario, and they are marked differently:

| State | Marker | In the living documentation? |
| ----- | ------ | ---------------------------- |
| The **business** hasn't settled it — wording or the rule itself still under discussion | `@wip` | **No.** `npm test` filters it out with `--tags 'not @wip'`, deliberately: unagreed behaviour must not be published as a description of the system. |
| Agreed by the business, **not automated yet** | **no tag**; step definitions that `return 'pending'` | **Yes**, as Pending. This is the default for specification written ahead of implementation. |
| Agreed and automated | no tag; real step definitions | Yes, as Passing. |

"Not automated yet" is **not** a reason to reach for `@wip`, and removing the tag is a business
decision rather than an engineering one.

Never leave a scenario `UNDEFINED` on `main` — a third state the table doesn't cover. Three things
to know when writing automation:

- **`strict: false` in `cucumber.cjs` tolerates `PENDING` only.** Cucumber fails on an `UNDEFINED`
  step *unconditionally*, as on ambiguous and failing ones. **Watch the exit code, not the
  summary**: Serenity maps `UNDEFINED` and `PENDING` to the same `ImplementationPending` outcome, so
  a forgotten definition still prints as "pending" in the console and the report. Only the non-zero
  exit distinguishes it.
- **Don't redefine a step another feature already implements.** A second definition is ambiguous,
  which fails whatever `strict` says. Background steps are the likeliest place this bites, since
  they tend to be shared across feature areas by design — e.g. the «… توسط مصطفی تایید شده باشد»
  approval precondition and its «… توسط مصطفی با دلیل "…" عدم تایید شده باشد» rejection twin, stated
  by approving-bom, bom-dashboard, reporting-bom and exporting-bom (each in an «اینکه» and a bare
  form), and «اکنون «…» ساعت «…» باشد», shared by daily-bom-edit-details, approving-bom and
  viewing-audit-log — all defined once in `step-definitions/common.steps.ts`. Within one area the
  owning feature's file holds it and the others say so in a comment: «جزئیات ویرایش آن آنالیز روزانه
  به صورت زیر باشد» lives in `daily-bom-edit-details.steps.ts`, «… از داشبورد … با دلیل … و سپس آن
  را تایید می کند» in `approving-bom.steps.ts`. Leave a comment where the redefinition would have
  gone, and let `npx cucumber-js --dry-run` prove there is exactly one match.
- **Every daily-BOM edit carries a reason** (issue #73, `screenplay/common/edit-reason.ts`): every
  UI edit fills «دلیل ویرایش» and every `PATCH boms/:id` sends `editReason` and `editSource`. A step
  that names no reason gets `ROUTINE_EDIT_REASON`. A new edit task that forgets it gets a 400
  `edit-reason-required` (or, in the form, an error that keeps the dialog open).
- **«{actor} وارد سیستم شده باشد» is both a precondition and an outcome.** logging-in.feature uses
  it as a `Then` («انتظار می رود سینا وارد سیستم شده باشد»); everywhere else it is a `Given`.
  Cucumber matches text alone, so the one definition in `common.steps.ts` branches on the actor's
  own notepad: if they just tried to log in through `/login` in this scenario
  (`logging-in.ts#HasJustTriedToLogInThroughTheBrowser`), it checks access was granted; otherwise
  it logs them in. The notepad is per actor and per scenario, so no earlier scenario can leave it set.
- **Givens a scenario repeats from its Background must be idempotent.** «آنالیز استانداردی با کد MI
  …» and «محصول … در سیستم ثبت شده باشد» check the system over the API first and reuse what is there
  (`RegisterStandardBomWithMiCodeUnlessRegistered`, `RegisterProductUnlessRegistered`). Don't use the
  suite's module-level registries for this check: they outlive a scenario, but the database doesn't.
- **Arity must match the captured parameters**, or Cucumber rejects the definition. Name the unused
  ones `_actor`, `_password` — ESLint's `argsIgnorePattern` is `^_`.
- **`/` in a step pattern is alternation, not a slash.** In a Cucumber expression `تایید/رد کننده`
  means "«تایید کننده» or «رد کننده»" and never matches the Gherkin's literal «تایید/رد کننده», so
  the step reads as undefined. Escape it: `'تایید\\/رد کننده آن {string} باشد'` in the TypeScript
  string. Only the pattern needs this — data-table keys (`row['تایید/رد کننده']`) and UI labels are
  plain strings.

## Architecture

```
specs/                                  # Gherkin. Organised by feature area, not by backend module
├── audit-logging/viewing-audit-log.feature
├── authentication/{logging-in,registring-user}.feature
├── bom-analyzing/{approving-bom,bom-dashboard,daily-bom-edit-details,resampling-bom}.feature
├── bom-registration/registring-{bom,component,material,product,standard-bom}.feature, importing-materials.feature
├── bom-reporting/{exporting,reporting}-{bom,standard-bom}.feature, reporting-bom-persian-digits.feature
├── home/role-based-home-page.feature
├── maintenance-management/{daily-pm-schedule,planning-preventive-maintenance,pm-schedule-overview,recording-maintenance-execution,registring-equipment,registring-maintenance-activity,technical-management-dashboard}.feature
└── planning/registring-order.feature   # orders (issue #101); screenplay/planning/, ui/orders-page.ts
step-definitions/                       # Thin: each step delegates to a task. One folder per feature area,
│                                       # one <feature>.steps.ts per feature file, plus:
│                                       # - common.steps.ts at the root: steps shared across areas
│                                       # - <area>/common.steps.ts: steps shared by features within one area
│                                       # - <area>/*-fixtures.steps.ts: a feature's large table-driven background
screenplay/                             # DOMAIN layer: what an actor does, in business language
├── <feature-area>/                     # tasks, questions, fixtures per feature area
│                                       # (bom-analyzing/daily-bom-approval.ts: the review vocabulary —
│                                       #  approve, reject, edit-then-approve, reviewer, management note)
├── common/                             # reusable across areas: clock, login, personas, problem-detail,
│                                       # downloads, and the dispatch modules (see below);
│                                       # observer.ts: readAsTheSystemAdmin (inside an Interaction) and
│                                       # performAsTheSystemAdmin (from a step — preconditions/facts as
│                                       # یاشار, keeping the spotlight and the actor's last response);
│                                       # record-dependents.ts: issue #94's «… استفاده شده است» checks
└── ui/                                 # INTEGRATION layer: Lean Page Objects (see below)
patches/                                # patch-package patches, applied on `npm ci` (see Gotchas)
scripts/brand-living-documentation.mjs  # post-render branding overlay (see Living documentation)
support/
├── actors.ts                           # Cast: assigns abilities (CallAnApi, BrowseTheWebWithPlaywright, TakeNotes) to every actor
├── config.ts                           # apiBaseUrl (trailing-slash normalised — see Gotchas), appBaseUrl
├── parameter-types.ts                  # Cucumber parameter types (see Gotchas)
├── system-clock.ts                     # scenarioStartInstant; the suite's record of what the backend's test clock reads
└── hooks.ts                            # BeforeAll / Before / After / AfterAll: Serenity config, browser, DB reset, clock, cast
cucumber.cjs                            # loads support/ + step-definitions/ via ts-node; profiles `default` (every feature) and `selected` (CLI paths only)
```

**Byte-identical steps across features dispatch on a context module.** Cucumber matches by text
alone, and the feature files are read-only, so when two features use the exact same sentence to
mean different things (a daily-BOM vs a standard-BOM report, a product's component vs a standard
BOM's), there is one step definition that branches on a flag in `screenplay/common/` —
`report-context.ts`, `daily-bom-list-context.ts`, `edit-target.ts`, `composition-context.ts`,
`material-statement-context.ts` (the last one tells an outcome from a precondition: «مواد اولیه «…»
با کد «…» در سیستم ثبت شده باشد» is a `Then` in importing-materials and a `Given` in
viewing-audit-log; within registring-material, «اینکه مواد اولیه … با کد … در محصول … استفاده شده باشد» sets it to `precondition` and the material correction `When`s set it to `outcome`, so the following «مواد اولیه … با کد … در سیستم ثبت شده باشد» is a precondition in the duplicate-code example and an outcome after a correction), `refusal-door-context.ts` (issue #94: whether the last «تلاش …» change or
deletion went through the browser or the API, so «به او گفته شود که … استفاده شده است» reads the
dialog's alert or the 409's `dependents`), and issue #101's three: `order-number-form-context.ts`
(«شماره سفارش» of the daily-BOM form or the order form), `mi-code-error-context.ts` («پیغام خطای کد
MI …» of the standard-BOM form or a daily-BOM registration over HTTP) and `order-door-context.ts`
(«پیغام خطای شماره سفارش تکراری …» from a 409 or from the order dialog).
**Every owning step sets the flag explicitly**, never only the non-default one, so a
scenario can't inherit a stale value from an earlier one in the same run. Add a new module of the
same shape rather than folding a new meaning into an existing one.

**Export checks read the real downloaded file.** `screenplay/common/downloads.ts` captures the
browser download triggered by a click and parses it with `read-excel-file` into a grid of display
strings; `bom-report-export.ts` and `standard-bom-report-export.ts` assert on that grid.

**Uploads send a real file too.** `screenplay/common/uploads.ts` clicks the visible button and
answers the browser's `filechooser` event — the hidden `<input type="file">` is never located. The
API door sends the same bytes as a native `FormData` (axios builds the multipart body).
`screenplay/common/task-depending-on.ts` is the escape hatch when a task's activities depend on
something the actor must find out first (an `Interaction` cannot perform activities).

### Time: one clock for the backend and the browser

The backend test stack's clock is frozen, and only the suite moves it. `support/hooks.ts` freezes it
at `scenarioStartInstant` (`support/system-clock.ts`) before every scenario with a raw
`POST testing/clock` — deliberately not `clock/reset`, so nothing depends on the backend's default.
Scenarios then move it with the tasks in `screenplay/common/clock.ts`: `FreezeTimeAt`
(`POST testing/clock`; the fixtures freeze before each login so a row's timestamp and the JWT's
`iat` come out right) and `LetTimePass` (`POST testing/clock/advance`).

**«اکنون «1403/06/15» ساعت «10:00» باشد»** (`LetItBeNow`) freezes at a Jalali date and an
**Asia/Tehran** wall-clock time (UTC+03:30, no DST) — `jalali-datetime.ts#tehranWallClockInstant`.
That zone is not arbitrary: the backend renders edit headings («… در 1403/06/15 ساعت 10:00 …») in
Asia/Tehran. `parseJalaliDateTime`, used by the older fixtures, reads the same text as UTC; the two
are deliberately separate. Freezing at 1403 moves the clock **back** from `scenarioStartInstant`, so
anything a background registered carries a *later* `createdAt` than "now" — a "today" date range will
not hold it (daily-bom-edit-details opens the dashboard with no range for that reason).

`support/system-clock.ts` is the suite's **record of what that clock reads**, because
`testing/clock` has no read endpoint. The hook resets it, and both tasks update it after each
request. **Any new way of moving the backend clock must update it too.**

**The browser needs the same clock**, and that is what the record is for. The frontend drops a
session whose JWT `exp` has passed **by the browser's own clock**, while the test backend stamps
`exp` (`iat` + 1h) from its frozen one — a browser on wall-clock time discards every token and
bounces every protected page to `/login` (symptom: every UI scenario fails on "waits until page
heading does become visible"). `SyncBrowserClockWithTheSystem` sets the actor's Playwright context
to the recorded instant (`context.clock.setSystemTime`); it runs at the start of `LogIn.using`
(`screenplay/common/login.ts`), before the first navigation.

**`LetTimePass` does not move a browser that is already open.** That is fine today — "یک ساعت گذشته
باشد" still ends the session via the backend's 401 — but a scenario that needs the *frontend's own*
expiry check, or the browser's "today" after a clock move, must call `SyncBrowserClockWithTheSystem`
again first.

**A forward jump expires every API session issued before it.** The backend checks `exp` against
its frozen clock too, so after «امروز «1405/07/15» باشد» (`LetItBeToday`, frozen at 10:00 Tehran)
a background login months earlier answers 401. The maintenance steps therefore renew the session
of the actor in the spotlight afterwards (`personas.ts#RenewApiSession`, which re-logs in with the
credentials `LogInAsPersona` noted; `maintenance-records.ts#letItBeToday`), and every precondition
or observer moves the clock **before** it logs in (`asTheSystemAdminOn`). Browser sessions need
nothing of the kind: every UI task logs in through `/login` afresh, on the synced clock. The
testing endpoints take no auth, so an expired token never stops the clock from moving.

The three layers of `handbook:screenplay-guideline` map onto that tree: `specs/` is the
**Specification** layer, `screenplay/` minus `ui/` is the **Domain** layer, and `screenplay/ui/`
plus `support/` is the **Integration** layer. A layer depends only on itself or the one directly
below. In particular a step definition never touches `screenplay/ui/` — if a UI-driving task needs a
Lean Page Object that doesn't exist yet, that's the first thing to add, not something to work around
from the step definition.

### Lean Page Objects

`screenplay/ui/` holds **one Lean Page Object per page per feature area that drives it**. Where two
areas drive the same route, each gets its own, serving its own domain layer: `boms-page.ts`
(registration) and `bom-reports-page.ts` (reporting) both describe `/boms`, and `standard-boms-page.ts`
/ `standard-bom-reports-page.ts` both describe `/standard-boms`. Such a pair shares only the page
heading, which has to stay in step in both files. Chrome drawn once for every signed-in page — the
toolbar, account menu, log-out — lives in `app-shell.ts`, not on any page's object. Likewise the
one widget every dialog shares, its `role="alert"` banner (`app-error-banner`), lives in
`dialog-alert.ts` (`OpenDialog.alert()`, scoped to the open `role="dialog"`); a refused edit or
delete of a record other records use is told there (issue #94).

Anything still unconfirmed against real markup is marked `ASSUMPTION` in its comment. Class anchors
(`.analysis__*`, `td.mat-column-*`) are **not** protected by the accessibility gate, and each such
locator's comment says so.

The contract: `screenplay/ui/` **locates elements and reports what they say. Nothing else** — no
assertions, no tasks, no driver. Behaviour lives in the tasks that use them. Elements should be
found by what a person would read — the `<label>` above an input, a button's text — because the
frontend's accessibility gate fails the build if an input loses its `<label for>`, so the label is a
contract that something else keeps honest. Reaching an accessible name still means anchoring on some
structure first (a wrapper element, a role, a class); keep those anchors few, and keep them here.

### Screenplay vocabulary, as implemented here

- **Actors** are the people (or roles) named in the feature file — e.g. یاشار, مصطفی. They are
  created by `Actors` (`support/actors.ts`), Serenity's `Cast`.
- **Personas** (`screenplay/common/personas.ts`, roles in `roles.ts`): یاشار مدیر سیستم (seeded by
  the backend; stored name «System Admin», hence `realNameFor`), مصطفی مدیریت, نیکروش بازرس کنترل
  کیفیت, سینا گزارشگیر, رضازاده مدیر فنی (`technical_manager`), مسلمی بازرس PM (`pm_inspector`).
  Every persona but یاشار is provisioned on first login through یاشار's admin access. The two
  maintenance roles reach nothing outside maintenance, which is why every older «تلاش کاربر بدون
  دسترسی …» outline lists them too.
- **Abilities** are what an actor *can do*. Every actor gets three: `CallAnApi` (from
  `@serenity-js/rest`), `BrowseTheWebWithPlaywright` (from `@serenity-js/playwright`) and
  `TakeNotes`. Every actor can therefore use either door, and the *task* decides which — that is
  what makes blended testing possible. **Each actor gets their own notepad and their own browser
  context**, so nothing one actor did can leak into another actor's scenario.
- **Tasks** are what an actor *does*, in business language — e.g. `RegisterComponent`, `LogIn`.
  Assertions are tasks too, by convention named `Ensure*`.
- **Questions** are what an actor *knows* — e.g. `EnsureValidationErrorFor`'s
  `FieldsThatFailedValidation`.

**Name a task for its goal, put the route in the method name.** Where a goal is reachable more than
one way, the variants live on one object: `RegisterComponent.using` drives the form while
`RegisterComponent.viaApiUsing` posts the payload (`RegisterProduct`, `RegisterMaterial` and the
rest follow suit). That is what lets a step swap one for another without the feature file noticing.
Don't name a task `RegisterComponentViaTheForm`; the goal is registering the component, and the form
is how.

Step definitions stay thin — they translate a Gherkin line into `actor.attemptsTo(...)` and nothing
more. Logic belongs in tasks. Anything reusable across feature areas goes in `screenplay/common/`.

### Assertion conventions

**One reusable envelope check, then one distinguishing fact.** `EnsureProblemDetail(status, slug)`
(`screenplay/common/problem-detail.ts`) asserts the whole RFC 9457 envelope — `Content-Type:
application/problem+json`, `type`, `title`, `status`; domain tasks such as `EnsureValidationErrorFor`
build on it and add only what makes them different. **Assert `type`, not `detail`** — `detail` is
optional per RFC 9457.

**Assert the API as it is built, not as you wish it were.** Don't assert a problem type the backend
does not emit — that turns a passing scenario into a parked pending one.

**Through the UI, assert what the visitor sees.** A UI step asserts the rendered message, the page
it stayed on, what the interface offers — never a status code or a token, which aren't things a
visitor can observe.

### Waiting, and where it belongs

**Every step that reaches into freshly rendered markup must wait for it first.** Angular bootstraps
the shell and lazy-loads each route *after* the browser's load event, so a `Click` or `Enter`
issued straight after a navigation can find nothing and fail on the spot with a
`ListItemNotFoundError`. `Wait.until` is what survives that — it treats an empty match as "not yet"
and polls (`@serenity-js/core`'s `WaitUntil` ignores `ListItemNotFoundError` explicitly, on the
grounds that "lists might get populated later").

**The wait belongs in the locate task, not in the task that follows it.** Each page has a
`Locate<Page>Page` task (`LocateComponentsPage`, `LocateBomsPage`, …) that navigates and ends by
waiting for the page heading to be visible; each `Open…Form` built on it ends by waiting for the
form's first field, so the task that fills it in can simply type. This matters most when the
frontend container is cold and Vite still has to compile a route's chunk on demand.

`isVisible()` is safe to wait on even when the element is absent: it is `and(isPresent(), …)`, and
`and` short-circuits, so a conditionally rendered banner polls rather than erroring.

**But `isVisible()` means "on screen and not covered", not "rendered".** Beyond Playwright's own
check, `@serenity-js/web`'s `scripts/isVisible` hit-tests the element's centre with
`document.elementFromPoint`, so anything scrolled out of view — a row further down a scrolling
`mat-dialog-content`, an older row below the fold of a list — **never** becomes visible, and a
`Wait.until(…, isVisible())` on it times out. For such elements wait on `isPresent()` and let
`Click.on` (Playwright's own click, which scrolls into view and checks actionability) do the rest;
`RemoveFromTheChangeList` (`material-import.ts`) is the worked example.

**Submitting a form means clicking *and waiting for the answer*.** A submit task should poll until
the site has had its say — the dialog has closed, or it has told the visitor what was wrong
(`WaitForThe…FormToBeAnswered`) — because a person doesn't walk away from a form mid-request, and
without it a following clock advance or navigation can race a request still in flight. The
bom-registration form and delete-confirmation polls also stop when the dialog shows its alert
(`common/dialog-answer.ts#theOpenDialogShowsAnAlert`), since a refusal keeps the dialog open; and
when their 5 s deadline passes with the dialog still open and silent they **throw**
(`theDialogWasNotAnswered`) rather than return, so no following step judges a request whose
answer never came.

### Living documentation

Two phases:

1. `make run` — the `@serenity-js/serenity-bdd` crew member writes one raw JSON file per scenario
   into `target/site/serenity/` (`ArtifactArchiver` in `support/hooks.ts`), and
   `Photographer.whoWill(TakePhotosOfFailures)` adds a PNG whenever a UI step fails — failures
   only, so the report isn't swamped.
2. `make render-living-documentation` — the Serenity BDD **Java** CLI (hence `default-jre-headless`
   in the Dockerfile) aggregates those into `target/site/serenity/index.html`. It renders the last
   run; it runs no tests.

`target/` is bind-mounted, so the site opens straight from the host. `make open-living-documentation`
is the one target that runs on the host (a browser can't launch from inside a container); like
`render-living-documentation`, it needs the container up.

Artifacts **accumulate** across runs — if the counts look wrong, or a fixed failure's screenshot is
still sitting there, clear it out and re-run. The files are written by the container as root, so
`docker compose exec app rm -rf target` rather than `rm -rf target` from the host.

**Branding.** `npm run report` (what the target wraps) runs `scripts/brand-living-documentation.mjs`
after the render, rewriting `target/site/serenity/` in place: Cablan logo, `rtlcss`-mirrored CSS,
Vazirmatn, `lang="fa" dir="rtl"`, and chrome strings translated from `branding/translations.json`
and `branding/chart-labels.json`. The Serenity BDD CLI offers no template override, so this is
coupled to its current markup, not a versioned contract — the script's own comments explain the
mechanics. Two rules:

- **After bumping any `@serenity-js/*` package, re-render and spot-check `index.html`** (RTL, logo,
  a sample of translated labels). An upstream change fails silently, as untranslated or unmirrored
  chrome.
- **Never translate the ALL-CAPS outcome words** (`PENDING`, `SUCCESS`, …): they double as CSS
  classes and hidden DataTables sort keys, so translating them breaks sorting and filtering. Add a
  dictionary entry only after finding the string in the rendered output and confirming it is
  neither.

## Gotchas

**Resource URIs must be relative, with no leading slash.** Serenity's `CallAnApi` resolves them with `new URL(uri, apiBaseUrl)` — *not* axios's `combineURLs`. `new URL('/users', 'http://host/api')` discards the `/api` segment and yields `http://host/users`, so every request 404s. `support/config.ts` guarantees the base URL ends in a slash; always write `PostRequest.to('users')`, never `PostRequest.to('/users')`. Browser navigation is the opposite: `Navigate.to('/login')` resolves against the Playwright context's `baseURL`, and there the leading slash is right.

**`localhost` works because the container shares the host's network** (`network_mode: host`).
There is no shared Docker network and no service-name DNS — `http://app:3001` would not resolve.
`localhost` is also the only host the browser can use: Vite 403s an unrecognised `Host`, and
Chromium force-upgrades `.app` to HTTPS (see `../frontend/CLAUDE.md`).

**Chromium lives in this image**, installed by `npx playwright install --with-deps chromium` at
whatever version `playwright` pins — so a Playwright upgrade is an ordinary dependency bump. If the
build dies with `403 ... this service is not available in your location`, the CDN is geo-blocked;
set `PLAYWRIGHT_DOWNLOAD_HOST` in `.env` to a mirror.

**`@serenity-js/serenity-bdd` is patched.** Its `dashify` strips every non-ASCII letter (`\W`), so
a scenario or Rule name written wholly in Persian gets an empty id and the Java aggregator silently
drops it — the report undercounts with no error. `patches/@serenity-js+serenity-bdd+<version>.patch`
fixes it via the `postinstall: patch-package` script; the Dockerfile copies `patches/` **before**
`npm ci`, since patch-package silently no-ops without it. **On any Serenity bump**, check whether
upstream fixed `dashify`: if so delete the patch, if not regenerate it against the new version.

**`@cucumber/gherkin` is overridden to 42.0.0** (`overrides` in `package.json`). `@cucumber/cucumber`
and `@serenity-js/cucumber` both pin 41.0.0, whose Persian dialect lacks keywords the specs use —
`قابلیت`, `قانون` (Rule), `با در نظر گرفتن`, among others. Drop the override only once both
dependencies ship a gherkin that has them.

**After a dependency change, the long-lived container needs `docker compose up -d
--renew-anon-volumes`.** `node_modules` is an anonymous volume, so `make up` alone keeps the old one
and `make run` fails with `Cannot find module '@serenity-js/...'`. `docker compose run --rm` (lint,
format, CI) gets a fresh volume every time, which is what makes this confusing.

**`actorCalled()` moves the spotlight.** Steps with no explicit subject resolve their actor via
`actorInTheSpotlight()`, which is whoever was named last. That is what the `{actorName}` parameter
type is for: it yields a bare name string *without* summoning the actor — useful whenever a step
names somebody who is **not** the actor currently in the spotlight, so a following `Then` doesn't
end up reading the wrong actor's (empty) last response. The approval precondition's
«توسط {actorName}» is the worked example.

The parameter types (`support/parameter-types.ts`):

| Type | Matches | Resolves to |
|------|---------|-------------|
| `{actor}` | one Arabic-script word — `یاشار`, `مصطفی` | `actorCalled(name)` — creates the actor, takes the spotlight |
| `{actorName}` | the same | the plain string — no actor, no spotlight change |
| `{pronoun}` | `he`, `she`, `they` | `actorInTheSpotlight()` — defined but unused; the specs are Persian |

Neither name type matches Latin script. Add a new parameter type here when a feature area needs one.

## Environment

`.env` (copied from `.env.example` by `make setup`, which `make up` runs for you):

- `API_BASE_URL` — `.env.example` sets `http://localhost:3001/api`, the **test** stack. Beware:
  `support/config.ts` falls back to `http://localhost:3000/api` (the **dev** stack, which has no
  testing endpoints) when the variable is unset.
- `APP_BASE_URL` — `http://localhost:4201` (`.env.example` and the `config.ts` fallback), the
  **test** frontend, whose `/api` proxy points at the same backend. Pointing it at 4200 would drive a
  UI wired to a database this suite never truncates.
- `PLAYWRIGHT_DOWNLOAD_HOST` — build-time only, and commented out by default. See Gotchas.

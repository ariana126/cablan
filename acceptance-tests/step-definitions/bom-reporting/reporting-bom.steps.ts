import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  AttemptToViewBomReportListWithoutLoggingIn,
  anonymousVisitorActorName,
  EnsureAllRegisteredDailyBomsAreShown,
  EnsureDailyBomsShownInOrder,
  EnsureOnlyDailyBomsWithOrderNumbersShown,
  ViewBomReportList,
} from '../../screenplay/bom-reporting/bom-report-list';
import { OpenBomReportDetails } from '../../screenplay/bom-reporting/bom-report-details';
import { theBackgroundOrderNumbers } from '../../screenplay/bom-reporting/bom-report-fixtures';

const splitValues = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

When(
  '{actor} لیست آنالیز های روزانه را بدون فیلتر مشاهده می کند',
  (actor: Actor) => actor.attemptsTo(ViewBomReportList.unfiltered()),
);

Then('تمام آنالیز های روزانه ثبت شده نمایش داده شود', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureAllRegisteredDailyBomsAreShown(theBackgroundOrderNumbers()),
  ),
);

Then(
  'فقط آنالیز های روزانه با شماره سفارش {string} نمایش داده شود',
  (orderNumbersCsv: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOnlyDailyBomsWithOrderNumbersShown(orderNumbersCsv),
    ),
);

When(
  '{actor} لیست آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} مشاهده می کند',
  (actor: Actor, from: string, to: string) =>
    actor.attemptsTo(ViewBomReportList.filteredByDateRangeBetween(from, to)),
);

When(
  '{actor} لیست آنالیز های روزانه را با تاریخ و زمان ثبت از {string} تا اکنون مشاهده می کند',
  (actor: Actor, from: string) =>
    actor.attemptsTo(ViewBomReportList.filteredByDateRangeFrom(from)),
);

Then('آنالیز های روزانه به ترتیب زیر نمایش داده شود', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureDailyBomsShownInOrder(table.rows().map((row) => row[0])),
  ),
);

When(
  '{actor} جزئیات آنالیز روزانه با شماره سفارش {string} را باز می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(OpenBomReportDetails(orderNumber)),
);

When(
  '{actor} لیست آنالیز های روزانه را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده می کند',
  (actor: Actor, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      ViewBomReportList.filteredBySelectingValuesFor(
        field,
        splitValues(valuesCsv),
      ),
    ),
);

When(
  '{actor} لیست آنالیز های روزانه را با انتخاب مقادیر زیر مشاهده می کند',
  (actor: Actor, table: DataTable) => {
    const filters = table.hashes().map((row) => ({
      field: row['فیلد'],
      values: splitValues(row['مقادیر انتخاب شده']),
    }));
    return actor.attemptsTo(ViewBomReportList.filteredByCombination(filters));
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با عدم انتخاب مقدار {string} برای فیلتر {string} مشاهده می کند',
  (actor: Actor, value: string, field: string) =>
    actor.attemptsTo(ViewBomReportList.withValueDeselectedFor(field, value)),
);

When(
  '{actor} لیست آنالیز های روزانه را با عدم انتخاب همه مقادیر فیلتر {string} مشاهده می کند',
  (actor: Actor, field: string) =>
    actor.attemptsTo(ViewBomReportList.withAllValuesDeselectedFor(field)),
);

When('{actor} لیست آنالیز های روزانه را مشاهده می کند', (actor: Actor) =>
  actor.attemptsTo(ViewBomReportList.unfiltered()),
);

// "قانون: فقط کاربر وارد شده به سیستم مجاز به مشاهده لیست آنالیز های روزانه است" — no {actor} in
// the step text itself: this is an anonymous visitor who was never part of the background's own
// "سینا وارد سیستم شده باشد" login, so it acts as its own fixed identity
// (`anonymousVisitorActorName`), the same way `screenplay/authentication/logging-in.ts`'s own
// `loginAttemptActorName` does for that feature's anonymous login attempts. `actorCalled(...)`
// moves the spotlight onto it, which is what lets the shared, bare "از او خواسته شود وارد سیستم
// شود" Then (`step-definitions/common.steps.ts`) read ITS page state rather than سینا's.
When(
  'کاربری که وارد سیستم نشده تلاش می کند لیست آنالیز های روزانه را مشاهده کند',
  () =>
    actorCalled(anonymousVisitorActorName).attemptsTo(
      AttemptToViewBomReportListWithoutLoggingIn(),
    ),
);

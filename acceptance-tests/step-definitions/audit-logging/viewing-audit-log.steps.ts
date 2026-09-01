import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { realNameFor } from '../../screenplay/common/personas';
import { parseJalaliDateTime } from '../../screenplay/common/jalali-datetime';
import {
  registerAuditLogFixtures,
  theAuditRow,
  theRealRecordIdFor,
} from '../../screenplay/audit-logging/audit-log-fixtures';
import {
  AuditLogFilters,
  EnsureAuditEventsShownInOrder,
  EnsureAuditLogWasNotDisplayed,
  EnsureOnlyAuditEventsShown,
  ViewAuditLog,
} from '../../screenplay/audit-logging/view-audit-log';
import {
  EnsureAuditEventChangesAreExactly,
  fieldKeyFor,
  registerMultiFieldEditFixture,
  ViewTargetAuditEventDetails,
} from '../../screenplay/audit-logging/audit-log-details';

const NOT_SET = '-';

Given('اینکه رویدادهای زیر در سیستم ثبت شده باشند:', (table: DataTable) =>
  registerAuditLogFixtures(table),
);

When(
  '{actor} لیست رویدادهای سیستم را بدون فیلتر مشاهده می کند',
  (actor: Actor) => actor.attemptsTo(ViewAuditLog.viaApiUsing()),
);

Then(
  'رویدادهای ردیف زیر از جدیدترین به قدیمی ترین نمایش داده شود',
  (table: DataTable) => {
    const expected = table.rows().map((row) => theAuditRow(Number(row[0])));
    return actorInTheSpotlight().attemptsTo(
      EnsureAuditEventsShownInOrder(expected),
    );
  },
);

const parseDateTimeFilter = (text: string): string =>
  parseJalaliDateTime(text).toISOString();

/** Builds the filter set for both filtering steps below — a value of "-" means "not set". */
const filtersFrom = (fields: {
  actorName?: string;
  recordId?: string;
  from?: string;
  to?: string;
}): AuditLogFilters => {
  const filters: AuditLogFilters = {};
  if (fields.actorName !== undefined && fields.actorName !== NOT_SET) {
    filters.actorName = realNameFor(fields.actorName);
  }
  if (fields.recordId !== undefined && fields.recordId !== NOT_SET) {
    filters.recordId = theRealRecordIdFor(fields.recordId);
  }
  if (fields.from !== undefined && fields.from !== NOT_SET) {
    filters.from = parseDateTimeFilter(fields.from);
  }
  if (fields.to !== undefined && fields.to !== NOT_SET) {
    filters.to = parseDateTimeFilter(fields.to);
  }
  return filters;
};

When(
  '{actor} لیست رویدادهای سیستم را با فیلترهای زیر مشاهده می کند',
  (actor: Actor, table: DataTable) => {
    const hash = table.rowsHash();
    const filters = filtersFrom({
      actorName: hash['کاربر'],
      recordId: hash['شناسه رکورد'],
      from: hash['از تاریخ و زمان'],
      to: hash['تا تاریخ و زمان'],
    });
    return actor.attemptsTo(ViewAuditLog.viaApiUsing(filters));
  },
);

Then('فقط رویدادهای ردیف {string} نمایش داده شود', (csv: string) => {
  const expected = csv
    .split(',')
    .map((value) => theAuditRow(Number(value.trim())));
  return actorInTheSpotlight().attemptsTo(EnsureOnlyAuditEventsShown(expected));
});

When(
  '{actor} لیست رویدادهای سیستم را با فیلتر کاربر {string} مشاهده می کند',
  (actor: Actor, actorNameFilter: string) =>
    actor.attemptsTo(
      ViewAuditLog.viaApiUsing({ actorName: realNameFor(actorNameFilter) }),
    ),
);

When('{actor} تلاش می کند لیست رویدادهای سیستم را مشاهده کند', (actor: Actor) =>
  actor.attemptsTo(ViewAuditLog.viaApiUsing()),
);

Then('رویدادهای سیستم نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAuditLogWasNotDisplayed()),
);

Given(
  'اینکه رویداد ویرایش زیر با جزئیات تغییرات آن در سیستم ثبت شده باشد:',
  (table: DataTable) => registerMultiFieldEditFixture(table),
);

When('{actor} جزئیات آن رویداد را مشاهده می کند', (actor: Actor) =>
  actor.attemptsTo(ViewTargetAuditEventDetails()),
);

Then(
  'جزئیات تغییرات آن رویداد به صورت زیر نمایش داده شود',
  (table: DataTable) => {
    const expected = table.hashes().map((row) => ({
      field: fieldKeyFor(row['فیلد']),
      previousValue: row['مقدار قبلی'],
      newValue: row['مقدار جدید'],
    }));
    return actorInTheSpotlight().attemptsTo(
      EnsureAuditEventChangesAreExactly(expected),
    );
  },
);

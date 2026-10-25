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
  auditActionFor,
  EnsureAuditEventsShownInOrder,
  EnsureAuditLogWasNotDisplayed,
  EnsureLatestAuditEventsAre,
  EnsureNoAuditEventOfAction,
  EnsureOnlyAuditEventsShown,
  ViewAuditLog,
} from '../../screenplay/audit-logging/view-audit-log';
import {
  AuditChangeRow,
  auditValueFor,
  EnsureAuditEventChangesAreExactly,
  EnsureAuditEventSubjectIs,
  EnsureChangesOfAuditEvent,
  EnsureSubjectOfAuditEvent,
  fieldKeyFor,
  registerMultiFieldEditFixture,
  ViewTargetAuditEventDetails,
} from '../../screenplay/audit-logging/audit-log-details';
import {
  approveWithTrackingNumberForTheAuditLog,
  changeTrackingNumberForTheAuditLog,
  confirmPendingDailyBomForTheAuditLog,
  registerPendingDailyBomWithWeightForTheAuditLog,
  rejectWithTrackingNumberForTheAuditLog,
  theAuditEventOfTheApproval,
  theAuditEventOfTheEdit,
  theReturnToPendingCausedByTheEdit,
} from '../../screenplay/audit-logging/approval-audit-fixtures';

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

/** A «فیلد | مقدار قبلی | مقدار جدید» table, as the audit log carries it. */
const changesFrom = (table: DataTable): AuditChangeRow[] =>
  table.hashes().map((row) => {
    const field = fieldKeyFor(row['فیلد']);
    return {
      field,
      previousValue: auditValueFor(field, row['مقدار قبلی']),
      newValue: auditValueFor(field, row['مقدار جدید']),
    };
  });

/** The subject a daily BOM's approval events name it by — its tracking number. */
const trackingNumberSubject = (value: string) => ({
  field: fieldKeyFor('شماره ردیابی'),
  value,
});

Then(
  'جزئیات تغییرات آن رویداد به صورت زیر نمایش داده شود',
  (table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureAuditEventChangesAreExactly(changesFrom(table)),
    ),
);

// قانون: تغییر وضعیت تایید آنالیز روزانه ... در گزارش رویدادها ثبت می شود — each precondition
// performs its change through the API and targets the audit event it caused, so the "جزئیات ...
// را مشاهده می کند" step that follows views exactly that one (`approval-audit-fixtures.ts`). The
// actor performing a precondition is named with `{actorName}`: they act behind the scenes.

Given(
  'اینکه {actorName} آنالیز روزانه با شناسه رکورد {string} و شماره ردیابی {string} را تایید کرده باشد',
  (approverName: string, placeholder: string, trackingNumber: string) =>
    approveWithTrackingNumberForTheAuditLog(
      placeholder,
      trackingNumber,
      approverName,
    ),
);

Given(
  'اینکه آنالیز روزانه با شناسه رکورد {string} و شماره ردیابی {string} توسط {actorName} تایید شده باشد',
  (placeholder: string, trackingNumber: string, approverName: string) =>
    approveWithTrackingNumberForTheAuditLog(
      placeholder,
      trackingNumber,
      approverName,
    ),
);

Given(
  'اینکه {actorName} آنالیز روزانه با شناسه رکورد {string} و شماره ردیابی {string} را با دلیل {string} عدم تایید کرده باشد',
  (
    reviewerName: string,
    placeholder: string,
    trackingNumber: string,
    reason: string,
  ) =>
    rejectWithTrackingNumberForTheAuditLog(
      placeholder,
      trackingNumber,
      reviewerName,
      reason,
    ),
);

Given(
  'اینکه آنالیز روزانه با شناسه رکورد {string} و شماره ردیابی {string} توسط {actorName} با دلیل {string} عدم تایید شده باشد',
  (
    placeholder: string,
    trackingNumber: string,
    reviewerName: string,
    reason: string,
  ) =>
    rejectWithTrackingNumberForTheAuditLog(
      placeholder,
      trackingNumber,
      reviewerName,
      reason,
    ),
);

Then('شماره ردیابی آنالیز مربوط به آن رویداد {string} باشد', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureAuditEventSubjectIs(trackingNumberSubject(value)),
  ),
);

// قانون: ویرایش و سپس تایید توسط مدیریت ... / بازگشت به در انتظار تایید در اثر ویرایش ... — the
// precondition just before the change takes a baseline of the daily BOM's events, so the `Then`s
// can name "رویداد ویرایش", "رویداد تایید" and "رویداد بازگشت به در انتظار تایید" without guessing
// (`approval-audit-fixtures.ts`). The edit-then-approve precondition itself, «مصطفی وزن مواد اولیه
// ... آن را به ... تغییر داده و سپس آن را تایید کرده باشد», is shared with approving-bom.feature and
// defined in step-definitions/common.steps.ts.

Given(
  'اینکه آنالیز روزانه در انتظار تایید با شناسه رکورد {string} که وزن مواد اولیه {string} جز {string} آن {string} است در سیستم ثبت شده باشد',
  (
    placeholder: string,
    materialName: string,
    componentName: string,
    weight: string,
  ) =>
    registerPendingDailyBomWithWeightForTheAuditLog(
      placeholder,
      componentName,
      materialName,
      Number(weight),
    ),
);

Given(
  'اینکه آنالیز روزانه در انتظار تایید با شناسه رکورد {string} و شماره ردیابی {string} در سیستم ثبت شده باشد',
  (placeholder: string, trackingNumber: string) =>
    confirmPendingDailyBomForTheAuditLog(placeholder, trackingNumber),
);

Given(
  '{actorName} شماره ردیابی آن را به {string} تغییر داده باشد',
  (editorName: string, trackingNumber: string) =>
    changeTrackingNumberForTheAuditLog(editorName, trackingNumber),
);

When(
  '{actor} لیست رویدادهای سیستم را با فیلتر شناسه رکورد {string} مشاهده می کند',
  (actor: Actor, placeholder: string) =>
    actor.attemptsTo(
      ViewAuditLog.viaApiUsing({ recordId: theRealRecordIdFor(placeholder) }),
    ),
);

Then(
  'آخرین رویدادهای آن آنالیز روزانه از جدیدترین به قدیمی ترین به صورت زیر باشد',
  (table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureLatestAuditEventsAre(
        table.hashes().map((row) => ({
          actorName: realNameFor(row['کاربر']),
          action: auditActionFor(row['نوع رویداد']),
        })),
      ),
    ),
);

Then(
  'آخرین رویداد آن آنالیز روزانه، رویداد ویرایش توسط {actorName} باشد',
  (editorName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureLatestAuditEventsAre([
        { actorName: realNameFor(editorName), action: 'Edited' },
      ]),
    ),
);

Then(
  'هیچ رویداد بازگشت به در انتظار تایید برای آن آنالیز روزانه ثبت نشده باشد',
  () =>
    actorInTheSpotlight().attemptsTo(
      EnsureNoAuditEventOfAction('ReturnedToPending'),
    ),
);

Then('جزئیات تغییرات رویداد ویرایش به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureChangesOfAuditEvent(theAuditEventOfTheEdit()).areExactly(
      changesFrom(table),
    ),
  ),
);

Then('جزئیات تغییرات رویداد تایید به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureChangesOfAuditEvent(theAuditEventOfTheApproval()).areExactly(
      changesFrom(table),
    ),
  ),
);

Then(
  'جزئیات تغییرات رویداد بازگشت به در انتظار تایید به صورت زیر باشد',
  (table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureChangesOfAuditEvent(theReturnToPendingCausedByTheEdit()).areExactly(
        changesFrom(table),
      ),
    ),
);

Then(
  'شماره ردیابی آنالیز مربوط به رویداد بازگشت به در انتظار تایید {string} باشد',
  (value: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureSubjectOfAuditEvent(theReturnToPendingCausedByTheEdit()).is(
        trackingNumberSubject(value),
      ),
    ),
);

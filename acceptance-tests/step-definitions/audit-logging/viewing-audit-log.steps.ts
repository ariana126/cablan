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
import {
  correctAndApproveDailyBomAsAPrecondition,
  thatDailyBom,
} from '../../screenplay/bom-analyzing/daily-bom-approval';
import { statementsAboutMaterialsAre } from '../../screenplay/common/material-statement-context';
import { uploadAsAPrecondition } from '../../screenplay/bom-registration/material-import';
import {
  changeMaterialCodeAsAPrecondition,
  ensureAMaterialIsNamed,
  ensureNameOfMaterialWithCodeIs,
  ensureNoMaterialIsNamed,
  ensureTheMaterialsAreAsBeforeTheFirstImport,
  registerMaterialsAsAPrecondition,
  useMaterialInAProductAsAPrecondition,
} from '../../screenplay/bom-registration/registered-materials';
import {
  attemptToRevert,
  confirmWithoutRegistrationForTheAuditLog,
  EnsureOnlyTheLatestImportCanBeReverted,
  EnsureTheChangesOfTheLatestAuditEventAre,
  EnsureTheImportCouldNotBeReverted,
  EnsureTheLatestAuditEventIs,
  ensureTheReversionWasLoggedBy,
  importChangeLineFor,
  importForTheAuditLog,
  importOrdinalFor,
  importTwiceForTheAuditLog,
  revertAsAPrecondition,
  RevertMaterialImport,
  theImport,
} from '../../screenplay/audit-logging/material-import-audit';

const NOT_SET = '-';

// Also tells the shared «مواد اولیه «…» با کد «…» در سیستم ثبت شده باشد» that, in this feature, it
// states a precondition (`material-statement-context.ts`).
Given('اینکه رویدادهای زیر در سیستم ثبت شده باشند:', (table: DataTable) => {
  statementsAboutMaterialsAre('precondition');
  return registerAuditLogFixtures(table);
});

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
// (`approval-audit-fixtures.ts`). The «اکنون … ساعت … باشد» before the edit is shared, in
// step-definitions/common.steps.ts.

// A review edit from the dashboard with its reason, then the approval — the approval event's
// management note carries the edit's heading above its change line. The preceding `Given` has
// already taken the baseline and focused the daily BOM.
Given(
  '{actorName} از داشبورد وزن مواد اولیه {string} جز {string} آن را با دلیل {string} به {string} تغییر داده و سپس آن را تایید کرده باشد',
  (
    reviewerName: string,
    materialName: string,
    componentName: string,
    reason: string,
    weight: string,
  ) =>
    correctAndApproveDailyBomAsAPrecondition(
      thatDailyBom(),
      reviewerName,
      [{ componentName, materialName, weight: Number(weight) }],
      reason,
    ),
);

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

// قانون: بارگذاری مواد اولیه از اکسل به صورت یک رویداد بارگذاری گروهی … ثبت می شود — and the
// reversion rules after it. Doors: the active «یاشار … را برمی گرداند» drives the import's entry in
// `/audit-log` (details dialog, «برگرداندن»); every precondition and «تلاش …» attempt goes through
// the API; the `Then`s read the audit log and the materials over the API
// (`material-import-audit.ts`, `registered-materials.ts`). Shared, in step-definitions/common.steps.ts:
// «هیچ تغییری در مواد اولیه سیستم اعمال نشده باشد», «کد مواد اولیه «…» «…» باشد» and «مواد اولیه
// «…» با کد «…» در سیستم ثبت شده باشد».

Given(
  'اینکه مواد اولیه {string} با کد {string} و {string} با کد {string} در سیستم ثبت شده باشند',
  (nameA: string, codeA: string, nameB: string, codeB: string) =>
    registerMaterialsAsAPrecondition([
      { name: nameA, code: codeA },
      { name: nameB, code: codeB },
    ]),
);

Given(
  'اینکه مواد اولیه {string} با کد {string} در سیستم ثبت شده باشد',
  (name: string, code: string) =>
    registerMaterialsAsAPrecondition([{ name, code }]),
);

// Regular expressions, not `{string}`s: the change list is a run of quoted clauses.
Given(
  /^([^\s"]+) اکسلی بارگذاری کرده باشد که لیست تغییرات آن (.*) است$/,
  (importerName: string, description: string) =>
    uploadAsAPrecondition(importerName, description),
);

Given(
  '{actorName} ثبت {string} را از لیست تغییرات حذف و آن را تایید کرده باشد',
  (importerName: string, name: string) =>
    confirmWithoutRegistrationForTheAuditLog(importerName, name),
);

Then(
  'آخرین رویداد، رویداد {string} توسط {actorName} باشد',
  (label: string, actorName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheLatestAuditEventIs(label, actorName),
    ),
);

Then('جزئیات تغییرات آن رویداد به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureTheChangesOfTheLatestAuditEventAre(
      table.hashes().map((row) => importChangeLineFor(row['تغییرات'])),
    ),
  ),
);

Given(
  /^(?:اینکه )?([^\s"]+) اکسلی را بارگذاری و تایید کرده باشد که (.*) را اعمال کرده است$/,
  (importerName: string, description: string) =>
    importForTheAuditLog(importerName, description),
);

When('{actor} آن بارگذاری گروهی را برمی گرداند', (actor: Actor) =>
  actor.attemptsTo(RevertMaterialImport.using(theImport('last'))),
);

When(
  '{actor} بارگذاری گروهی {word} را برمی گرداند',
  (actor: Actor, ordinal: string) =>
    actor.attemptsTo(
      RevertMaterialImport.using(theImport(importOrdinalFor(ordinal))),
    ),
);

Then('مواد اولیه {string} در سیستم ثبت نشده باشد', (name: string) =>
  ensureNoMaterialIsNamed(name),
);

Then(
  'نام مواد اولیه با کد {string} {string} باشد',
  (code: string, name: string) => ensureNameOfMaterialWithCodeIs(code, name),
);

Then(
  'رویداد برگرداندن آن بارگذاری گروهی توسط {actorName} ثبت شده باشد',
  (reverterName: string) => ensureTheReversionWasLoggedBy(reverterName),
);

Given(
  'اینکه {actorName} دو اکسل را پشت سر هم بارگذاری و تایید کرده باشد',
  (importerName: string) => importTwiceForTheAuditLog(importerName),
);

When(
  '{actor} تلاش می کند بارگذاری گروهی {word} را برگرداند',
  (actor: Actor, ordinal: string) =>
    attemptToRevert(actor, importOrdinalFor(ordinal)),
);

When('{actor} تلاش می کند آن بارگذاری گروهی را برگرداند', (actor: Actor) =>
  attemptToRevert(actor, 'last'),
);

Then('پیغام خطای برگرداندن فقط آخرین بارگذاری گروهی نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureOnlyTheLatestImportCanBeReverted()),
);

Then('پیغام خطای برگرداندن بارگذاری گروهی نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureTheImportCouldNotBeReverted()),
);

Given(
  '{actorName} بارگذاری گروهی {word} را برگردانده باشد',
  (reverterName: string, ordinal: string) =>
    revertAsAPrecondition(reverterName, importOrdinalFor(ordinal)),
);

Then('مواد اولیه سیستم به حالت پیش از بارگذاری گروهی اول برگشته باشند', () =>
  ensureTheMaterialsAreAsBeforeTheFirstImport(),
);

Given('مواد اولیه {string} در یک محصول استفاده شده باشد', (name: string) =>
  useMaterialInAProductAsAPrecondition(name),
);

Given(
  '{actorName} کد مواد اولیه {string} را به {string} تغییر داده باشد',
  (editorName: string, name: string, code: string) =>
    changeMaterialCodeAsAPrecondition(editorName, name, code),
);

Then('مواد اولیه {string} همچنان در سیستم ثبت شده باشد', (name: string) =>
  ensureAMaterialIsNamed(name),
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

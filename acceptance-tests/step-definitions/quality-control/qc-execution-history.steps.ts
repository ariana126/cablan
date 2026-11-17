import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';
import { lookedAtTheQcRecordsWith } from '../../screenplay/common/qc-history-view-context';
import {
  asPersona,
  asTheSystemAdmin,
  everyRegisteredEquipment,
} from '../../screenplay/maintenance-management/maintenance-records';
import { DefineQcActivityUnlessDefined } from '../../screenplay/quality-control/qc-activity';
import {
  QcExecutionFilters,
  qcInstantFrom,
} from '../../screenplay/quality-control/qc-api';
import {
  AssignQcActivity,
  UnassignQcActivity,
} from '../../screenplay/quality-control/qc-assignment';
import {
  Column,
  recordedAsAPrecondition,
  THE_QC_INSPECTOR,
} from '../../screenplay/quality-control/qc-execution';
import {
  DeleteQcRecord,
  EnsureTheIntervalOfTheQcRecordAt,
  EnsureTheIntervalsOfTheQcRecordsAre,
  EnsureTheQcRecordCountOf,
  EnsureTheQcRecordCountsAre,
  EnsureTheQcRecordStillExists,
  ViewTheQcRecords,
} from '../../screenplay/quality-control/qc-history';
import { performAsTheActor } from '../../screenplay/quality-control/qc-records';

// qc-execution-history.feature (issue #119). The API throughout (`qc-history.ts` says why). «…
// سوابق فعالیت های QC را (با …) مشاهده می کند» reads the records as the actor and notes the filters
// (`common/qc-history-view-context.ts`); the interval and count facts read the records with those
// filters as the system admin. Records the Gherkin states in the passive voice are made by the QC
// inspector, each at its minute. Shared steps — the background's equipment, «فعالیت QC … همچنان
// به تجهیز … تخصیص داده شده باشد», «آخرین انجام … روی … … باشد», «… تلاش می کند عنوان … را به …
// تغییر دهد», «فعالیت QC … بدون تغییر …», «… در N تجهیز استفاده شده است» — live in
// ./common.steps.ts; «پیغام خطای عدم دسترسی …» in step-definitions/common.steps.ts.

Given(
  'فعالیت های QC {string} و {string} به هر دو تجهیز تخصیص داده شده باشند',
  (first: string, second: string) =>
    asTheSystemAdmin(
      DefineQcActivityUnlessDefined(first),
      DefineQcActivityUnlessDefined(second),
      ...everyRegisteredEquipment().flatMap(({ name }) => [
        AssignQcActivity.unlessAssigned(first, name),
        AssignQcActivity.unlessAssigned(second, name),
      ]),
    ),
);

// ---------------------------------------------------------------------------------------------
// Records stated in the passive voice — made by the QC inspector, in the order written.

const recordedAtMinutes = (
  activityName: string,
  equipmentName: string,
  ...records: Array<{ date: string; time: string; trackingNumber?: string }>
) =>
  recordedAsAPrecondition(
    THE_QC_INSPECTOR,
    activityName,
    equipmentName,
    records.map(({ date, time, trackingNumber }) => ({
      at: { date, time },
      trackingNumber,
    })),
  );

Given(
  'اینکه انجام فعالیت های QC به صورت زیر ثبت شده باشد',
  async (table: DataTable) => {
    for (const row of table.hashes()) {
      const { date, time } = qcInstantFrom(row[Column.recordedAt]);
      await recordedAtMinutes(row[Column.activity], row[Column.equipment], {
        date,
        time,
        trackingNumber: row[Column.trackingNumber],
      });
    }
  },
);

const recordedAt = (
  activityName: string,
  equipmentName: string,
  date: string,
  time: string,
) => recordedAtMinutes(activityName, equipmentName, { date, time });

Given(
  'اینکه انجام {string} روی {string} در {string} ساعت {string} ثبت شده باشد',
  recordedAt,
);
Given(
  'انجام {string} روی {string} در {string} ساعت {string} ثبت شده باشد',
  recordedAt,
);

const recordedAtWithTrackingNumber = (
  activityName: string,
  equipmentName: string,
  date: string,
  time: string,
  trackingNumber: string,
) =>
  recordedAtMinutes(activityName, equipmentName, {
    date,
    time,
    trackingNumber,
  });

Given(
  'اینکه انجام {string} روی {string} در {string} ساعت {string} با شماره ردیابی {string} ثبت شده باشد',
  recordedAtWithTrackingNumber,
);
Given(
  'انجام {string} روی {string} در {string} ساعت {string} با شماره ردیابی {string} ثبت شده باشد',
  recordedAtWithTrackingNumber,
);

Given(
  'اینکه انجام {string} روی {string} در {string} ساعت {string} و {string} ساعت {string} ثبت شده باشد',
  (
    activityName: string,
    equipmentName: string,
    firstDate: string,
    firstTime: string,
    secondDate: string,
    secondTime: string,
  ) =>
    recordedAtMinutes(
      activityName,
      equipmentName,
      { date: firstDate, time: firstTime },
      { date: secondDate, time: secondTime },
    ),
);

Given(
  'اینکه انجام {string} روی {string} در {string} ساعت های {string}، {string} و {string} ثبت شده باشد',
  (
    activityName: string,
    equipmentName: string,
    date: string,
    first: string,
    second: string,
    third: string,
  ) =>
    recordedAtMinutes(
      activityName,
      equipmentName,
      ...[first, second, third].map((time) => ({ date, time })),
    ),
);

Given(
  'اینکه انجام {string} روی {string} در {string} ساعت {string} ثبت شده و سپس توسط {actorName} حذف شده باشد',
  async (
    activityName: string,
    equipmentName: string,
    date: string,
    time: string,
    personaName: string,
  ) => {
    await recordedAtMinutes(activityName, equipmentName, { date, time });
    await asPersona(
      personaName,
      DeleteQcRecord.asAPrecondition(activityName, equipmentName, {
        date,
        time,
      }),
    );
  },
);

Given(
  'تخصیص فعالیت QC {string} از تجهیز {string} برداشته و سپس دوباره داده شده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      UnassignQcActivity.asAPrecondition(activityName, equipmentName),
      AssignQcActivity.unlessAssigned(activityName, equipmentName),
    ),
);

// ---------------------------------------------------------------------------------------------
// Looking at the records — each step notes the filters it looked with.

const looksAtTheRecords = (actor: Actor, filters: QcExecutionFilters) => {
  lookedAtTheQcRecordsWith(filters);
  return performAsTheActor(actor, ViewTheQcRecords.viaApiUsing(filters));
};

When('{actor} سوابق فعالیت های QC را مشاهده می کند', (actor: Actor) =>
  looksAtTheRecords(actor, {}),
);

When(
  '{actor} سوابق فعالیت های QC را با بازه {string} تا {string} مشاهده می کند',
  (actor: Actor, from: string, to: string) =>
    looksAtTheRecords(actor, {
      from: qcInstantFrom(from),
      to: qcInstantFrom(to),
    }),
);

When(
  '{actor} سوابق فعالیت های QC را با شماره ردیابی {string} مشاهده می کند',
  (actor: Actor, trackingNumber: string) =>
    looksAtTheRecords(actor, { trackingNumber }),
);

When(
  '{actor} سوابق فعالیت های QC را با بازه {string} تا {string} و شماره ردیابی {string} مشاهده می کند',
  (actor: Actor, from: string, to: string, trackingNumber: string) =>
    looksAtTheRecords(actor, {
      from: qcInstantFrom(from),
      to: qcInstantFrom(to),
      trackingNumber,
    }),
);

// قانون: فاصله هر انجام فقط از انجام قبلی همان فعالیت روی همان تجهیز حساب می شود

Then('فاصله سوابق به صورت زیر باشد', (table: DataTable) =>
  asTheSystemAdmin(EnsureTheIntervalsOfTheQcRecordsAre(table.hashes())),
);

Then(
  'فاصله انجام {string} از انجام قبلی {string} باشد',
  (at: string, label: string) =>
    asTheSystemAdmin(
      EnsureTheIntervalOfTheQcRecordAt(qcInstantFrom(at), label),
    ),
);

// قانون: تعداد انجام هر فعالیت روی هر تجهیز با همه فیلترهای اعمال شده حساب می شود

Then('تعداد انجام فعالیت ها به صورت زیر باشد', (table: DataTable) =>
  asTheSystemAdmin(EnsureTheQcRecordCountsAre(table.hashes())),
);

// قانون: فقط مدیریت و مدیر سیستم سوابق فعالیت های QC را بررسی می کنند

When('{actor} تلاش می کند سوابق فعالیت های QC را مشاهده کند', (actor: Actor) =>
  performAsTheActor(actor, ViewTheQcRecords.attemptedViaApi()),
);

// قانون: فقط مدیر سیستم سابقه انجام را حذف می کند و حذف آن چیز دیگری را پاک نمی کند

When(
  '{actor} سابقه انجام {string} روی {string} در {string} ساعت {string} را حذف می کند',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    date: string,
    time: string,
  ) =>
    performAsTheActor(
      actor,
      DeleteQcRecord.viaApiUsing(activityName, equipmentName, { date, time }),
    ),
);

When(
  '{actor} تلاش می کند سابقه انجام {string} روی {string} در {string} ساعت {string} را حذف کند',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    date: string,
    time: string,
  ) =>
    performAsTheActor(
      actor,
      DeleteQcRecord.viaApiUsing(activityName, equipmentName, { date, time }),
    ),
);

Then(
  'تعداد انجام {string} روی {string} {string} باشد',
  (activityName: string, equipmentName: string, count: string) =>
    asTheSystemAdmin(
      EnsureTheQcRecordCountOf(activityName, equipmentName, Number(count)),
    ),
);

Then(
  'سابقه انجام {string} روی {string} در {string} ساعت {string} همچنان ثبت شده باشد',
  (activityName: string, equipmentName: string, date: string, time: string) =>
    asTheSystemAdmin(
      EnsureTheQcRecordStillExists(activityName, equipmentName, { date, time }),
    ),
);

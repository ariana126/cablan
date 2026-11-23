import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { trackingNumberTypedFor } from '../../screenplay/common/tracking-number-error-context';
import { CorrectEquipmentName } from '../../screenplay/maintenance-management/equipment';
import {
  asPersona,
  asTheSystemAdmin,
  theEquipmentNamed,
} from '../../screenplay/maintenance-management/maintenance-records';
import {
  EnsureToldTheActivityIsNotAssigned,
  UnassignQcActivity,
} from '../../screenplay/quality-control/qc-assignment';
import {
  EnsureAQcRecordOf,
  EnsureNoDailyBomHasTheTrackingNumber,
  EnsureTheNotesOfTheLatestQcRecord,
  EnsureTheNumberOfQcRecordsOf,
  recordedAsAPrecondition,
  recordedBy,
  RecordQcExecution,
  withTrackingNumber,
} from '../../screenplay/quality-control/qc-execution';
import {
  DownloadTheQrAgain,
  EnsureShownTheQcActivitiesOf,
  EnsureTheLastQcExecutionsShownFor,
  PrintTheQrOf,
  ScanTheQr,
  ViewTheQcActivitiesOf,
} from '../../screenplay/quality-control/qc-inspection';
import {
  performAsTheActor,
  thePrintedQr,
} from '../../screenplay/quality-control/qc-records';
import {
  chosenActivitiesFrom,
  EnsureToldAnActivityMustBeChosen,
  EnsureToldTheOutcomeOfEachActivity,
  partlySubmittedTogetherAsAPrecondition,
  RecordQcExecutionsTogether,
  ResendTheQcSubmission,
  submittedTogetherAsAPrecondition,
} from '../../screenplay/quality-control/qc-submission';

// recording-qc-execution.feature (issue #119). Recording goes through the API — the product's way
// in is a camera scan the suite cannot hold (`qc-execution.ts`); so does scanning a printed QR,
// which is reading the inspection view of the equipment its payload names (`qc-inspection.ts`).
// The one browser step is the inspector looking at `/qc-inspection` («… فعالیت های QC تجهیز … را
// مشاهده می کند»), read by the «آخرین انجام … به صورت زیر باشد» after it. Facts are read by the
// system admin. Shared steps — the background, «… ثبت کرده باشد», «تخصیص … برداشته شده باشد»,
// «سوابق انجام QC تجهیز … به صورت زیر باشد», «آخرین انجام … روی … … باشد», «به او گفته شود که …
// کنار گذاشته شده است» — live in ./common.steps.ts; «اکنون … ساعت … باشد» and «پیغام خطای عدم
// دسترسی …» in step-definitions/common.steps.ts; «تجهیز … کنار گذاشته شده باشد» in
// ../maintenance-management/technical-management-dashboard.steps.ts.

const records = (
  actor: Actor,
  activityName: string,
  equipmentName: string,
  trackingNumber: string,
  notes?: string,
) =>
  performAsTheActor(
    actor,
    RecordQcExecution.viaApiUsing(activityName, equipmentName, {
      trackingNumber,
      notes,
    }),
  );

When(
  '{actor} انجام {string} روی {string} را با شماره ردیابی {string} ثبت می کند',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    trackingNumber: string,
  ) => records(actor, activityName, equipmentName, trackingNumber),
);

When(
  '{actor} انجام {string} روی {string} را با شماره ردیابی {string} و توضیحات {string} ثبت می کند',
  records,
);

Then(
  'هیچ انجامی برای {string} روی {string} ثبت نشده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheNumberOfQcRecordsOf(activityName, equipmentName, 0),
    ),
);

Then(
  'توضیحات آخرین سابقه انجام {string} روی {string} {string} باشد',
  (activityName: string, equipmentName: string, notes: string) =>
    asTheSystemAdmin(
      EnsureTheNotesOfTheLatestQcRecord(activityName, equipmentName, notes),
    ),
);

// قانون: فقط بازرس کنترل کیفیت، مدیریت و مدیر سیستم انجام فعالیت QC را ثبت می کنند

Then(
  'سابقه انجام {string} روی {string} با ثبت کننده {actorName} ثبت شده باشد',
  (activityName: string, equipmentName: string, personaName: string) =>
    asTheSystemAdmin(
      EnsureAQcRecordOf(
        activityName,
        equipmentName,
        `by ${personaName}`,
        recordedBy(personaName),
      ),
    ),
);

// The «تلاش …» attempts — refused (403, 400, 409); the response is judged by the step after.
When(
  '{actor} تلاش می کند انجام {string} روی {string} را با شماره ردیابی {string} ثبت کند',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    trackingNumber: string,
  ) => {
    trackingNumberTypedFor('qc-record');
    return records(actor, activityName, equipmentName, trackingNumber);
  },
);

// قانون: شماره ردیابی برای هر ثبت لازم است و می تواند هر متنی باشد

// «پیغام خطای شماره ردیابی نشان داده شود» is registring-bom's sentence too: it lives in
// step-definitions/common.steps.ts, dispatched on `common/tracking-number-error-context.ts`, which
// the «تلاش …» recording above sets.

Given(
  'اینکه هیچ آنالیز روزانه ای با شماره ردیابی {string} ثبت نشده باشد',
  (trackingNumber: string) =>
    asTheSystemAdmin(EnsureNoDailyBomHasTheTrackingNumber(trackingNumber)),
);

Then(
  'سابقه انجام {string} روی {string} با شماره ردیابی {string} ثبت شده باشد',
  (activityName: string, equipmentName: string, trackingNumber: string) =>
    asTheSystemAdmin(
      EnsureAQcRecordOf(
        activityName,
        equipmentName,
        `with tracking number ${trackingNumber}`,
        withTrackingNumber(trackingNumber),
      ),
    ),
);

// قانون: فقط فعالیتی که به یک تجهیز فعال تخصیص داده شده قابل ثبت است
// «<وضعیت>»: «… تخصیص داده نشده باشد» (below), «تخصیص … برداشته شده باشد» (./common.steps.ts),
// «تجهیز … کنار گذاشته شده باشد» (maintenance-management).

Given(
  'فعالیت QC {string} به تجهیز {string} تخصیص داده نشده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      UnassignQcActivity.unlessUnassigned(activityName, equipmentName),
    ),
);

Then(
  'به او گفته شود که {string} به {string} تخصیص داده نشده است',
  (activityName: string, equipmentName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheActivityIsNotAssigned(activityName, equipmentName),
    ),
);

// قانون: ثبت هر فعالیت مستقل است و بین دو انجام محدودیت زمانی نیست

Then(
  '{int} سابقه انجام {string} روی {string} ثبت شده باشد',
  (count: number, activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheNumberOfQcRecordsOf(activityName, equipmentName, count),
    ),
);

// قانون: آخرین انجام هر فعالیت تجهیز برای زمان بندی بازرسی دیده می شود

Given(
  'اینکه {actorName} انجام {string} روی {string} را در {string} ساعت {string} و {string} ساعت {string} ثبت کرده باشد',
  (
    personaName: string,
    activityName: string,
    equipmentName: string,
    firstDate: string,
    firstTime: string,
    secondDate: string,
    secondTime: string,
  ) =>
    recordedAsAPrecondition(personaName, activityName, equipmentName, [
      { at: { date: firstDate, time: firstTime } },
      { at: { date: secondDate, time: secondTime } },
    ]),
);

When(
  '{actor} فعالیت های QC تجهیز {string} را مشاهده می کند',
  (actor: Actor, equipmentName: string) =>
    performAsTheActor(actor, ViewTheQcActivitiesOf.using(equipmentName)),
);

Then(
  'آخرین انجام فعالیت های QC تجهیز {string} به صورت زیر باشد',
  (equipmentName: string, table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheLastQcExecutionsShownFor(equipmentName, table.hashes()),
    ),
);

// قانون: QR چاپ شده یک تجهیز با اصلاح نام یا دریافت دوباره QR بی اعتبار نمی شود

Given('اینکه QR تجهیز {string} چاپ شده باشد', (equipmentName: string) =>
  asTheSystemAdmin(PrintTheQrOf(equipmentName)),
);

Given(
  '{actorName} نام تجهیز {string} را به {string} اصلاح کرده و QR آن را دوباره دریافت کرده باشد',
  (personaName: string, equipmentName: string, newName: string) =>
    asPersona(
      personaName,
      CorrectEquipmentName.asAPrecondition(
        theEquipmentNamed(equipmentName),
        newName,
      ),
      DownloadTheQrAgain(newName),
    ),
);

When('{actor} QR چاپ شده قبلی را اسکن می کند', (actor: Actor) =>
  performAsTheActor(actor, ScanTheQr.viaApiUsing(thePrintedQr())),
);

Then(
  'فعالیت های QC تجهیز {string} به او نشان داده شود',
  (equipmentName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureShownTheQcActivitiesOf(equipmentName),
    ),
);

// ---------------------------------------------------------------------------------------------
// Several activities in one submission, one tracking number (issue #132) — `qc-submission.ts`.
// The plain «… با هم ثبت می کند» is the inspector ticking the activities on `/qc-inspection`; every
// «تلاش …» and both resends go through `POST qc-equipment/:id/executions`, as do the preconditions.
// Reused from above and ./common.steps.ts: «هیچ انجامی …», «سوابق انجام QC تجهیز …», «N سابقه انجام
// …», «سابقه انجام … با شماره ردیابی …», «تخصیص … برداشته شده باشد», «اینکه فعالیت QC … به تجهیز …
// تخصیص داده شده باشد»; «اکنون … ساعت … باشد» and «پیغام خطای شماره ردیابی …» from
// ../common.steps.ts.

// قانون: فعالیت هایی که در یک نوبت انجام شده اند با یک شماره ردیابی ثبت می شوند و هر کدام سابقه
// جدای خود را می گیرند

When(
  '{actor} انجام فعالیت های زیر روی {string} را با شماره ردیابی {string} با هم ثبت می کند',
  (
    actor: Actor,
    equipmentName: string,
    trackingNumber: string,
    table: DataTable,
  ) =>
    performAsTheActor(
      actor,
      RecordQcExecutionsTogether.using(
        equipmentName,
        trackingNumber,
        chosenActivitiesFrom(table.hashes()),
      ),
    ),
);

When(
  '{actor} انجام {string} و {string} روی {string} را با شماره ردیابی {string} با هم ثبت می کند',
  (
    actor: Actor,
    first: string,
    second: string,
    equipmentName: string,
    trackingNumber: string,
  ) =>
    performAsTheActor(
      actor,
      RecordQcExecutionsTogether.using(equipmentName, trackingNumber, [
        { activityName: first },
        { activityName: second },
      ]),
    ),
);

// قانون: ثبت گروهی بدون شماره ردیابی یا بدون هیچ فعالیتی پذیرفته نمی شود

When(
  '{actor} تلاش می کند انجام {string} و {string} روی {string} را بدون شماره ردیابی با هم ثبت کند',
  (actor: Actor, first: string, second: string, equipmentName: string) => {
    trackingNumberTypedFor('qc-submission');
    return performAsTheActor(
      actor,
      RecordQcExecutionsTogether.viaApiUsing(equipmentName, undefined, [
        { activityName: first },
        { activityName: second },
      ]),
    );
  },
);

When(
  '{actor} تلاش می کند بدون انتخاب هیچ فعالیتی انجام فعالیت های {string} را با شماره ردیابی {string} ثبت کند',
  (actor: Actor, equipmentName: string, trackingNumber: string) =>
    performAsTheActor(
      actor,
      RecordQcExecutionsTogether.viaApiUsing(equipmentName, trackingNumber, []),
    ),
);

Then('به او گفته شود که دست کم یک فعالیت باید انتخاب شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldAnActivityMustBeChosen()),
);

// قانون: در ثبت گروهی هر فعالیت جداگانه پذیرفته یا رد می شود و نتیجه هر کدام به بازرس گفته می شود

When(
  '{actor} تلاش می کند انجام {string} و {string} روی {string} را با شماره ردیابی {string} با هم ثبت کند',
  (
    actor: Actor,
    first: string,
    second: string,
    equipmentName: string,
    trackingNumber: string,
  ) =>
    performAsTheActor(
      actor,
      RecordQcExecutionsTogether.viaApiUsing(equipmentName, trackingNumber, [
        { activityName: first },
        { activityName: second },
      ]),
    ),
);

Then(
  'به او گفته شود که {string} ثبت شد و {string} ثبت نشد چون {string} به {string} تخصیص داده نشده است',
  (
    recorded: string,
    refused: string,
    _refusedAgain: string,
    equipmentName: string,
  ) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheOutcomeOfEachActivity(recorded, refused, equipmentName),
    ),
);

// قانون: فرستادن دوباره همان ثبت سابقه تکراری نمی سازد اما ثبت تازه بعدی سابقه جدیدی دارد

Given(
  '{actorName} انجام {string} و {string} روی {string} را با شماره ردیابی {string} با هم ثبت کرده باشد اما نتیجه آن به او نرسیده باشد',
  (
    personaName: string,
    first: string,
    second: string,
    equipmentName: string,
    trackingNumber: string,
  ) =>
    submittedTogetherAsAPrecondition(
      personaName,
      equipmentName,
      trackingNumber,
      [first, second],
    ),
);

Given(
  '{actorName} انجام {string} و {string} روی {string} را با شماره ردیابی {string} با هم ثبت کرده باشد و فقط {string} ثبت شده باشد',
  (
    personaName: string,
    first: string,
    second: string,
    equipmentName: string,
    trackingNumber: string,
    onlyRecorded: string,
  ) =>
    partlySubmittedTogetherAsAPrecondition(
      personaName,
      equipmentName,
      trackingNumber,
      [first, second],
      onlyRecorded,
    ),
);

When('{actor} همان ثبت را دوباره می فرستد', (actor: Actor) =>
  performAsTheActor(actor, ResendTheQcSubmission.viaApi()),
);

Given(
  'اینکه {actorName} انجام {string} و {string} روی {string} را در {string} ساعت {string} با شماره ردیابی {string} با هم ثبت کرده باشد',
  (
    personaName: string,
    first: string,
    second: string,
    equipmentName: string,
    date: string,
    time: string,
    trackingNumber: string,
  ) =>
    submittedTogetherAsAPrecondition(
      personaName,
      equipmentName,
      trackingNumber,
      [first, second],
      { at: { date, time } },
    ),
);

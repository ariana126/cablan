import {
  Before,
  BeforeStep,
  DataTable,
  Given,
  Then,
  When,
} from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { EnsureToldTheRecordHasDependents } from '../../screenplay/common/record-dependents';
import { lookedAtTheQcRecordsWith } from '../../screenplay/common/qc-history-view-context';
import { RegisterEquipmentUnlessRegistered } from '../../screenplay/maintenance-management/equipment';
import { asTheSystemAdmin } from '../../screenplay/maintenance-management/maintenance-records';
import { qcInstantFrom } from '../../screenplay/quality-control/qc-api';
import {
  DefineQcActivityUnlessDefined,
  EnsureTheQcActivityIsUnchanged,
  forgetTheNotedQcActivities,
  NoteTheQcActivitiesBeforeTheAttempt,
  RenameQcActivity,
} from '../../screenplay/quality-control/qc-activity';
import {
  AssignQcActivity,
  EnsureTheQcActivityIsAssignedTimes,
  EnsureToldTheEquipmentIsRetired,
  forgetTheNotedQcAssignments,
  UnassignQcActivity,
} from '../../screenplay/quality-control/qc-assignment';
import {
  EnsureTheQcRecordIsAmongTheRecordsOf,
  EnsureTheQcRecordsOfEquipmentAre,
  recordedAsAPrecondition,
  THE_QC_INSPECTOR,
} from '../../screenplay/quality-control/qc-execution';
import { EnsureTheLastQcExecutionOf } from '../../screenplay/quality-control/qc-inspection';
import {
  forgetQcRecords,
  performAsTheActor,
} from '../../screenplay/quality-control/qc-records';

// Steps more than one quality-control feature states (issue #119) — and registring-equipment's two
// QC rules, which state the same preconditions. Each feature's own steps live in its own file.
//
// Doors: the API for every precondition and fact, as the system admin (`asTheSystemAdmin`, which
// keeps the spotlight and leaves the actor's last response for a following «به او گفته شود …»);
// the API for the active steps here too — see each screenplay module's own comment for why.
// Preconditions are idempotent where a background and its scenario may both state them.

Before(() => {
  forgetQcRecords();
  forgetTheNotedQcActivities();
  forgetTheNotedQcAssignments();
  lookedAtTheQcRecordsWith({});
});

// ---------------------------------------------------------------------------------------------
// Equipment and the catalog

// «اینکه تجهیزهای «…» و «…» در سیستم ثبت شده باشند» (the backgrounds of assigning-qc-activity and
// qc-execution-history) is maintenance's own step:
// ../maintenance-management/planning-preventive-maintenance.steps.ts.

Given('اینکه فعالیت QC {string} تعریف شده باشد', (name: string) =>
  asTheSystemAdmin(DefineQcActivityUnlessDefined(name)),
);

const areDefined = (first: string, second: string) =>
  asTheSystemAdmin(
    DefineQcActivityUnlessDefined(first),
    DefineQcActivityUnlessDefined(second),
  );

Given('اینکه فعالیت های QC {string} و {string} تعریف شده باشند', areDefined);
Given('فعالیت های QC {string} و {string} تعریف شده باشند', areDefined);

// ---------------------------------------------------------------------------------------------
// Assignments — preconditions register what they name unless a background did: registring-qc-
// activity and registring-equipment state them with nothing before them.

const isAssignedTo = (activityName: string, ...equipmentNames: string[]) =>
  asTheSystemAdmin(
    DefineQcActivityUnlessDefined(activityName),
    ...equipmentNames.flatMap((equipmentName) => [
      RegisterEquipmentUnlessRegistered(equipmentName),
      AssignQcActivity.unlessAssigned(activityName, equipmentName),
    ]),
  );

Given(
  'اینکه فعالیت QC {string} به تجهیز {string} تخصیص داده شده باشد',
  (activityName: string, equipmentName: string) =>
    isAssignedTo(activityName, equipmentName),
);

Given(
  'اینکه فعالیت QC {string} به تجهیزهای {string} و {string} تخصیص داده شده باشد',
  (activityName: string, first: string, second: string) =>
    isAssignedTo(activityName, first, second),
);

// recording-qc-execution's background, and qc-execution-history's «… به هر دو تجهیز …» below.
Given(
  'فعالیت های QC {string} و {string} به تجهیز {string} تخصیص داده شده باشند',
  async (first: string, second: string, equipmentName: string) => {
    await isAssignedTo(first, equipmentName);
    await isAssignedTo(second, equipmentName);
  },
);

// «تخصیص … برداشته شده باشد» — assigning-qc-activity, and recording-qc-execution's «<وضعیت>».
Given(
  'تخصیص فعالیت QC {string} از تجهیز {string} برداشته شده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      UnassignQcActivity.asAPrecondition(activityName, equipmentName),
    ),
);

/**
 * registring-qc-activity's and registring-equipment's «<وابستگی>»: the activity has a record on the
 * equipment but is no longer assigned to it — assigned, recorded by the QC inspector, unassigned.
 */
Given(
  'اینکه فعالیت QC {string} روی تجهیز {string} انجام شده و سپس تخصیص آن برداشته شده باشد',
  async (activityName: string, equipmentName: string) => {
    await isAssignedTo(activityName, equipmentName);
    await recordedAsAPrecondition(
      THE_QC_INSPECTOR,
      activityName,
      equipmentName,
      [{}],
    );
    await asTheSystemAdmin(
      UnassignQcActivity.asAPrecondition(activityName, equipmentName),
    );
  },
);

When(
  '{actor} تخصیص فعالیت QC {string} را از تجهیز {string} برمی دارد',
  (actor: Actor, activityName: string, equipmentName: string) =>
    performAsTheActor(
      actor,
      UnassignQcActivity.viaApiUsing(activityName, equipmentName),
    ),
);

Then(
  'فعالیت QC {string} همچنان به تجهیز {string} تخصیص داده شده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivityIsAssignedTimes(activityName, equipmentName, 1),
    ),
);

/**
 * Whether the step being run states an outcome — its keyword (or, for «و», the keyword it
 * continues) is «انتظار می رود». Cucumber matches text alone, and
 * «فعالیت QC … به تجهیز … تخصیص داده شده باشد» is written both ways.
 */
let theStepStatesAnOutcome = false;
BeforeStep(({ pickleStep }) => {
  theStepStatesAnOutcome = String(pickleStep.type) === 'Outcome';
});

// Two meanings, told apart by the keyword: an outcome after a correction (assigning-qc-activity,
// registring-equipment — «انتظار می رود فعالیت QC …») is checked; a precondition continuing a
// `Given` (recording-qc-execution's scan rule — «و فعالیت QC … به تجهیز "اکسترودر 2" …») is made
// true, like the «اینکه» form above.
Then(
  'فعالیت QC {string} به تجهیز {string} تخصیص داده شده باشد',
  (activityName: string, equipmentName: string) =>
    theStepStatesAnOutcome
      ? asTheSystemAdmin(
          EnsureTheQcActivityIsAssignedTimes(activityName, equipmentName, 1),
        )
      : isAssignedTo(activityName, equipmentName),
);

// An outcome only (registring-qc-activity, after a correction).
Then(
  'فعالیت QC {string} به تجهیزهای {string} و {string} تخصیص داده شده باشد',
  (activityName: string, first: string, second: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivityIsAssignedTimes(activityName, first, 1),
      EnsureTheQcActivityIsAssignedTimes(activityName, second, 1),
    ),
);

// ---------------------------------------------------------------------------------------------
// Records made by a named persona — opening a `Given` («اینکه …») or continuing one («و …»).

const recordedAt = (
  personaName: string,
  activityName: string,
  equipmentName: string,
  date: string,
  time: string,
) =>
  recordedAsAPrecondition(personaName, activityName, equipmentName, [
    { at: { date, time } },
  ]);

Given(
  'اینکه {actorName} انجام {string} روی {string} را در {string} ساعت {string} ثبت کرده باشد',
  recordedAt,
);
Given(
  '{actorName} انجام {string} روی {string} را در {string} ساعت {string} ثبت کرده باشد',
  recordedAt,
);

const recordedAtWithTrackingNumber = (
  personaName: string,
  activityName: string,
  equipmentName: string,
  date: string,
  time: string,
  trackingNumber: string,
) =>
  recordedAsAPrecondition(personaName, activityName, equipmentName, [
    { at: { date, time }, trackingNumber },
  ]);

Given(
  'اینکه {actorName} انجام {string} روی {string} را در {string} ساعت {string} با شماره ردیابی {string} ثبت کرده باشد',
  recordedAtWithTrackingNumber,
);
Given(
  '{actorName} انجام {string} روی {string} را در {string} ساعت {string} با شماره ردیابی {string} ثبت کرده باشد',
  recordedAtWithTrackingNumber,
);

// «… را 3 بار ثبت کرده باشد» — now, a minute apart.
Given(
  '{actorName} انجام {string} روی {string} را {int} بار ثبت کرده باشد',
  (
    personaName: string,
    activityName: string,
    equipmentName: string,
    times: number,
  ) =>
    recordedAsAPrecondition(
      personaName,
      activityName,
      equipmentName,
      Array.from({ length: times }, () => ({})),
    ),
);

// ---------------------------------------------------------------------------------------------
// What the actor is told

// assigning-qc-activity (an assignment) and recording-qc-execution (a record) — both 409
// `equipment-retired`.
Then(
  'به او گفته شود که {string} کنار گذاشته شده است',
  (equipmentName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheEquipmentIsRetired(equipmentName),
    ),
);

// ---------------------------------------------------------------------------------------------
// The equipment's records

Then(
  'سوابق انجام QC تجهیز {string} به صورت زیر باشد',
  (equipmentName: string, table: DataTable) =>
    asTheSystemAdmin(
      EnsureTheQcRecordsOfEquipmentAre(equipmentName, table.hashes()),
    ),
);

const isAmongTheRecordsOf = (
  activityName: string,
  date: string,
  time: string,
  equipmentName: string,
) =>
  asTheSystemAdmin(
    EnsureTheQcRecordIsAmongTheRecordsOf(
      activityName,
      { date, time },
      equipmentName,
    ),
  );

Then(
  'سابقه انجام {string} در {string} ساعت {string} در سوابق انجام QC تجهیز {string} باشد',
  isAmongTheRecordsOf,
);
Then(
  'سابقه انجام {string} در {string} ساعت {string} همچنان در سوابق انجام QC تجهیز {string} باشد',
  isAmongTheRecordsOf,
);

// recording-qc-execution («… "1405/07/01 11:30" باشد») and qc-execution-history.
Then(
  'آخرین انجام {string} روی {string} {string} باشد',
  (activityName: string, equipmentName: string, at: string) =>
    asTheSystemAdmin(
      EnsureTheLastQcExecutionOf(
        activityName,
        equipmentName,
        qcInstantFrom(at),
      ),
    ),
);

// ---------------------------------------------------------------------------------------------
// Renaming an activity in use — registring-qc-activity's «<تغییر>» and qc-execution-history's
// last example. The catalog is noted first, so «… بدون تغییر …» can compare with it.

When(
  '{actor} تلاش می کند عنوان فعالیت QC {string} را به {string} تغییر دهد',
  async (actor: Actor, activityName: string, newName: string) => {
    await asTheSystemAdmin(NoteTheQcActivitiesBeforeTheAttempt());
    triedThrough('api');
    return performAsTheActor(
      actor,
      RenameQcActivity.viaApiUsing(activityName, newName),
    );
  },
);

Then(
  'فعالیت QC {string} بدون تغییر در سیستم باقی مانده باشد',
  (activityName: string) =>
    asTheSystemAdmin(EnsureTheQcActivityIsUnchanged(activityName)),
);

// The 409 `record-has-dependents` of a QC activity: «… در N تجهیز …» (the equipment it is assigned
// to) and «… در N سابقه انجام QC …» (its records).
Then(
  'به او گفته شود که {string} در {int} تجهیز استفاده شده است',
  (_activityName: string, count: number) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordHasDependents.viaApi({
        kind: 'qc-assigned-equipment',
        count,
      }),
    ),
);

Then(
  'به او گفته شود که {string} در {int} سابقه انجام QC استفاده شده است',
  (_activityName: string, count: number) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordHasDependents.viaApi({
        kind: 'qc-activity-execution',
        count,
      }),
    ),
);

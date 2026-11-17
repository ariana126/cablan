import { Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { asTheSystemAdmin } from '../../screenplay/maintenance-management/maintenance-records';
import {
  EnsureNoEquipmentIsNamed,
  ReactivateEquipment,
} from '../../screenplay/maintenance-management/equipment-lifecycle';
import {
  AssignQcActivity,
  EnsureTheQcActivitiesOfEquipmentAre,
  EnsureTheQcActivitiesOfEquipmentAreAsBefore,
  EnsureTheQcActivityIsAssignedTimes,
  EnsureTheQcActivityIsRecordable,
  EnsureToldTheActivityIsAlreadyAssigned,
  NoteTheQcActivitiesOf,
  UnassignQcActivity,
} from '../../screenplay/quality-control/qc-assignment';
import { EnsureNoQcRecordNamesTheEquipment } from '../../screenplay/quality-control/qc-execution';
import { ViewTheQcFolderOf } from '../../screenplay/quality-control/qc-history';
import { performAsTheActor } from '../../screenplay/quality-control/qc-records';

// assigning-qc-activity.feature (issue #119). The API throughout (`qc-assignment.ts` says why),
// except the System Admin's «… تجهیز … را حذف می کند», which is maintenance's own step and drives
// `/equipment` (step-definitions/maintenance-management/planning-preventive-maintenance.steps.ts).
// Facts are read by the system admin. Shared steps — the background, «… تخصیص داده شده باشد»,
// «تخصیص … برداشته شده باشد», «… تخصیص … را از تجهیز … برمی دارد», «… ثبت کرده باشد», «سوابق انجام
// QC تجهیز … به صورت زیر باشد», «سابقه انجام … در سوابق انجام QC تجهیز … باشد», «به او گفته شود که
// … کنار گذاشته شده است» — live in ./common.steps.ts; «تجهیز … کنار گذاشته شده باشد» in
// ../maintenance-management/technical-management-dashboard.steps.ts; «فعالیت QC … همچنان در سیستم
// ثبت شده باشد» in ./registring-qc-activity.steps.ts.

When(
  '{actor} فعالیت QC {string} را به تجهیزهای {string} و {string} تخصیص می دهد',
  (actor: Actor, activityName: string, first: string, second: string) =>
    performAsTheActor(
      actor,
      AssignQcActivity.viaApiUsing(activityName, first),
      AssignQcActivity.viaApiUsing(activityName, second),
    ),
);

When(
  '{actor} فعالیت های QC {string} و {string} را به تجهیز {string} تخصیص می دهد',
  (actor: Actor, first: string, second: string, equipmentName: string) =>
    performAsTheActor(
      actor,
      AssignQcActivity.viaApiUsing(first, equipmentName),
      AssignQcActivity.viaApiUsing(second, equipmentName),
    ),
);

const assigns = (actor: Actor, activityName: string, equipmentName: string) =>
  performAsTheActor(
    actor,
    AssignQcActivity.viaApiUsing(activityName, equipmentName),
  );

When('{actor} فعالیت QC {string} را به تجهیز {string} تخصیص می دهد', assigns);
When(
  '{actor} فعالیت QC {string} را دوباره به تجهیز {string} تخصیص می دهد',
  assigns,
);

Then(
  'فعالیت های QC تجهیز {string} فقط {string} باشد',
  (equipmentName: string, activityName: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivitiesOfEquipmentAre(equipmentName, [activityName]),
    ),
);

Then(
  'فعالیت های QC تجهیز {string} {string} و {string} باشند',
  (equipmentName: string, first: string, second: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivitiesOfEquipmentAre(equipmentName, [first, second]),
    ),
);

// قانون: یک فعالیت QC دو بار به یک تجهیز تخصیص داده نمی شود

Then(
  'فعالیت QC {string} فقط یک بار در فعالیت های QC تجهیز {string} باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivityIsAssignedTimes(activityName, equipmentName, 1),
    ),
);

Then('پیغام خطای تکراری بودن تخصیص نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheActivityIsAlreadyAssigned()),
);

// قانون: فقط مدیریت و مدیر سیستم فعالیت QC را به تجهیز تخصیص می دهند یا تخصیص آن را برمی دارند
// The «<تغییر>» attempts note the equipment's activities first, for «… تغییر نکرده باشد».

Then(
  'فعالیت QC {string} در فعالیت های QC تجهیز {string} نباشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivityIsAssignedTimes(activityName, equipmentName, 0),
    ),
);

When(
  '{actor} تلاش می کند فعالیت QC {string} را به تجهیز {string} تخصیص دهد',
  async (actor: Actor, activityName: string, equipmentName: string) => {
    await asTheSystemAdmin(NoteTheQcActivitiesOf(equipmentName));
    return performAsTheActor(
      actor,
      AssignQcActivity.viaApiUsing(activityName, equipmentName),
    );
  },
);

When(
  '{actor} تلاش می کند تخصیص فعالیت QC {string} را از تجهیز {string} بردارد',
  async (actor: Actor, activityName: string, equipmentName: string) => {
    await asTheSystemAdmin(NoteTheQcActivitiesOf(equipmentName));
    return performAsTheActor(
      actor,
      UnassignQcActivity.viaApiUsing(activityName, equipmentName),
    );
  },
);

Then('فعالیت های QC تجهیز {string} تغییر نکرده باشد', (equipmentName: string) =>
  asTheSystemAdmin(EnsureTheQcActivitiesOfEquipmentAreAsBefore(equipmentName)),
);

// قانون: برداشتن تخصیص فقط ثبت انجام تازه آن فعالیت روی همان تجهیز را متوقف می کند و هیچ سابقه ای را پاک نمی کند
// «قابل ثبت» is what the inspector's scan of the equipment offers (`qc-assignment.ts`).

Then(
  'انجام {string} دیگر روی تجهیز {string} قابل ثبت نباشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivityIsRecordable(activityName, equipmentName, false),
    ),
);

Then(
  'انجام {string} روی تجهیز {string} دوباره قابل ثبت باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheQcActivityIsRecordable(activityName, equipmentName, true),
    ),
);

// قانون: به تجهیز کنار گذاشته شده فعالیت QC تازه تخصیص داده نمی شود ولی سوابق QC آن دیده می شود

When(
  '{actor} پرونده QC تجهیز {string} را مشاهده می کند',
  (actor: Actor, equipmentName: string) =>
    performAsTheActor(actor, ViewTheQcFolderOf.viaApiUsing(equipmentName)),
);

// قانون: مدیر سیستم تجهیز کنار گذاشته شده را همراه تخصیص ها و سوابق QC آن حذف می کند و تجهیز دوباره فعال شده فعالیت های QC قبلی خود را دارد

Then('تجهیز {string} در سیستم نباشد', (equipmentName: string) =>
  asTheSystemAdmin(EnsureNoEquipmentIsNamed(equipmentName)),
);

Then(
  'هیچ سابقه انجام QC برای {string} در سوابق فعالیت های QC نباشد',
  (equipmentName: string) =>
    asTheSystemAdmin(EnsureNoQcRecordNamesTheEquipment(equipmentName)),
);

// The plain reactivation over the API, as this feature's dispatch prefers (maintenance's own
// reactivations, which choose how each PM row resumes, drive `/equipment`); the equipment has no
// PM plan, so there is nothing to choose.
When(
  '{actor} تجهیز {string} را دوباره فعال می کند',
  (actor: Actor, equipmentName: string) =>
    performAsTheActor(actor, ReactivateEquipment.viaApiUsing(equipmentName)),
);

import { Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { asTheSystemAdmin } from '../../screenplay/maintenance-management/maintenance-records';
import {
  aFreshQcActivityName,
  CorrectQcActivityName,
  DefineQcActivity,
  DeleteQcActivity,
  EnsureQcActivityIsAssignedToNoEquipment,
  EnsureQcActivityIsDefined,
  EnsureQcActivityIsNotDefined,
  EnsureQcActivityNameErrorShown,
  EnsureTheQcActivitiesAreAsBefore,
  EnsureToldTheQcActivityNameIsTaken,
  EnterNewQcActivityDetails,
  NoteTheQcActivitiesBeforeTheAttempt,
  RenameQcActivity,
  SubmitTheQcActivityLeavingTheNameEmpty,
} from '../../screenplay/quality-control/qc-activity';
import { EnsureEveryQcRecordOfEquipmentIsOf } from '../../screenplay/quality-control/qc-execution';
import { performAsTheActor } from '../../screenplay/quality-control/qc-records';

// registring-qc-activity.feature (issue #119). Every define, rename, correction and deletion goes
// through the API (`qc-activity.ts` says why); only «اطلاعات فعالیت QC جدید را وارد می کند» + «اما
// عنوان فعالیت را خالی می گذارد» drive `/qc-activities`' define dialog, and «پیغام خطای عنوان …»
// reads it. Each attempt notes the catalog first, so «… ثبت نشده / ویرایش نشده / بدون تغییر …» can
// compare with it. Facts are read by the system admin. Shared steps («… تعریف شده باشد», «… تخصیص
// داده شده باشد», «… تلاش می کند عنوان … را به … تغییر دهد», «… در N تجهیز / سابقه انجام QC
// استفاده شده است») live in ./common.steps.ts; «پیغام خطای عدم دسترسی …» in
// step-definitions/common.steps.ts.

const noteTheCatalog = () =>
  asTheSystemAdmin(NoteTheQcActivitiesBeforeTheAttempt());

When(
  '{actor} فعالیت QC جدیدی با عنوان {string} تعریف می کند',
  async (actor: Actor, name: string) => {
    await noteTheCatalog();
    return performAsTheActor(actor, DefineQcActivity.viaApiUsing(name));
  },
);

Then('فعالیت QC {string} در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(EnsureQcActivityIsDefined(name)),
);

Then('فعالیت QC {string} همچنان در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(EnsureQcActivityIsDefined(name)),
);

Then('فعالیت QC {string} به هیچ تجهیزی تخصیص داده نشده باشد', (name: string) =>
  asTheSystemAdmin(EnsureQcActivityIsAssignedToNoEquipment(name)),
);

// قانون: فقط مدیریت و مدیر سیستم فعالیت های QC را تعریف و ویرایش می کنند

When('{actor} تلاش می کند فعالیت QC جدیدی تعریف کند', async (actor: Actor) => {
  await noteTheCatalog();
  return performAsTheActor(
    actor,
    DefineQcActivity.viaApiUsing(aFreshQcActivityName()),
  );
});

Then('فعالیت QC جدیدی ثبت نشده باشد', () =>
  asTheSystemAdmin(EnsureTheQcActivitiesAreAsBefore()),
);

When(
  '{actor} تلاش می کند عنوان فعالیت QC {string} را تغییر دهد',
  async (actor: Actor, name: string) => {
    await noteTheCatalog();
    return performAsTheActor(
      actor,
      RenameQcActivity.viaApiUsing(name, aFreshQcActivityName()),
    );
  },
);

Then('فعالیت QC ویرایش نشده باشد', () =>
  asTheSystemAdmin(EnsureTheQcActivitiesAreAsBefore()),
);

// قانون: عنوان فعالیت QC نمی تواند خالی باشد — through the define dialog.

When('{actor} اطلاعات فعالیت QC جدید را وارد می کند', async (actor: Actor) => {
  await noteTheCatalog();
  return performAsTheActor(
    actor,
    EnterNewQcActivityDetails(aFreshQcActivityName()),
  );
});

When('عنوان فعالیت را خالی می گذارد', () =>
  actorInTheSpotlight().attemptsTo(SubmitTheQcActivityLeavingTheNameEmpty()),
);

Then('پیغام خطای عنوان فعالیت QC نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureQcActivityNameErrorShown()),
);

// قانون: عنوان هر فعالیت QC باید یکتا باشد — after a define or a rename over the API, the 409.

When(
  '{actor} عنوان فعالیت QC {string} را به {string} تغییر می دهد',
  async (actor: Actor, name: string, newName: string) => {
    await noteTheCatalog();
    return performAsTheActor(
      actor,
      RenameQcActivity.viaApiUsing(name, newName),
    );
  },
);

Then('پیغام خطای تکراری بودن عنوان فعالیت QC نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheQcActivityNameIsTaken()),
);

// قانون: فعالیت QC که به تجهیزی تخصیص داده شده یا سابقه انجام دارد قابل ویرایش یا حذف نیست
// («… تلاش می کند عنوان … را به … تغییر دهد» is in ./common.steps.ts)

When(
  '{actor} تلاش می کند فعالیت QC {string} را حذف کند',
  async (actor: Actor, name: string) => {
    await noteTheCatalog();
    triedThrough('api');
    return performAsTheActor(actor, DeleteQcActivity.viaApiUsing(name));
  },
);

When('{actor} فعالیت QC {string} را حذف می کند', (actor: Actor, name: string) =>
  performAsTheActor(actor, DeleteQcActivity.viaApiUsing(name)),
);

Then('فعالیت QC {string} در سیستم نباشد', (name: string) =>
  asTheSystemAdmin(EnsureQcActivityIsNotDefined(name)),
);

// قانون: مدیر سیستم عنوان فعالیت QC در حال استفاده را اصلاح می کند و اصلاح در سوابق آن اعمال می شود
// (issue #110's exception, granted to QC activities by issue #119 — `applyToRelatedRecords: true`)

When(
  '{actor} عنوان فعالیت QC {string} را به {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  (actor: Actor, name: string, newName: string) =>
    performAsTheActor(actor, CorrectQcActivityName.viaApiUsing(name, newName)),
);

Then(
  'هر {int} سابقه انجام QC {string} با فعالیت {string} باشند',
  (count: number, equipmentName: string, activityName: string) =>
    asTheSystemAdmin(
      EnsureEveryQcRecordOfEquipmentIsOf(equipmentName, count, activityName),
    ),
);

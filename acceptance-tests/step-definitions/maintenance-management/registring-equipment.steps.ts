import { Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  ClearTheEquipmentName,
  EnsureDuplicateEquipmentNameErrorShown,
  EnsureEquipmentIsRegistered,
  EnsureEquipmentNameErrorShown,
  EnsureEquipmentWasNotRenamed,
  EnsureNoNewEquipmentWasRegistered,
  EnterNewEquipmentDetails,
  NoteTheEquipmentBeforeTheAttempt,
  RegisterEquipment,
  RegisterEquipmentUnlessRegistered,
  RenameEquipment,
  rememberTheEquipmentRenameTarget,
  RetireEquipment,
  SubmitEquipmentLeavingTheNameEmpty,
  CorrectEquipmentName,
} from '../../screenplay/maintenance-management/equipment';
import {
  DeleteEquipment,
  EnsureEquipmentIsRetired,
  EnsureThePlanOfTheEquipmentNamedIsEmpty,
} from '../../screenplay/maintenance-management/equipment-lifecycle';
import {
  EnsureTheHistoryOfTheEquipmentNamedHolds,
  EnsureTheHistoryOfTheEquipmentNamedIsEmpty,
} from '../../screenplay/maintenance-management/pm-execution-deletion';
import {
  asPersona,
  asTheSystemAdmin,
  theEquipmentNamed,
  theLastRegisteredEquipment,
} from '../../screenplay/maintenance-management/maintenance-records';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { theMaintenanceHistoryRangeLookedAt } from '../../screenplay/common/maintenance-history-view-context';
import { EnsureToldTheRecordIsUsedIn } from '../../screenplay/common/record-dependents';

// registring-equipment.feature. The plain-voice «… ثبت می کند» / «… تغییر می دهد» / «… وارد می
// کند» / «… پاک می کند» drive `/equipment`; the «تلاش …» attempts, every precondition and every
// fact go through the API (facts read by the system admin, so the actor's 403 survives for «پیغام
// خطای عدم دسترسی …»). Name errors are what the dialog shows. «اینکه تجهیز «…» در سیستم ثبت شده
// باشد», the other features' background, lives in ./common.steps.ts.

const aFreshEquipmentName = (): string => `تجهیز تست ${Date.now()}`;

When(
  '{actor} تجهیز جدیدی با نام {string} ثبت می کند',
  async (actor: Actor, name: string) => {
    await asTheSystemAdmin(NoteTheEquipmentBeforeTheAttempt());
    return actor.attemptsTo(RegisterEquipment.using(name));
  },
);

Then('تجهیز {string} در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(EnsureEquipmentIsRegistered(name)),
);

Given('اینکه تجهیزی با نام {string} در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(RegisterEquipmentUnlessRegistered(name)),
);

Given(
  'اینکه تجهیزی با نام {string} و تجهیز دیگری با نام {string} در سیستم ثبت شده باشد',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterEquipmentUnlessRegistered(first),
      RegisterEquipmentUnlessRegistered(second),
    ),
);

When(
  '{actor} نام تجهیز {string} را به {string} تغییر می دهد',
  (actor: Actor, from: string, to: string) => {
    rememberTheEquipmentRenameTarget(theEquipmentNamed(from));
    return actor.attemptsTo(RenameEquipment.using(from, to));
  },
);

// قانون: فقط مدیر فنی و مدیر سیستم مجاز به ثبت و ویرایش تجهیزات هستند
// («پیغام خطای عدم دسترسی نشان داده شود» — step-definitions/common.steps.ts)

When('{actor} تلاش می کند تجهیز جدیدی ثبت کند', async (actor: Actor) => {
  await asTheSystemAdmin(NoteTheEquipmentBeforeTheAttempt());
  return actor.attemptsTo(RegisterEquipment.viaApiUsing(aFreshEquipmentName()));
});

Then('تجهیز جدیدی ثبت نشده باشد', () =>
  asTheSystemAdmin(EnsureNoNewEquipmentWasRegistered()),
);

When(
  '{actor} تلاش می کند نام تجهیز {string} را تغییر دهد',
  (actor: Actor, name: string) => {
    const target = theEquipmentNamed(name);
    rememberTheEquipmentRenameTarget(target);
    return actor.attemptsTo(
      RenameEquipment.viaApiUsing(target, aFreshEquipmentName()),
    );
  },
);

Then('تجهیز ویرایش نشده باشد', () =>
  asTheSystemAdmin(EnsureEquipmentWasNotRenamed()),
);

// قانون: نام تجهیز نمی تواند خالی باشد

When('{actor} اطلاعات تجهیز جدید را وارد می کند', async (actor: Actor) => {
  await asTheSystemAdmin(NoteTheEquipmentBeforeTheAttempt());
  return actor.attemptsTo(EnterNewEquipmentDetails(aFreshEquipmentName()));
});

When('نام تجهیز را خالی می گذارد', () =>
  actorInTheSpotlight().attemptsTo(SubmitEquipmentLeavingTheNameEmpty()),
);

Then('پیغام خطای نام تجهیز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureEquipmentNameErrorShown()),
);

When('{actor} نام آن تجهیز را پاک می کند', (actor: Actor) => {
  const target = theLastRegisteredEquipment();
  rememberTheEquipmentRenameTarget(target);
  return actor.attemptsTo(ClearTheEquipmentName(target.name));
});

// قانون: نام هر تجهیز باید یکتا باشد

Then('پیغام خطای تکراری بودن نام تجهیز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateEquipmentNameErrorShown()),
);

// قانون: تجهیزی که برنامه PM یا سابقه تعمیرات دارد قابل ویرایش نیست (issue #94)
//
// The «تلاش …» rename goes through the API, like every attempt in this area; the plan item
// precondition («فعالیت … در برنامه تجهیز … باشد / بوده و غیرفعال شده باشد») is shared
// (./common.steps.ts, ./planning-preventive-maintenance.steps.ts). The fact is read by the system
// admin; what the actor was told is the 409's `dependents`.

When(
  '{actor} تلاش می کند نام تجهیز {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, newName: string) => {
    const target = theEquipmentNamed(name);
    rememberTheEquipmentRenameTarget(target);
    triedThrough('api');
    return actor.attemptsTo(RenameEquipment.viaApiUsing(target, newName));
  },
);

Then('تجهیز {string} ویرایش نشده باشد', (_name: string) =>
  asTheSystemAdmin(EnsureEquipmentWasNotRenamed()),
);

// قانون: مدیر سیستم نام تجهیزی را که برنامه PM یا سابقه تعمیرات دارد، حتی اگر کنار گذاشته شده باشد، اصلاح می کند و اصلاح در برنامه ها و سوابق آن اعمال می شود
// (issue #110 — it replaced issue #94's «مدیر سیستم هم نام تجهیزی را که برنامه PM دارد نمی تواند
// تغییر دهد»; the «تلاش …» steps above still serve the technical manager's refusal)
//
// The correction drives `/equipment` — the row's edit dialog, then the correction confirmation it
// opens (`common/correction-confirmation.ts`). Every fact is read over the API, the equipment by its
// name now (the registry knows it by the old one). «تجهیز … کنار گذاشته شده باشد» lives in
// ./technical-management-dashboard.steps.ts, «… همچنان کنار گذاشته شده باشد» in ./common.steps.ts.

Given('تجهیز {string} فعال باشد', (equipmentName: string) =>
  asTheSystemAdmin(EnsureEquipmentIsRetired(equipmentName, false)),
);

When(
  '{actor} نام تجهیز {string} را به {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  (actor: Actor, currentName: string, newName: string) =>
    actor.attemptsTo(CorrectEquipmentName.using(currentName, newName)),
);

// «سابقه انجام تعویض روغن برای موعد «…» …» names the activity alone: the equipment follows.
Then(
  'سابقه انجام {maintenanceTask} برای موعد {string} در سابقه تعمیرات {equipmentName} باشد',
  (activityName: string, dueDate: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheHistoryOfTheEquipmentNamedHolds(
        equipmentName,
        activityName,
        dueDate,
      ),
    ),
);

Then('تجهیز {string} همچنان فعال باشد', (equipmentName: string) =>
  asTheSystemAdmin(EnsureEquipmentIsRetired(equipmentName, false)),
);

// قانون: نام تجهیزی که مدیر سیستم حذف کرده دوباره قابل استفاده است (issue #110)
//
// The deletion is a precondition over the API (retired first: only retired equipment can be
// deleted); the new registration is the plain «… تجهیز جدیدی با نام … ثبت می کند» above, through
// `/equipment`. The facts read the equipment the system has by that name now.

Given(
  'تجهیز {string} کنار گذاشته و سپس توسط {actorName} حذف شده باشد',
  (equipmentName: string, personaName: string) =>
    asPersona(
      personaName,
      RetireEquipment.viaApiUsing(equipmentName),
      DeleteEquipment.asAPrecondition(equipmentName),
    ),
);

Then('هیچ فعالیتی در برنامه تجهیز {string} نباشد', (equipmentName: string) =>
  asTheSystemAdmin(EnsureThePlanOfTheEquipmentNamedIsEmpty(equipmentName)),
);

// No entry at all — neither a recording nor, since issue #114, a missed occurrence. Also
// recording-maintenance-execution's, after «… سابقه تعمیرات … را (با بازه …) مشاهده می کند»: then
// for the range looked at (`common/maintenance-history-view-context.ts`).
Then('سابقه تعمیرات {equipmentName} خالی باشد', (equipmentName: string) =>
  asTheSystemAdmin(
    EnsureTheHistoryOfTheEquipmentNamedIsEmpty(
      equipmentName,
      theMaintenanceHistoryRangeLookedAt(),
    ),
  ),
);

Then(
  'به او گفته شود که {string} در برنامه PM استفاده شده است',
  (name: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({ kind: 'equipment-pm-plan', name }),
    ),
);

import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  AssignLegacySpecialties,
  attemptedTheSpecialtyThrough,
  ChangeMaintenanceActivitySpecialty,
  EnsureDuplicateMaintenanceActivityNameErrorShown,
  EnsureMaintenanceActivitySpecialty,
  EnsureSpecialtyErrorShown,
  EnsureToldEveryActivityNeedsASpecialty,
  EnsureMaintenanceActivityIsRegistered,
  EnsureMaintenanceActivityNameErrorShown,
  EnsureMaintenanceActivityWasNotRenamed,
  EnsureNoNewMaintenanceActivityWasRegistered,
  EnterNewMaintenanceActivityDetails,
  NoteTheMaintenanceActivitiesBeforeTheAttempt,
  RegisterLegacyMaintenanceActivity,
  RegisterMaintenanceActivity,
  RegisterMaintenanceActivityUnlessRegistered,
  RenameMaintenanceActivity,
  rememberTheMaintenanceActivityRenameTarget,
  SubmitMaintenanceActivityLeavingTheNameEmpty,
} from '../../screenplay/maintenance-management/maintenance-activity';
import {
  asAMaintenanceObserver,
  asPersona,
  asTheSystemAdmin,
  theActivityNamed,
} from '../../screenplay/maintenance-management/maintenance-records';
import { specialtyNamed } from '../../screenplay/maintenance-management/maintenance-api';
import {
  EnsurePmPlanIsUnchanged,
  NoteThePmPlansBeforeTheChange,
} from '../../screenplay/maintenance-management/pm-plan';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { EnsureToldTheRecordIsUsedIn } from '../../screenplay/common/record-dependents';

// registring-maintenance-activity.feature — the same doors as registring-equipment: the
// plain-voice actions drive `/maintenance-activities`, the «تلاش …» attempts, preconditions and
// facts go through the API, name errors are what the dialog shows.
//
// Issue #108 adds the specialty: chosen in the dialog's «تخصص» radio group, sent as `specialty`
// («برق» = electrical, «مکانیک» = mechanical). Steps that name no specialty register «مکانیک».
// The legacy assignment's full «… به صورت زیر تعیین می کند» goes through the system admin's modal;
// the partial one and the «تلاش …» attempt through the API — the modal will not submit a partial
// choice, so the all-or-nothing rule is the backend's to show.

const aFreshActivityName = (): string => `فعالیت تست ${Date.now()}`;

When(
  '{actor} فعالیت جدیدی با نام {string} و تخصص {string} ثبت می کند',
  async (actor: Actor, name: string, specialty: string) => {
    await asTheSystemAdmin(NoteTheMaintenanceActivitiesBeforeTheAttempt());
    return actor.attemptsTo(
      RegisterMaintenanceActivity.using(name, specialtyNamed(specialty)),
    );
  },
);

Then(
  'فعالیت {string} با تخصص {string} در سیستم ثبت شده باشد',
  (name: string, specialty: string) =>
    asAMaintenanceObserver(
      EnsureMaintenanceActivitySpecialty(name, specialtyNamed(specialty)),
    ),
);

Given(
  'اینکه فعالیتی با نام {string} و تخصص {string} در سیستم ثبت شده باشد',
  (name: string, specialty: string) =>
    asTheSystemAdmin(
      RegisterMaintenanceActivityUnlessRegistered(
        name,
        specialtyNamed(specialty),
      ),
    ),
);

When(
  '{actor} تخصص فعالیت {string} را به {string} تغییر می دهد',
  (actor: Actor, name: string, specialty: string) =>
    actor.attemptsTo(
      ChangeMaintenanceActivitySpecialty.using(name, specialtyNamed(specialty)),
    ),
);

Then('فعالیت {string} در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(EnsureMaintenanceActivityIsRegistered(name)),
);

Given('اینکه فعالیتی با نام {string} در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(RegisterMaintenanceActivityUnlessRegistered(name)),
);

Given(
  'اینکه فعالیتی با نام {string} و فعالیت دیگری با نام {string} در سیستم ثبت شده باشد',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterMaintenanceActivityUnlessRegistered(first),
      RegisterMaintenanceActivityUnlessRegistered(second),
    ),
);

When(
  '{actor} نام فعالیت {string} را به {string} تغییر می دهد',
  (actor: Actor, from: string, to: string) => {
    rememberTheMaintenanceActivityRenameTarget(theActivityNamed(from));
    return actor.attemptsTo(RenameMaintenanceActivity.using(from, to));
  },
);

// قانون: فقط مدیر فنی و مدیر سیستم مجاز به ثبت و ویرایش فعالیت ها هستند
// («پیغام خطای عدم دسترسی نشان داده شود» — step-definitions/common.steps.ts)

When('{actor} تلاش می کند فعالیت جدیدی ثبت کند', async (actor: Actor) => {
  await asTheSystemAdmin(NoteTheMaintenanceActivitiesBeforeTheAttempt());
  return actor.attemptsTo(
    RegisterMaintenanceActivity.viaApiUsing(aFreshActivityName()),
  );
});

Then('فعالیت جدیدی ثبت نشده باشد', () =>
  asTheSystemAdmin(EnsureNoNewMaintenanceActivityWasRegistered()),
);

When(
  '{actor} تلاش می کند نام فعالیت {string} را تغییر دهد',
  (actor: Actor, name: string) => {
    const target = theActivityNamed(name);
    rememberTheMaintenanceActivityRenameTarget(target);
    return actor.attemptsTo(
      RenameMaintenanceActivity.viaApiUsing(target, aFreshActivityName()),
    );
  },
);

Then('فعالیت ویرایش نشده باشد', () =>
  asTheSystemAdmin(EnsureMaintenanceActivityWasNotRenamed()),
);

// قانون: هر فعالیت باید دقیقا یکی از دو تخصص برق یا مکانیک را داشته باشد
// («فعالیت جدیدی ثبت نشده باشد» — above)

When(
  '{actor} فعالیت جدیدی با نام {string} بدون تخصص ثبت می کند',
  async (actor: Actor, name: string) => {
    await asTheSystemAdmin(NoteTheMaintenanceActivitiesBeforeTheAttempt());
    attemptedTheSpecialtyThrough('browser');
    return actor.attemptsTo(
      RegisterMaintenanceActivity.withoutASpecialtyUsing(name),
    );
  },
);

When(
  '{actor} فعالیت جدیدی با نام {string} با هر دو تخصص برق و مکانیک ثبت می کند',
  async (actor: Actor, name: string) => {
    await asTheSystemAdmin(NoteTheMaintenanceActivitiesBeforeTheAttempt());
    attemptedTheSpecialtyThrough('api');
    return actor.attemptsTo(
      RegisterMaintenanceActivity.withBothSpecialtiesViaApiUsing(name),
    );
  },
);

Then('پیغام خطای تخصص فعالیت نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureSpecialtyErrorShown()),
);

// قانون: نام فعالیت نمی تواند خالی باشد

When('{actor} اطلاعات فعالیت جدید را وارد می کند', async (actor: Actor) => {
  await asTheSystemAdmin(NoteTheMaintenanceActivitiesBeforeTheAttempt());
  return actor.attemptsTo(
    EnterNewMaintenanceActivityDetails(aFreshActivityName()),
  );
});

When('نام فعالیت را خالی می گذارد', () =>
  actorInTheSpotlight().attemptsTo(
    SubmitMaintenanceActivityLeavingTheNameEmpty(),
  ),
);

Then('پیغام خطای نام فعالیت نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaintenanceActivityNameErrorShown()),
);

// قانون: نام هر فعالیت باید یکتا باشد

Then('پیغام خطای تکراری بودن نام فعالیت نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureDuplicateMaintenanceActivityNameErrorShown(),
  ),
);

// قانون: فعالیتی که در برنامه PM تجهیزی آمده یا سابقه انجام دارد قابل ویرایش نیست (issue #94)
//
// The same doors as registring-equipment's rule of the same shape: the «تلاش …» rename over the
// API, the fact read by the system admin, what the actor was told from the 409's `dependents`.

When(
  '{actor} تلاش می کند نام فعالیت {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, newName: string) => {
    const target = theActivityNamed(name);
    rememberTheMaintenanceActivityRenameTarget(target);
    triedThrough('api');
    return actor.attemptsTo(
      RenameMaintenanceActivity.viaApiUsing(target, newName),
    );
  },
);

Then('فعالیت {string} ویرایش نشده باشد', (_name: string) =>
  asTheSystemAdmin(EnsureMaintenanceActivityWasNotRenamed()),
);

Then(
  'به او گفته شود که {string} در برنامه PM {int} تجهیز استفاده شده است',
  (_name: string, count: number) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({ kind: 'equipment-pm-plan', count }),
    ),
);

// The specialty locks with the name: the same 409, asked over the API as the rename attempt is.
// Also the legacy rule's «یاشار تلاش می کند …», once the assignment has been made.
When(
  '{actor} تلاش می کند تخصص فعالیت {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, specialty: string) => {
    triedThrough('api');
    return actor.attemptsTo(
      ChangeMaintenanceActivitySpecialty.viaApiUsing(
        theActivityNamed(name),
        specialtyNamed(specialty),
      ),
    );
  },
);

// Read by an observer other than the actor, whose 409 «به او گفته شود …» judges next.
Then(
  'فعالیت {string} با تخصص {string} باقی مانده باشد',
  (name: string, specialty: string) =>
    asAMaintenanceObserver(
      EnsureMaintenanceActivitySpecialty(name, specialtyNamed(specialty)),
    ),
);

// قانون: تخصص فعالیت های قبلی را مدیر سیستم یک بار و برای همه آن ها با هم تعیین می کند …
//
// «فعالیت … با دوره … در برنامه تجهیز … باشد» (./common.steps.ts), «مسلمی انجام … برای موعد … را
// در … ثبت کرده باشد» (./pm-schedule-overview.steps.ts) and «سابقه تعمیرات … به صورت زیر باشد»
// (./planning-preventive-maintenance.steps.ts, which reads the «تخصص» column too) are reused.

Given(
  'اینکه فعالیت های {string} و {string} پیش از تعیین تخصص ثبت شده باشند و تخصصی نداشته باشند',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterLegacyMaintenanceActivity(first),
      RegisterLegacyMaintenanceActivity(second),
    ),
);

Given(
  'اینکه فعالیت {string} پیش از تعیین تخصص ثبت شده باشد و تخصصی نداشته باشد',
  (name: string) => asTheSystemAdmin(RegisterLegacyMaintenanceActivity(name)),
);

// The plans are noted first, for «برنامه تجهیز … تغییری نکرده باشد».
When(
  '{actor} تخصص فعالیت های قبلی را به صورت زیر تعیین می کند',
  async (actor: Actor, table: DataTable) => {
    await asTheSystemAdmin(NoteThePmPlansBeforeTheChange());
    return actor.attemptsTo(
      AssignLegacySpecialties.using(
        table.hashes().map((row) => ({
          activityName: row['فعالیت'],
          specialty: specialtyNamed(row['تخصص']),
        })),
      ),
    );
  },
);

Then('برنامه تجهیز {string} تغییری نکرده باشد', (equipmentName: string) =>
  asTheSystemAdmin(EnsurePmPlanIsUnchanged(equipmentName)),
);

When(
  '{actor} فقط تخصص فعالیت {string} را {string} تعیین می کند',
  (actor: Actor, name: string, specialty: string) =>
    actor.attemptsTo(
      AssignLegacySpecialties.viaApiUsing([
        { activityName: name, specialty: specialtyNamed(specialty) },
      ]),
    ),
);

Then(
  'فعالیت های {string} و {string} همچنان تخصصی نداشته باشند',
  (first: string, second: string) =>
    asAMaintenanceObserver(
      EnsureMaintenanceActivitySpecialty(first, null),
      EnsureMaintenanceActivitySpecialty(second, null),
    ),
);

Then('پیغام خطای تعیین نشدن تخصص همه فعالیت ها نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldEveryActivityNeedsASpecialty()),
);

Given(
  '{actorName} تخصص فعالیت {string} را {string} تعیین کرده باشد',
  (personaName: string, name: string, specialty: string) =>
    asPersona(
      personaName,
      AssignLegacySpecialties.asAPrecondition([
        { activityName: name, specialty: specialtyNamed(specialty) },
      ]),
    ),
);

When(
  '{actor} تلاش می کند تخصص فعالیت قبلی {string} را {string} تعیین کند',
  (actor: Actor, name: string, specialty: string) =>
    actor.attemptsTo(
      AssignLegacySpecialties.viaApiUsing([
        { activityName: name, specialty: specialtyNamed(specialty) },
      ]),
    ),
);

Then('فعالیت {string} همچنان تخصصی نداشته باشد', (name: string) =>
  asAMaintenanceObserver(EnsureMaintenanceActivitySpecialty(name, null)),
);

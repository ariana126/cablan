import { Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  EnsureDuplicateMaintenanceActivityNameErrorShown,
  EnsureMaintenanceActivityIsRegistered,
  EnsureMaintenanceActivityNameErrorShown,
  EnsureMaintenanceActivityWasNotRenamed,
  EnsureNoNewMaintenanceActivityWasRegistered,
  EnterNewMaintenanceActivityDetails,
  NoteTheMaintenanceActivitiesBeforeTheAttempt,
  RegisterMaintenanceActivity,
  RegisterMaintenanceActivityUnlessRegistered,
  RenameMaintenanceActivity,
  rememberTheMaintenanceActivityRenameTarget,
  SubmitMaintenanceActivityLeavingTheNameEmpty,
} from '../../screenplay/maintenance-management/maintenance-activity';
import {
  asTheSystemAdmin,
  theActivityNamed,
} from '../../screenplay/maintenance-management/maintenance-records';

// registring-maintenance-activity.feature — the same doors as registring-equipment: the
// plain-voice actions drive `/maintenance-activities`, the «تلاش …» attempts, preconditions and
// facts go through the API, name errors are what the dialog shows.

const aFreshActivityName = (): string => `فعالیت تست ${Date.now()}`;

When(
  '{actor} فعالیت جدیدی با نام {string} ثبت می کند',
  async (actor: Actor, name: string) => {
    await asTheSystemAdmin(NoteTheMaintenanceActivitiesBeforeTheAttempt());
    return actor.attemptsTo(RegisterMaintenanceActivity.using(name));
  },
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

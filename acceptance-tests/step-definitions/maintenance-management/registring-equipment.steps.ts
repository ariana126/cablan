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
  SubmitEquipmentLeavingTheNameEmpty,
} from '../../screenplay/maintenance-management/equipment';
import {
  asTheSystemAdmin,
  theEquipmentNamed,
  theLastRegisteredEquipment,
} from '../../screenplay/maintenance-management/maintenance-records';

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

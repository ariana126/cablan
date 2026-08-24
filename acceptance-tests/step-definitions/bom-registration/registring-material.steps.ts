import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  freshMaterialDetails,
  NewMaterialDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredMaterial,
  theMaterialRegisteredWithName,
} from '../../screenplay/bom-registration/material-details';
import {
  AttemptToRegisterLeavingNameEmpty,
  EnsureDuplicateMaterialNameErrorShown,
  EnsureMaterialNameErrorShown,
  EnsureMaterialWasRegistered,
  EnsureNewMaterialWasNotRegistered,
  EnterNewMaterialDetails,
  RegisterMaterial,
  RegisterMaterialAndRememberIt,
} from '../../screenplay/bom-registration/register-material';
import {
  AttemptToClearMaterialName,
  EditMaterial,
  EnsureMaterialWasEditedWith,
  EnsureMaterialWasNotEdited,
} from '../../screenplay/bom-registration/edit-material';
import {
  DeleteMaterial,
  EnsureMaterialWasDeleted,
  EnsureMaterialWasNotDeleted,
} from '../../screenplay/bom-registration/delete-material';

// سناریو: ثبت مواد اولیه جدید

When('{actor} مواد اولیه جدیدی با اطلاعات معتبر ثبت می کند', (actor: Actor) => {
  const details = freshMaterialDetails();
  rememberAttempt<NewMaterialDetails>(details);
  return actor.attemptsTo(RegisterMaterial.using(details));
});

Then('مواد اولیه جدیدی در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureMaterialWasRegistered(theAttempt<NewMaterialDetails>()),
  ),
);

// سناریو: ویرایش مواد اولیه

Given('اینکه یک مواد اولیه در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterMaterialAndRememberIt(freshMaterialDetails()),
  ),
);

When('{actor} اطلاعات آن مواد اولیه را ویرایش می کند', (actor: Actor) => {
  const target = theLastRegisteredMaterial();
  const changes: Partial<NewMaterialDetails> = {
    name: freshMaterialDetails().name,
  };
  rememberAttempt<Partial<NewMaterialDetails>>(changes);
  return actor.attemptsTo(EditMaterial.using(target.name, changes));
});

Then('اطلاعات ویرایش شده مواد اولیه در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureMaterialWasEditedWith(theAttempt<Partial<NewMaterialDetails>>()),
  ),
);

// سناریو: حذف مواد اولیه

When('{actor} آن مواد اولیه را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(DeleteMaterial.using(theLastRegisteredMaterial().name)),
);

Then('آن مواد اولیه از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWasDeleted()),
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف مواد اولیه هستند
// (پیغام خطای عدم دسترسی نشان داده شود — تعریف شده در step-definitions/common.steps.ts)

When('{actor} تلاش می کند مواد اولیه جدیدی ثبت کند', (actor: Actor) => {
  const details = freshMaterialDetails();
  rememberAttempt<NewMaterialDetails>(details);
  return actor.attemptsTo(RegisterMaterial.viaApiUsing(details));
});

Then('مواد اولیه جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewMaterialWasNotRegistered()),
);

When(
  '{actor} تلاش می کند اطلاعات آن مواد اولیه را ویرایش کند',
  (actor: Actor) =>
    actor.attemptsTo(
      EditMaterial.viaApiUsing(theLastRegisteredMaterial().id, {
        name: 'تلاش بدون دسترسی',
      }),
    ),
);

Then('مواد اولیه ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWasNotEdited()),
);

When('{actor} تلاش می کند آن مواد اولیه را حذف کند', (actor: Actor) =>
  actor.attemptsTo(DeleteMaterial.viaApiUsing(theLastRegisteredMaterial().id)),
);

Then('آن مواد اولیه از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWasNotDeleted()),
);

// قانون: اسم مواد اولیه نباید خالی باشد

When('{actor} اطلاعات مواد اولیه جدید را وارد می کند', (actor: Actor) => {
  const details = freshMaterialDetails();
  rememberAttempt<NewMaterialDetails>(details);
  return actor.attemptsTo(EnterNewMaterialDetails(details));
});

When('اسم مواد اولیه را خالی می گذارد', () => {
  const changes: NewMaterialDetails = {
    ...theAttempt<NewMaterialDetails>(),
    name: '',
  };
  rememberAttempt<NewMaterialDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingNameEmpty());
});

Then('پیغام خطای اسم مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialNameErrorShown()),
);

When('{actor} اسم آن مواد اولیه را پاک می کند', (actor: Actor) => {
  const target = theLastRegisteredMaterial();
  rememberAttempt<Partial<NewMaterialDetails>>({ name: '' });
  return actor.attemptsTo(AttemptToClearMaterialName(target.name));
});

// قانون: اسم هر مواد اولیه باید یونیک باشد

Given(
  'اینکه مواد اولیه ای با اسم {string} در سیستم ثبت شده باشد',
  (name: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ name })),
    ),
);

When(
  '{actor} مواد اولیه جدیدی با اسم {string} ثبت می کند',
  (actor: Actor, name: string) => {
    const details = freshMaterialDetails({ name });
    rememberAttempt<NewMaterialDetails>(details);
    return actor.attemptsTo(RegisterMaterial.using(details));
  },
);

Then('پیغام خطای تکراری بودن اسم مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateMaterialNameErrorShown()),
);

Given(
  'اینکه مواد اولیه ای با اسم {string} و مواد اولیه دیگری با اسم {string} در سیستم ثبت شده باشد',
  (nameA: string, nameB: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ name: nameA })),
      RegisterMaterialAndRememberIt(freshMaterialDetails({ name: nameB })),
    ),
);

When(
  '{actor} اسم مواد اولیه {string} را به {string} تغییر می دهد',
  (actor: Actor, fromName: string, toName: string) => {
    const target = theMaterialRegisteredWithName(fromName);
    const changes: Partial<NewMaterialDetails> = { name: toName };
    rememberAttempt<Partial<NewMaterialDetails>>(changes);
    return actor.attemptsTo(EditMaterial.using(target.name, changes));
  },
);

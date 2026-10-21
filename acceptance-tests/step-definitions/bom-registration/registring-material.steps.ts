import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  freshMaterialDetails,
  NewMaterialDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredMaterial,
  theMaterialRegisteredWithCode,
  theMaterialRegisteredWithName,
} from '../../screenplay/bom-registration/material-details';
import {
  AttemptToRegisterLeavingCodeEmpty,
  AttemptToRegisterLeavingNameEmpty,
  EnsureDuplicateMaterialCodeErrorShown,
  EnsureDuplicateMaterialNameErrorShown,
  EnsureMaterialCodeErrorShown,
  EnsureMaterialNameErrorShown,
  EnsureMaterialWasRegistered,
  EnsureNewMaterialWasNotRegistered,
  EnterNewMaterialDetails,
  RegisterMaterial,
  RegisterMaterialAndRememberIt,
} from '../../screenplay/bom-registration/register-material';
import {
  AttemptToClearMaterialCode,
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
        code: theLastRegisteredMaterial().code,
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

// قانون: کد مواد اولیه نباید خالی باشد
// («{actor} اطلاعات مواد اولیه جدید را وارد می کند» — defined above, under the name rule)

When('کد مواد اولیه را خالی می گذارد', () => {
  const changes: NewMaterialDetails = {
    ...theAttempt<NewMaterialDetails>(),
    code: '',
  };
  rememberAttempt<NewMaterialDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingCodeEmpty());
});

Then('پیغام خطای کد مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialCodeErrorShown()),
);

When('{actor} کد آن مواد اولیه را پاک می کند', (actor: Actor) => {
  const target = theLastRegisteredMaterial();
  rememberAttempt<Partial<NewMaterialDetails>>({ code: '' });
  return actor.attemptsTo(AttemptToClearMaterialCode(target.name));
});

// قانون: کد هر مواد اولیه باید یونیک باشد

Given(
  'اینکه مواد اولیه ای با کد {string} در سیستم ثبت شده باشد',
  (code: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ code })),
    ),
);

When(
  '{actor} مواد اولیه جدیدی با کد {string} ثبت می کند',
  (actor: Actor, code: string) => {
    const details = freshMaterialDetails({ code });
    rememberAttempt<NewMaterialDetails>(details);
    return actor.attemptsTo(RegisterMaterial.using(details));
  },
);

Then('پیغام خطای تکراری بودن کد مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateMaterialCodeErrorShown()),
);

Given(
  'اینکه مواد اولیه ای با کد {string} و مواد اولیه دیگری با کد {string} در سیستم ثبت شده باشد',
  (codeA: string, codeB: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ code: codeA })),
      RegisterMaterialAndRememberIt(freshMaterialDetails({ code: codeB })),
    ),
);

When(
  '{actor} کد مواد اولیه {string} را به {string} تغییر می دهد',
  (actor: Actor, fromCode: string, toCode: string) => {
    const target = theMaterialRegisteredWithCode(fromCode);
    const changes: Partial<NewMaterialDetails> = { code: toCode };
    rememberAttempt<Partial<NewMaterialDetails>>(changes);
    return actor.attemptsTo(EditMaterial.using(target.name, changes));
  },
);

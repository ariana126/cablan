import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  freshComponentDetails,
  NewComponentDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredComponent,
  theComponentRegisteredWithName,
} from '../../screenplay/bom-registration/component-details';
import {
  AttemptToRegisterLeavingNameEmpty,
  EnsureDuplicateComponentNameErrorShown,
  EnsureComponentNameErrorShown,
  EnsureComponentWasRegistered,
  EnterNewComponentDetails,
  RegisterComponent,
  RegisterComponentAndRememberIt,
} from '../../screenplay/bom-registration/register-component';
import {
  AttemptToClearComponentName,
  EditComponent,
  EnsureComponentWasEditedWith,
} from '../../screenplay/bom-registration/edit-component';
import {
  DeleteComponent,
  EnsureComponentWasDeleted,
  EnsureComponentWasNotDeleted,
} from '../../screenplay/bom-registration/delete-component';

// سناریو: ثبت جز جدید

When('{actor} جز جدیدی با اطلاعات معتبر ثبت می کند', (actor: Actor) => {
  const details = freshComponentDetails();
  rememberAttempt<NewComponentDetails>(details);
  return actor.attemptsTo(RegisterComponent.using(details));
});

Then('جز جدیدی در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureComponentWasRegistered(theAttempt<NewComponentDetails>()),
  ),
);

// سناریو: ویرایش جز

Given('اینکه یک جز در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterComponentAndRememberIt(freshComponentDetails()),
  ),
);

When('{actor} اطلاعات آن جز را ویرایش می کند', (actor: Actor) => {
  const target = theLastRegisteredComponent();
  const changes: Partial<NewComponentDetails> = {
    name: freshComponentDetails().name,
  };
  rememberAttempt<Partial<NewComponentDetails>>(changes);
  return actor.attemptsTo(EditComponent.using(target.name, changes));
});

Then('اطلاعات ویرایش شده جز در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureComponentWasEditedWith(theAttempt<Partial<NewComponentDetails>>()),
  ),
);

// سناریو: حذف جز

When('{actor} آن جز را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(DeleteComponent.using(theLastRegisteredComponent().name)),
);

Then('آن جز از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentWasDeleted()),
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف جز هستند
// (پیغام خطای عدم دسترسی نشان داده شود — تعریف شده در step-definitions/common.steps.ts)

When('{actor} تلاش می کند جز جدیدی ثبت کند', (actor: Actor) => {
  const details = freshComponentDetails();
  rememberAttempt<NewComponentDetails>(details);
  return actor.attemptsTo(RegisterComponent.viaApiUsing(details));
});

// 'جز جدیدی ثبت نشده باشد' recurs verbatim in registring-product.feature (a component
// registered under a product without materials), so it's defined once in
// step-definitions/bom-registration/common.steps.ts to avoid an ambiguous match — see this
// suite's "don't redefine a step another feature already implements" gotcha.

When('{actor} تلاش می کند اطلاعات آن جز را ویرایش کند', (actor: Actor) =>
  actor.attemptsTo(
    EditComponent.viaApiUsing(theLastRegisteredComponent().id, {
      name: 'تلاش بدون دسترسی',
    }),
  ),
);

// 'جز ویرایش نشده باشد' recurs verbatim in registring-product.feature (deleting all of a
// component's materials), so it's likewise defined once in
// step-definitions/bom-registration/common.steps.ts.

When('{actor} تلاش می کند آن جز را حذف کند', (actor: Actor) =>
  actor.attemptsTo(
    DeleteComponent.viaApiUsing(theLastRegisteredComponent().id),
  ),
);

Then('آن جز از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentWasNotDeleted()),
);

// قانون: اسم جز نباید خالی باشد

When('{actor} اطلاعات جز جدید را وارد می کند', (actor: Actor) => {
  const details = freshComponentDetails();
  rememberAttempt<NewComponentDetails>(details);
  return actor.attemptsTo(EnterNewComponentDetails(details));
});

When('اسم جز را خالی می گذارد', () => {
  const changes: NewComponentDetails = {
    ...theAttempt<NewComponentDetails>(),
    name: '',
  };
  rememberAttempt<NewComponentDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingNameEmpty());
});

Then('پیغام خطای اسم جز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentNameErrorShown()),
);

When('{actor} اسم آن جز را پاک می کند', (actor: Actor) => {
  const target = theLastRegisteredComponent();
  rememberAttempt<Partial<NewComponentDetails>>({ name: '' });
  return actor.attemptsTo(AttemptToClearComponentName(target.name));
});

// قانون: اسم هر جز باید یونیک باشد

Given('اینکه جزئی با اسم {string} در سیستم ثبت شده باشد', (name: string) =>
  actorInTheSpotlight().attemptsTo(
    RegisterComponentAndRememberIt(freshComponentDetails({ name })),
  ),
);

When(
  '{actor} جز جدیدی با اسم {string} ثبت می کند',
  (actor: Actor, name: string) => {
    const details = freshComponentDetails({ name });
    rememberAttempt<NewComponentDetails>(details);
    return actor.attemptsTo(RegisterComponent.using(details));
  },
);

Then('پیغام خطای تکراری بودن اسم جز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateComponentNameErrorShown()),
);

Given(
  'اینکه جزئی با اسم {string} و جز دیگری با اسم {string} در سیستم ثبت شده باشد',
  (nameA: string, nameB: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterComponentAndRememberIt(freshComponentDetails({ name: nameA })),
      RegisterComponentAndRememberIt(freshComponentDetails({ name: nameB })),
    ),
);

When(
  '{actor} اسم جز {string} را به {string} تغییر می دهد',
  (actor: Actor, fromName: string, toName: string) => {
    const target = theComponentRegisteredWithName(fromName);
    const changes: Partial<NewComponentDetails> = { name: toName };
    rememberAttempt<Partial<NewComponentDetails>>(changes);
    return actor.attemptsTo(EditComponent.using(target.name, changes));
  },
);

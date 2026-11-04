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
  EnsureComponentWasStoredWithName,
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
import {
  EnsureComponentIsGone,
  EnsureComponentIsRegistered,
  RegisterComponentNamed,
  RegisterProductComposedOf,
  RegisterStandardBomUsing,
} from '../../screenplay/bom-registration/record-dependencies';
import { freshMaterialInComponent } from '../../screenplay/bom-registration/product-details';
import { performAsTheSystemAdmin } from '../../screenplay/common/observer';
import {
  CorrectComponent,
  EnsureProductHasComponent,
} from '../../screenplay/bom-registration/record-correction';
import { triedThrough } from '../../screenplay/common/refusal-door-context';

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

// قانون: رقم های نام جز با رقم انگلیسی ثبت می شوند، حتی اگر با رقم فارسی وارد شوند
//
// The When is active, so the form, typed as given («روکش ۲»); the Then reads the stored name back
// over HTTP («روکش 2»), so it proves what the system kept rather than what was typed.

When(
  '{actor} جز جدیدی با نام {string} ثبت می کند',
  (actor: Actor, name: string) => {
    const details = freshComponentDetails({ name });
    rememberAttempt<NewComponentDetails>(details);
    return actor.attemptsTo(RegisterComponent.using(details));
  },
);

Then('جز جدیدی با نام {string} در سیستم ثبت شده باشد', (name: string) =>
  actorInTheSpotlight().attemptsTo(EnsureComponentWasStoredWithName(name)),
);

// قانون: جزئی که در محصول یا آنالیز استانداردی استفاده شده باشد قابل ویرایش یا حذف نیست
// (issue #94)
//
// Same doors as the material rule (registring-material.steps.ts): deletions and the rename attempt
// drive `/components`; preconditions and facts go through the API as the system admin. Shared
// sentences — «"…" در هیچ …», «مواد اولیه … فقط در جز … محصول …», «برای محصول … هیچ آنالیز
// استانداردی …», «… با … جایگزین شده باشد», «به او گفته شود که …» — live in ./common.steps.ts.

Given('اینکه جز {string} در سیستم ثبت شده باشد', (name: string) =>
  performAsTheSystemAdmin(RegisterComponentNamed(name)),
);

When('{actor} جز {string} را حذف می کند', (actor: Actor, name: string) =>
  actor.attemptsTo(DeleteComponent.using(name)),
);

Then('جز {string} از سیستم حذف شده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureComponentIsGone(name)),
);

Given(
  'اینکه جز {string} فقط در محصول {string} استفاده شده باشد',
  (componentName: string, productName: string) =>
    performAsTheSystemAdmin(
      RegisterProductComposedOf(
        productName,
        componentName,
        freshMaterialInComponent().name,
      ),
    ),
);

Given(
  'اینکه جز {string} در محصول {string} استفاده شده باشد',
  (componentName: string, productName: string) =>
    performAsTheSystemAdmin(
      RegisterProductComposedOf(
        productName,
        componentName,
        freshMaterialInComponent().name,
      ),
    ),
);

// As for a material: a product and a standard BOM cloning it — see registring-material.steps.ts.
Given(
  'اینکه جز {string} فقط در آنالیز استاندارد {string} استفاده شده باشد',
  (componentName: string, miCode: string) =>
    performAsTheSystemAdmin(
      RegisterStandardBomUsing(
        componentName,
        freshMaterialInComponent().name,
        miCode,
      ),
    ),
);

When(
  '{actor} تلاش می کند جز {string} را حذف کند',
  (actor: Actor, name: string) => {
    triedThrough('browser');
    return actor.attemptsTo(DeleteComponent.using(name));
  },
);

Then('جز {string} از سیستم حذف نشده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureComponentIsRegistered(name)),
);

When(
  '{actor} تلاش می کند اسم جز {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, newName: string) => {
    triedThrough('browser');
    return actor.attemptsTo(EditComponent.using(name, { name: newName }));
  },
);

Then('جز {string} ویرایش نشده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureComponentIsRegistered(name)),
);

// قانون: مدیر سیستم اسم جز استفاده شده را اصلاح می کند و اصلاح در همه اطلاعات و سوابق مرتبط آن اعمال می شود
// (issue #110)
//
// The correction drives `/components` — the edit dialog, then the correction confirmation it
// opens (`common/correction-confirmation.ts`); the facts are read over the API as the system admin.
// «اینکه جز … در محصول … استفاده شده باشد» is above.

When(
  '{actor} اسم جز {string} را به {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  (actor: Actor, currentName: string, newName: string) =>
    actor.attemptsTo(CorrectComponent.using(currentName, newName)),
);

Then('جز {string} در سیستم ثبت شده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureComponentIsRegistered(name)),
);

Then(
  'محصول {string} جز {string} را داشته باشد',
  (productName: string, componentName: string) =>
    performAsTheSystemAdmin(
      EnsureProductHasComponent(productName, componentName),
    ),
);

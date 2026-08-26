import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  NewComponentInProduct,
  theLastRegisteredProduct,
  theProductRegisteredWithName,
} from '../../screenplay/bom-registration/product-details';
import {
  NewStandardBomDetails,
  freshBrand,
  freshMiCode,
  freshStandardLength,
  rememberAttempt,
  theAttempt,
  theLastRegisteredStandardBom,
} from '../../screenplay/bom-registration/standard-bom-details';
import {
  AttemptToRegisterLeavingBrandEmpty,
  AttemptToRegisterLeavingMiCodeEmpty,
  AttemptToRegisterLeavingStandardLengthEmpty,
  AttemptToRegisterStandardBomForProductViaApi,
  AttemptToRegisterWithMiCode,
  AttemptToRegisterWithoutSpecifyingActive,
  EnsureNewStandardBomWasNotRegistered,
  EnsureStandardBomWasRegistered,
  EnterNewStandardBomDetails,
  RegisterStandardBomAndRememberIt,
} from '../../screenplay/bom-registration/register-standard-bom';
import {
  EnsureActiveNotSpecifiedErrorShown,
  EnsureBrandErrorShown,
  EnsureDuplicateMiCodeErrorShown,
  EnsureMiCodeErrorShown,
  EnsureStandardLengthErrorShown,
} from '../../screenplay/bom-registration/standard-bom-form';
import {
  ChangeMiCodeToADuplicate,
  EditStandardBom,
  EnsureAllRegisteredComponentsBelongToStandardBom,
  EnsureStandardBomWasNotEdited,
  AttemptToClearBrand,
  AttemptToClearMiCode,
  AttemptToClearStandardLength,
  RegisterStandardBomForProductWithMultipleComponents,
} from '../../screenplay/bom-registration/edit-standard-bom';
import {
  DeleteStandardBom,
  EnsureStandardBomWasDeleted,
  EnsureStandardBomWasNotDeleted,
} from '../../screenplay/bom-registration/delete-standard-bom';
import { setCurrentComponentOwner } from '../../screenplay/common/composition-context';

// سناریو: ثبت آنالیز استاندارد جدید
//
// The When ("{actor} آنالیز استاندارد جدید برای محصول {string} ثبت می کند") is defined in
// step-definitions/common.steps.ts, since it was already stubbed there (shared, at least in
// principle, with the sibling bom-reporting features that reference the same precondition text).

Then('آنالیز استاندارد جدیدی اضافه شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureStandardBomWasRegistered(theAttempt<NewStandardBomDetails>().miCode),
  ),
);

// سناریو: ویرایش آنالیز استاندارد
//
// Its own Given ("اینکه یک آنالیز استاندارد برای محصول {string} ثبت شده باشد" — no "در سیستم") is
// defined in step-definitions/common.steps.ts, shared byte-for-byte with this rule's own
// access-denied edit/delete outlines below.

When('{actor} آنالیز استاندارد را ویرایش میکند', (actor: Actor) => {
  const target = theLastRegisteredStandardBom();
  const changes: Partial<NewStandardBomDetails> = { miCode: freshMiCode() };
  rememberAttempt<Partial<NewStandardBomDetails>>(changes);
  return actor.attemptsTo(EditStandardBom.using(target.miCode, changes));
});

// "اطلاعات ویرایش شده در سیستم ثبت شده باشد" is defined in
// step-definitions/bom-registration/common.steps.ts (shared, at least in principle, with
// registring-bom.feature's own "آنالیز روزانه" edit scenario, which carries the exact same generic
// wording but has no automation yet).

// سناریو: حذف آنالیز استاندارد

When('{actor} آنالیز استاندارد را حذف میکند', (actor: Actor) =>
  actor.attemptsTo(
    DeleteStandardBom.using(theLastRegisteredStandardBom().miCode),
  ),
);

Then('آنالیز استاندارد از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureStandardBomWasDeleted()),
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف آنالیز استاندارد هستند
// (پیغام خطای عدم دسترسی نشان داده شود — تعریف شده در step-definitions/common.steps.ts)

When(
  '{actor} تلاش می کند آنالیز استاندارد جدید برای محصول {string} ثبت کند',
  (actor: Actor, productName: string) => {
    const product = theProductRegisteredWithName(productName);
    return actor.attemptsTo(
      AttemptToRegisterStandardBomForProductViaApi(product),
    );
  },
);

Then('آنالیز استاندارد جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewStandardBomWasNotRegistered()),
);

When('{actor} تلاش می کند آنالیز استاندارد را ویرایش کند', (actor: Actor) =>
  actor.attemptsTo(
    EditStandardBom.viaApiUsing(theLastRegisteredStandardBom().id, {
      miCode: 'تلاش-بدون-دسترسی',
    }),
  ),
);

Then('آنالیز استاندارد ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureStandardBomWasNotEdited()),
);

When('{actor} تلاش می کند آنالیز استاندارد را حذف کند', (actor: Actor) =>
  actor.attemptsTo(
    DeleteStandardBom.viaApiUsing(theLastRegisteredStandardBom().id),
  ),
);

Then('آنالیز استاندارد از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureStandardBomWasNotDeleted()),
);

// قانون: وضعیت فعال بودن آنالیز استاندارد باید هنگام ثبت توسط کاربر مشخص شود

// This shared step also backs the "کد MI یکتا است"/"کد MI نمیتواند خالی باشد"/"برند نمیتواند خالی
// باشد"/"متراژ استاندارد نمیتواند خالی باشد" rules below — every one of their "اما ..." follow-ups
// still needs `active` explicitly selected for the form to be valid enough to reach *their own*
// target error, so each of those attempt tasks (register-standard-bom.ts) selects it itself, right
// before submitting. `active` starts `undefined` here — never selected during this shared entering
// step — because a `mat-select` can't be unselected once chosen: if this defaulted to `true` the
// way `RegisterStandardBom.using`'s own draft does, this rule's own negative example below could
// never leave it unspecified.
When(
  '{actor} اطلاعات آنالیز استاندارد جدید برای محصول {string} وارد میکند',
  (actor: Actor, productName: string) => {
    const product = theProductRegisteredWithName(productName);
    const details: NewStandardBomDetails = {
      productId: product.id,
      productName: product.name,
      miCode: freshMiCode(),
      brand: freshBrand(),
      standardLength: freshStandardLength(),
      active: undefined,
      // The UI-driven draft never needs real master ids: the "new standard BOM" form is assumed
      // to clone the chosen product's own composition once it's selected — see
      // `register-standard-bom.ts#EnterNewStandardBomDetails`'s own comment.
      components: [],
    };
    rememberAttempt<NewStandardBomDetails>(details);
    return actor.attemptsTo(EnterNewStandardBomDetails(product, details));
  },
);

When('وضعیت فعال بودن را مشخص نمی کند', () => {
  const changes: NewStandardBomDetails = {
    ...theAttempt<NewStandardBomDetails>(),
    active: undefined,
  };
  rememberAttempt<NewStandardBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterWithoutSpecifyingActive(),
  );
});

Then('پیغام خطای عدم تعیین وضعیت فعال بودن نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureActiveNotSpecifiedErrorShown()),
);

// قانون: کد MI یکتا است

Given(
  'اینکه یک آنالیز استاندارد با کد MI {string} در سیستم ثبت شده باشد',
  (miCode: string) => {
    const product = theLastRegisteredProduct();
    return actorInTheSpotlight().attemptsTo(
      RegisterStandardBomAndRememberIt(product, { miCode }),
    );
  },
);

When('کد MI را {string} وارد میکند', (miCode: string) => {
  const changes: NewStandardBomDetails = {
    ...theAttempt<NewStandardBomDetails>(),
    miCode,
  };
  rememberAttempt<NewStandardBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterWithMiCode(miCode));
});

Then('پیغام خطای کد MI تکراری نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateMiCodeErrorShown()),
);

// This Given (note the "در سیستم" this text carries, unlike the shorter one in
// step-definitions/common.steps.ts) backs "ویرایش با کد MI تکراری", "پاک کردن کد MI", "پاک کردن
// برند" and "پاک کردن متراژ استاندارد" below.
Given(
  'اینکه یک آنالیز استاندارد برای محصول {string} در سیستم ثبت شده باشد',
  (productName: string) => {
    const product = theProductRegisteredWithName(productName);
    return actorInTheSpotlight().attemptsTo(
      RegisterStandardBomAndRememberIt(product),
    );
  },
);

When('{actor} کد MI آن را به کدی تکراری تغییر می دهد', (actor: Actor) =>
  actor.attemptsTo(ChangeMiCodeToADuplicate()),
);

// قانون: کد MI نمیتواند خالی باشد

When('کد MI را خالی میگذارد', () => {
  const changes: NewStandardBomDetails = {
    ...theAttempt<NewStandardBomDetails>(),
    miCode: '',
  };
  rememberAttempt<NewStandardBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterLeavingMiCodeEmpty(),
  );
});

Then('پیغام خطای کد MI نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMiCodeErrorShown()),
);

When('{actor} کد MI آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(AttemptToClearMiCode(theLastRegisteredStandardBom().miCode)),
);

// قانون: برند نمیتواند خالی باشد

When('برند را خالی میگذارد', () => {
  const changes: NewStandardBomDetails = {
    ...theAttempt<NewStandardBomDetails>(),
    brand: '',
  };
  rememberAttempt<NewStandardBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingBrandEmpty());
});

Then('پیغام خطای برند نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureBrandErrorShown()),
);

When('{actor} برند آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(AttemptToClearBrand(theLastRegisteredStandardBom().miCode)),
);

// قانون: متراژ استاندارد نمیتواند خالی باشد

When('متراژ استاندارد را خالی میگذارد', () => {
  const changes: NewStandardBomDetails = {
    ...theAttempt<NewStandardBomDetails>(),
    standardLength: '',
  };
  rememberAttempt<NewStandardBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterLeavingStandardLengthEmpty(),
  );
});

Then('پیغام خطای متراژ استاندارد نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureStandardLengthErrorShown()),
);

When('{actor} متراژ استاندارد آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    AttemptToClearStandardLength(theLastRegisteredStandardBom().miCode),
  ),
);

// قانون: یک آنالیز استاندارد می تواند بیش از یک جز داشته باشد
//
// The Given ("اینکه یک آنالیز استاندارد برای محصول X ثبت شده باشد") registers a standard BOM for
// the background's single-component product; since a standard BOM's composition is cloned
// wholesale and can never grow a component afterwards, the When below registers a *second* standard
// BOM — for a fresh product built with several components — and that becomes "the last registered
// standard BOM" the Then checks. See RegisterStandardBomForProductWithMultipleComponents's own
// comment for the full reasoning.

When('{actor} چند جز برای آن آنالیز استاندارد ثبت می کند', (actor: Actor) =>
  actor.attemptsTo(RegisterStandardBomForProductWithMultipleComponents()),
);

Then('تمام اجزای ثبت شده به آنالیز استاندارد مربوط باشند', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureAllRegisteredComponentsBelongToStandardBom(
      theAttempt<NewComponentInProduct[]>().map((component) => component.name),
    ),
  ),
);

// قانون: یک جز می تواند بیش از یک مواد اولیه داشته باشد
//
// The When ("{actor} چند مواد اولیه برای آن جز ثبت می کند") and its Then ("تمام مواد اولیه ثبت شده
// به جز مربوط باشند") are defined in step-definitions/bom-registration/common.steps.ts, shared
// byte-for-byte with registring-product.feature's own rule of the same name — see
// screenplay/common/composition-context.ts for why.

Given('اینکه یک جز برای یک آنالیز استاندارد در سیستم ثبت شده باشد', () => {
  setCurrentComponentOwner('standard-bom');
  const product = theLastRegisteredProduct();
  return actorInTheSpotlight().attemptsTo(
    RegisterStandardBomAndRememberIt(product),
  );
});

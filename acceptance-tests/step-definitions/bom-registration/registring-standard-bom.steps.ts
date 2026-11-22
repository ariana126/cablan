import { DataTable, Given, When, Then } from '@cucumber/cucumber';
import {
  Actor,
  actorCalled,
  actorInTheSpotlight,
  Task,
} from '@serenity-js/core';
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
import { freshOrderNumber } from '../../screenplay/bom-registration/bom-details';
import {
  AttemptToRegisterLeavingBrandEmpty,
  AttemptToRegisterLeavingMiCodeEmpty,
  AttemptToRegisterLeavingStandardLengthEmpty,
  AttemptToRegisterStandardBomForProductViaApi,
  AttemptToRegisterWithMiCode,
  AttemptToRegisterWithoutSpecifyingActive,
  EnsureNewStandardBomWasNotRegistered,
  EnsureStandardBomWasRegistered,
  EnsureStandardBomWasStoredWithMiCode,
  EnterNewStandardBomDetails,
  RegisterStandardBom,
  RegisterStandardBomAndRememberIt,
} from '../../screenplay/bom-registration/register-standard-bom';
import {
  EnsureActiveNotSpecifiedErrorShown,
  EnsureBrandErrorShown,
  EnsureDuplicateMiCodeErrorShown,
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
import { setCurrentEditTarget } from '../../screenplay/common/edit-target';
import {
  ChangeAStandardWeightOf,
  EnsureStandardBomIsRegistered,
  EnsureStandardBomIsUnchanged,
  NoteTheStandardBom,
  RegisterDailyBomOnStandardBom,
} from '../../screenplay/bom-registration/record-dependencies';
import {
  performAsAnObserverOtherThanTheActor,
  performAsTheSystemAdmin,
} from '../../screenplay/common/observer';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { EnsureToldTheRecordIsUsedIn } from '../../screenplay/common/record-dependents';
import { theMiCodeErrorIsAbout } from '../../screenplay/common/mi-code-error-context';
import { EnsureNoDailyBomIsOnStandardBom } from '../../screenplay/bom-registration/daily-bom-order';
import {
  AttemptToChangeTheMaterialsOfStandardBom,
  CORRECTABLE_STANDARD_BOM_ITEMS,
  CorrectStandardBom,
  CorrectTheStandardBomItem,
  correctableItemFor,
  correctStandardBomAsAPrecondition,
  EnsureDailyBomShowsBrandAndStandardLength,
  EnsureOrderAndDailyBomStillHoldMiCode,
  EnsureStandardBomWasCorrected,
  RegisterStandardBomWithBrandAndStandardLength,
  RegisterStandardBomWithStandardWeight,
} from '../../screenplay/bom-registration/standard-bom-correction';
import {
  EnsureNoEditEventRecordedForTheNotedDailyBoms,
  EnsureTheStandardWeightCorrectionWasLogged,
  EnsureTheEarlierAuditEntriesAreUnchanged,
  EnsureTheReviewsOfTheNotedDailyBomsAreUnchanged,
  EnsureTheWeightsAndEditDetailsOfTheNotedDailyBomsAreUnchanged,
  NoteTheAuditLogBeforeTheCorrection,
  reviewedDailyBomsWereRegisteredOn,
} from '../../screenplay/bom-registration/standard-bom-correction-effects';

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
  setCurrentEditTarget('standard-bom');
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

// قانون: کد MI با رقم انگلیسی ثبت می شود، حتی اگر با رقم فارسی وارد شود
//
// Its scenario repeats the background's «اینکه محصول ... در سیستم ثبت شده باشد» and «مصطفی وارد
// سیستم شده باشد» — both idempotent (`step-definitions/common.steps.ts`). The When is active, so the
// form; the Then reads the stored MI code back over HTTP.

When(
  '{actor} آنالیز استاندارد جدیدی با کد MI {string} برای محصول {string} ثبت می کند',
  (actor: Actor, miCode: string, productName: string) => {
    const product = theProductRegisteredWithName(productName);
    const details: NewStandardBomDetails = {
      productId: product.id,
      productName: product.name,
      miCode,
      brand: freshBrand(),
      standardLength: freshStandardLength(),
      active: true,
      components: [],
    };
    rememberAttempt<NewStandardBomDetails>(details);
    return actor.attemptsTo(RegisterStandardBom.using(product, details));
  },
);

Then(
  'آنالیز استاندارد جدیدی با کد MI {string} ثبت شده باشد',
  (miCode: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureStandardBomWasStoredWithMiCode(
        theAttempt<NewStandardBomDetails>(),
        miCode,
      ),
    ),
);

// قانون: کد MI یکتا است
//
// «ثبت کد MI تکراری با رقم فارسی» reuses «کد MI را ... وارد میکند» with «۱۲۳۴»; its «ثبت نشده باشد»
// counts «۱۲۳۴» and «1234» as one MI code (`register-standard-bom.ts#sameMiCode`).

const aStandardBomIsRegisteredWithMiCode = (miCode: string) => {
  const product = theLastRegisteredProduct();
  return actorInTheSpotlight().attemptsTo(
    RegisterStandardBomAndRememberIt(product, { miCode }),
  );
};

Given(
  'اینکه یک آنالیز استاندارد با کد MI {string} در سیستم ثبت شده باشد',
  aStandardBomIsRegisteredWithMiCode,
);

// The same precondition as an «و» continuation, without «اینکه» — see the top of
// `step-definitions/common.steps.ts`.
Given(
  'یک آنالیز استاندارد با کد MI {string} در سیستم ثبت شده باشد',
  aStandardBomIsRegisteredWithMiCode,
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
  theMiCodeErrorIsAbout('standard-bom-form');
  const changes: NewStandardBomDetails = {
    ...theAttempt<NewStandardBomDetails>(),
    miCode: '',
  };
  rememberAttempt<NewStandardBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterLeavingMiCodeEmpty(),
  );
});

// «پیغام خطای کد MI نشان داده شود» is said in registring-bom too (issue #101), so it lives in
// step-definitions/bom-registration/common.steps.ts, dispatched on `common/mi-code-error-context.ts`,
// which the two steps here set to `standard-bom-form`.

When('{actor} کد MI آن را پاک می کند', (actor: Actor) => {
  theMiCodeErrorIsAbout('standard-bom-form');
  return actor.attemptsTo(
    AttemptToClearMiCode(theLastRegisteredStandardBom().miCode),
  );
});

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

// قانون: آنالیز استانداردی که بر اساس آن آنالیز روزانه ثبت شده باشد قابل حذف یا ویرایش نیست
// (issue #94)
//
// The deletion and the three edit attempts drive `/standard-boms` (a refusal leaves the dialog
// open, its alert saying where the standard BOM is used); the precondition and the facts go
// through the API as the system admin. Each edit notes the standard BOM first, so «… ویرایش نشده
// باشد» can say it is exactly as it was.

const aDailyBomIsRegisteredOn = (orderNumber: string, miCode: string) =>
  performAsTheSystemAdmin(RegisterDailyBomOnStandardBom(orderNumber, miCode));

Given(
  'اینکه آنالیز روزانه {string} با کد MI {string} ثبت شده باشد',
  aDailyBomIsRegisteredOn,
);

// The same precondition as an «و» continuation (issue #126's System Admin rule states it after an
// order or a standard BOM).
Given(
  'آنالیز روزانه {string} با کد MI {string} ثبت شده باشد',
  aDailyBomIsRegisteredOn,
);

When(
  '{actor} تلاش می کند آنالیز استاندارد {string} را حذف کند',
  (actor: Actor, miCode: string) => {
    triedThrough('browser');
    return actor.attemptsTo(DeleteStandardBom.using(miCode));
  },
);

Then('آنالیز استاندارد {string} از سیستم حذف نشده باشد', (miCode: string) =>
  performAsTheSystemAdmin(EnsureStandardBomIsRegistered(miCode)),
);

/** An edit attempt: the standard BOM noted first, then changed through the form. */
const triesToEditTheStandardBom = async (
  actor: Actor,
  miCode: string,
  edit: Task,
) => {
  await performAsTheSystemAdmin(NoteTheStandardBom(miCode));
  triedThrough('browser');
  return actor.attemptsTo(edit);
};

When(
  '{actor} تلاش می کند وزن های استاندارد آنالیز استاندارد {string} را تغییر دهد',
  (actor: Actor, miCode: string) =>
    triesToEditTheStandardBom(actor, miCode, ChangeAStandardWeightOf(miCode)),
);

When(
  '{actor} تلاش می کند کد MI آنالیز استاندارد {string} را تغییر دهد',
  (actor: Actor, miCode: string) =>
    triesToEditTheStandardBom(
      actor,
      miCode,
      EditStandardBom.using(miCode, { miCode: freshMiCode() }),
    ),
);

When(
  '{actor} تلاش می کند برند آنالیز استاندارد {string} را تغییر دهد',
  (actor: Actor, miCode: string) =>
    triesToEditTheStandardBom(
      actor,
      miCode,
      EditStandardBom.using(miCode, { brand: freshBrand() }),
    ),
);

// Read by an observer other than the actor: issue #126 has یاشار himself attempt over the API,
// and the «به او گفته شود …» that follows judges his last response.
Then('آنالیز استاندارد {string} ویرایش نشده باشد', (miCode: string) =>
  performAsAnObserverOtherThanTheActor(EnsureStandardBomIsUnchanged(miCode)),
);

// Also said by registring-order (issue #101) of an order's daily BOMs, after its «تلاش …» edits and
// deletes — made over the API, so read from the 409 (`refusal-door-context.ts`).
Then(
  'به او گفته شود که {string} در {int} آنالیز روزانه {string} استفاده شده است',
  (_subject: string, count: number, orderNumber: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({
        kind: 'daily-bom',
        count,
        name: orderNumber,
      }),
    ),
);

// قانون: مدیر کارخانه اطلاعات در حال استفاده را مانند مدیریت نمی تواند اصلاح کند (issue #130)
//
// The factory manager gets no System Admin exception: the issue #94 attempt above («… تلاش می کند
// برند آنالیز استاندارد … را تغییر دهد», through `/standard-boms`) is refused as Management's is.
// The precondition names no order, so the daily BOM gets a fresh one; the refusal is read where the
// attempt was made, naming the kind and the count only.

Given(
  'اینکه آنالیز روزانه ای بر اساس آنالیز استاندارد {string} ثبت شده باشد',
  (miCode: string) => aDailyBomIsRegisteredOn(freshOrderNumber(), miCode),
);

Then(
  'به او گفته شود که {string} در {int} آنالیز روزانه استفاده شده است',
  (_subject: string, count: number) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({ kind: 'daily-bom', count }),
    ),
);

// قانون: آنالیز استانداردی که کد MI آن به سفارشی تخصیص داده شده قابل حذف یا ویرایش نیست (issue #101)
//
// The attempts are the issue #94 rule's own (above), through `/standard-boms`; the order Given is
// step-definitions/common.steps.ts's, which registers MI-100's standard BOM unless it is. No daily
// BOM is ever registered here, so the only thing holding the standard BOM is the order.

Given(
  'هیچ آنالیز روزانه ای با کد MI {string} ثبت نشده باشد',
  (miCode: string) =>
    performAsTheSystemAdmin(EnsureNoDailyBomIsOnStandardBom(miCode)),
);

Then(
  'به او گفته شود که {string} در {int} سفارش {string} استفاده شده است',
  (_subject: string, count: number, orderNumber: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({ kind: 'order', count, name: orderNumber }),
    ),
);

// قانون: مدیر سیستم می تواند آنالیز استاندارد استفاده شده در سفارش یا آنالیز روزانه را، به جز کد MI و
// اجزا و مواد اولیه آن، اصلاح کند (issue #126)
//
// The two lock rules above now hold for everyone but this exception: their delete outlines run as
// مصطفی and یاشار alike through the steps above, and so does the System Admin's MI code attempt
// («یاشار تلاش می کند کد MI …», through the browser). The corrections are active — یاشار edits in
// `/standard-boms`' edit dialog, saved directly (no correction confirmation, unlike issue #110's). A
// composition change has no control on that page (a standard BOM's composition is cloned from its
// product), so the two composition attempts go over HTTP. Preconditions and facts are the API's.

/** «<مورد> آنالیز استاندارد …» — what the outline corrects, as the Gherkin names it. A regular
 * expression, since a Cucumber expression's alternation can't hold several words; its actor group
 * is written `[^\s"]+`, because `[؀-ۿ]+` is the source of both `{actor}` and `{actorName}` and
 * Cucumber refuses to choose between them. */
const CORRECTABLE_ITEM = `(${CORRECTABLE_STANDARD_BOM_ITEMS.join('|')})`;

When(
  new RegExp(
    `^([^\\s"]+) ${CORRECTABLE_ITEM} آنالیز استاندارد "([^"]*)" را اصلاح می کند$`,
  ),
  async (actorName: string, item: string, miCode: string) => {
    await performAsTheSystemAdmin(NoteTheStandardBom(miCode));
    return actorCalled(actorName).attemptsTo(
      CorrectTheStandardBomItem(miCode, correctableItemFor(item)),
    );
  },
);

Then(
  new RegExp(`^${CORRECTABLE_ITEM} آنالیز استاندارد "([^"]*)" اصلاح شده باشد$`),
  (_item: string, miCode: string) =>
    performAsTheSystemAdmin(EnsureStandardBomWasCorrected(miCode)),
);

Then(
  'سفارش {string} و آنالیز روزانه {string} همچنان با کد MI {string} باشند',
  (orderNumber: string, dailyBomOrderNumber: string, miCode: string) =>
    performAsTheSystemAdmin(
      EnsureOrderAndDailyBomStillHoldMiCode(
        orderNumber,
        dailyBomOrderNumber,
        miCode,
      ),
    ),
);

/** A composition attempt over HTTP: the standard BOM noted first, then the change sent. */
const triesToChangeTheMaterialsOf = async (
  actor: Actor,
  miCode: string,
  attempt: Task,
) => {
  await performAsTheSystemAdmin(NoteTheStandardBom(miCode));
  triedThrough('api');
  return actor.attemptsTo(attempt);
};

When(
  '{actor} تلاش می کند با اضافه کردن مواد اولیه به جز آنالیز استاندارد {string} را تغییر دهد',
  (actor: Actor, miCode: string) =>
    triesToChangeTheMaterialsOf(
      actor,
      miCode,
      AttemptToChangeTheMaterialsOfStandardBom.byAddingOne(miCode),
    ),
);

When(
  '{actor} تلاش می کند با حذف مواد اولیه از جز آنالیز استاندارد {string} را تغییر دهد',
  (actor: Actor, miCode: string) =>
    triesToChangeTheMaterialsOf(
      actor,
      miCode,
      AttemptToChangeTheMaterialsOfStandardBom.byRemovingOne(miCode),
    ),
);

// «آنالیز روزانه قبلی برند و متراژ استاندارد اصلاح شده را نشان می دهد»

Given(
  'اینکه آنالیز استاندارد {string} با برند {string} و متراژ استاندارد {string} ثبت شده باشد',
  (miCode: string, brand: string, standardLength: string) =>
    performAsTheSystemAdmin(
      RegisterStandardBomWithBrandAndStandardLength(
        miCode,
        brand,
        standardLength,
      ),
    ),
);

When(
  '{actor} برند و متراژ استاندارد آنالیز استاندارد {string} را به {string} و {string} اصلاح می کند',
  async (
    actor: Actor,
    miCode: string,
    brand: string,
    standardLength: string,
  ) => {
    await performAsTheSystemAdmin(NoteTheStandardBom(miCode));
    return actor.attemptsTo(
      CorrectStandardBom.using(miCode, {
        brand,
        standardLength: Number(standardLength),
      }),
    );
  },
);

Then(
  'آنالیز روزانه {string} برند {string} و متراژ استاندارد {string} داشته باشد',
  (orderNumber: string, brand: string, standardLength: string) =>
    performAsTheSystemAdmin(
      EnsureDailyBomShowsBrandAndStandardLength(
        orderNumber,
        brand,
        Number(standardLength),
      ),
    ),
);

// «غیرفعال کردن آنالیز استاندارد مانع ثبت آنالیز روزانه جدید با آن نمی شود» — its `When` and `Then`
// are registring-bom's («… آنالیز روزانه جدیدی برای سفارش … با کد MI … ثبت می کند», «آنالیز روزانه
// جدیدی ثبت شده باشد»).

Given(
  '{actorName} آنالیز استاندارد {string} را غیرفعال کرده باشد',
  (personaName: string, miCode: string) =>
    correctStandardBomAsAPrecondition(personaName, miCode, { active: false }),
);

// «اصلاح آنالیز استاندارد با مقادیر قبل و بعد در رویدادهای سیستم ثبت می شود», and the next rule's
// example, which shares its weight precondition and its `When`.

Given(
  'اینکه وزن استاندارد مواد اولیه {string} جز {string} آنالیز استاندارد {string} برابر {string} باشد',
  (
    materialName: string,
    componentName: string,
    miCode: string,
    weight: string,
  ) =>
    performAsTheSystemAdmin(
      RegisterStandardBomWithStandardWeight(miCode, {
        componentName,
        materialName,
        weight: Number(weight),
      }),
    ),
);

When(
  '{actor} وزن استاندارد مواد اولیه {string} جز {string} آنالیز استاندارد {string} را به {string} اصلاح می کند',
  async (
    actor: Actor,
    materialName: string,
    componentName: string,
    miCode: string,
    weight: string,
  ) => {
    await performAsTheSystemAdmin(
      NoteTheStandardBom(miCode),
      NoteTheAuditLogBeforeTheCorrection(),
    );
    return actor.attemptsTo(
      CorrectStandardBom.using(miCode, {
        weights: [{ componentName, materialName, weight: Number(weight) }],
      }),
    );
  },
);

Then(
  'رویداد ویرایش آنالیز استاندارد {string} توسط {actorName} با وزن قبلی {string} و وزن جدید {string} ثبت شده باشد',
  (
    miCode: string,
    personaName: string,
    previousWeight: string,
    newWeight: string,
  ) =>
    performAsTheSystemAdmin(
      EnsureTheStandardWeightCorrectionWasLogged(miCode, personaName, {
        previousWeight,
        newWeight,
      }),
    ),
);

Then('رویدادهای قبلی تغییر نکرده باشند', () =>
  performAsTheSystemAdmin(EnsureTheEarlierAuditEntriesAreUnchanged()),
);

// قانون: اصلاح آنالیز استاندارد توسط مدیر سیستم، تصمیم ها و اطلاعات ثبت شده آنالیز های روزانه قبلی را
// تغییر نمی دهد (issue #126)
//
// The daily BOMs are registered on the standard BOM and reviewed by مصطفی into each row's status,
// then noted as they are; the `Then`s compare `GET boms/:id` with that note.

Given(
  'آنالیز های روزانه زیر با کد MI {string} ثبت شده باشند:',
  (miCode: string, table: DataTable) =>
    reviewedDailyBomsWereRegisteredOn(
      miCode,
      table.hashes().map((row) => ({
        orderNumber: row['شماره سفارش'],
        status: row['وضعیت تایید'],
      })),
    ),
);

Then(
  'وضعیت تایید، تایید\\/رد کننده و توضیحات مدیریت هر سه آنالیز روزانه تغییر نکرده باشد',
  () =>
    performAsTheSystemAdmin(EnsureTheReviewsOfTheNotedDailyBomsAreUnchanged()),
);

Then(
  'وزن مواد اولیه و جزئیات ویرایش هر سه آنالیز روزانه تغییر نکرده باشد',
  () =>
    performAsTheSystemAdmin(
      EnsureTheWeightsAndEditDetailsOfTheNotedDailyBomsAreUnchanged(),
    ),
);

Then('هیچ رویداد ویرایشی برای آن آنالیز های روزانه ثبت نشده باشد', () =>
  performAsTheSystemAdmin(EnsureNoEditEventRecordedForTheNotedDailyBoms()),
);

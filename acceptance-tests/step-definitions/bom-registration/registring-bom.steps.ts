import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  freshProductDetails,
  theLastRegisteredProduct,
} from '../../screenplay/bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../../screenplay/bom-registration/register-product';
import { LogInAsPersona } from '../../screenplay/common/personas';
import { RegisterStandardBomAndRememberIt } from '../../screenplay/bom-registration/register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from '../../screenplay/bom-registration/standard-bom-details';
import {
  NewBomDetails,
  freshBomDetailsFor,
  freshOrderNumber,
  rememberAttempt,
  theAttempt,
  theLastRegisteredBom,
} from '../../screenplay/bom-registration/bom-details';
import {
  AttemptToRegisterBomForMiCodeViaApi,
  AttemptToRegisterLeavingAllMaterialWeightsEmpty,
  AttemptToRegisterLeavingOrderNumberEmpty,
  AttemptToRegisterLeavingTrackingNumberEmpty,
  AttemptToRegisterWithAllMaterialWeightsZero,
  EnsureBomWasRegistered,
  EnsureNewBomWasNotRegistered,
  EnterNewBomDetails,
  RegisterBom,
  RegisterBomAndRememberIt,
} from '../../screenplay/bom-registration/register-bom';
import {
  EnsureInvalidMaterialWeightErrorShown,
  EnsureOrderNumberErrorShown,
  EnsureTrackingNumberErrorShown,
} from '../../screenplay/bom-registration/bom-form';
import {
  AttemptToClearDescription,
  AttemptToClearOrderNumber,
  AttemptToClearTrackingNumber,
  AttemptToClearWeightOfOneMaterial,
  AttemptToZeroWeightOfOneMaterial,
  EditBom,
  EnsureBomWasEditedWith,
  EnsureBomWasNotEdited,
} from '../../screenplay/bom-registration/edit-bom';
import {
  DeleteBom,
  EnsureBomWasDeleted,
  EnsureBomWasNotDeleted,
} from '../../screenplay/bom-registration/delete-bom';
import { setCurrentEditTarget } from '../../screenplay/common/edit-target';

// پیش زمینه
//
// The very first line — running before either background line that names an actor — so there's
// nobody in the spotlight yet to act as. یاشار (the one persona the backend seeds on startup —
// `screenplay/common/personas.ts`) registers a fresh product and a standard BOM for it instead, the
// same way `step-definitions/common.steps.ts`'s own "اینکه محصول ... ثبت شده باشد" Given already
// borrows یاشار's own actor object for test-data setup that has to happen before the scenario's real
// actor is known. Written as sequential `await`s rather than one `actor.attemptsTo(...)` list,
// because the standard BOM registration needs `theLastRegisteredProduct()`, which is only valid
// once the product registration has actually finished performing — a `Task.where(...)` argument
// list is evaluated eagerly, before either task has run (see
// `screenplay/bom-registration/edit-standard-bom.ts#SequentiallyDependentTask`'s own comment on
// exactly this problem).
Given(
  'اینکه آنالیز استانداردی با کد MI {string} در سیستم ثبت شده باشد',
  async (miCode: string) => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));
    await admin.attemptsTo(RegisterProductAndRememberIt(freshProductDetails()));
    await admin.attemptsTo(
      RegisterStandardBomAndRememberIt(theLastRegisteredProduct(), {
        miCode,
      }),
    );
  },
);

// سناریو: ثبت آنالیز روزانه جدید

When(
  '{actor} آنالیز روزانه جدید برای کد MI {string} ثبت می کند',
  (actor: Actor, miCode: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    // The UI-driven draft never needs real master ids: the "new daily BOM" form is assumed to
    // clone the chosen standard BOM's own composition once it's selected — see
    // `register-bom.ts#EnterNewBomDetails`'s own comment.
    const details = freshBomDetailsFor(standardBom, []);
    rememberAttempt<NewBomDetails>(details);
    return actor.attemptsTo(RegisterBom.using(standardBom, details));
  },
);

Then('آنالیز روزانه جدیدی ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureBomWasRegistered(theAttempt<NewBomDetails>().orderNumber),
  ),
);

// سناریو: ویرایش آنالیز روزانه
//
// This Given ("اینکه یک آنالیز روزانه برای کد MI ... در سیستم ثبت شده باشد") is shared,
// byte-for-byte, by every other scenario/example below that also needs a pre-existing daily BOM to
// act on (delete, both access-denied edit/delete examples, and every "پاک کردن"/"صفر" example).

Given(
  'اینکه یک آنالیز روزانه برای کد MI {string} در سیستم ثبت شده باشد',
  (miCode: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    return actorInTheSpotlight().attemptsTo(
      RegisterBomAndRememberIt(standardBom),
    );
  },
);

When('{actor} آن را ویرایش می کند', (actor: Actor) => {
  setCurrentEditTarget('bom');
  const target = theLastRegisteredBom();
  const changes: Partial<NewBomDetails> = { orderNumber: freshOrderNumber() };
  rememberAttempt<Partial<NewBomDetails>>(changes);
  return actor.attemptsTo(EditBom.using(target.orderNumber, changes));
});

// "اطلاعات ویرایش شده در سیستم ثبت شده باشد" is defined in
// step-definitions/bom-registration/common.steps.ts (shared, byte-for-byte, with
// registring-standard-bom.feature's own "ویرایش آنالیز استاندارد" scenario — dispatches on
// `screenplay/common/edit-target.ts`'s `currentEditTarget()`, set above).

// سناریو: حذف آنالیز روزانه

When('{actor} آن را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(DeleteBom.using(theLastRegisteredBom().orderNumber)),
);

Then('آن آنالیز روزانه از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureBomWasDeleted()),
);

// قانون: فقط بازرس کنترل کیفیت، مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف آنالیز روزانه هستند
// (پیغام خطای عدم دسترسی نشان داده شود — تعریف شده در step-definitions/common.steps.ts)

When(
  '{actor} تلاش می کند آنالیز روزانه جدید برای کد MI {string} ثبت کند',
  (actor: Actor, miCode: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    return actor.attemptsTo(AttemptToRegisterBomForMiCodeViaApi(standardBom));
  },
);

Then('آنالیز روزانه جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewBomWasNotRegistered()),
);

When('{actor} تلاش می کند آن را ویرایش کند', (actor: Actor) =>
  actor.attemptsTo(
    EditBom.viaApiUsing(theLastRegisteredBom().id, {
      orderNumber: 'تلاش-بدون-دسترسی',
    }),
  ),
);

Then('آنالیز روزانه ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureBomWasNotEdited()),
);

When('{actor} تلاش می کند آن را حذف کند', (actor: Actor) =>
  actor.attemptsTo(DeleteBom.viaApiUsing(theLastRegisteredBom().id)),
);

Then('آن آنالیز روزانه از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureBomWasNotDeleted()),
);

// قانون: یک آنالیز روزانه باید شماره سفارش داشته باشد

When(
  '{actor} اطلاعات آنالیز جدید برای کد MI {string} وارد میکند',
  (actor: Actor, miCode: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    const details = freshBomDetailsFor(standardBom, []);
    rememberAttempt<NewBomDetails>(details);
    return actor.attemptsTo(EnterNewBomDetails(standardBom, details));
  },
);

When('شماره سفارش را خالی میگذارد', () => {
  const changes: NewBomDetails = {
    ...theAttempt<NewBomDetails>(),
    orderNumber: '',
  };
  rememberAttempt<NewBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterLeavingOrderNumberEmpty(),
  );
});

Then('آنالیز جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewBomWasNotRegistered()),
);

Then('پیغام خطای شماره سفارش نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureOrderNumberErrorShown()),
);

When('{actor} شماره شفارش آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    AttemptToClearOrderNumber(theLastRegisteredBom().orderNumber),
  ),
);

// قانون: یک آنالیز روزانه باید شماره ردیابی داشته باشد
//
// This When ("{actor} اطلاعات آنالیز روزانه جدید برای کد MI ... وارد میکند") is shared,
// byte-for-byte, with both material-weight rules below.

When(
  '{actor} اطلاعات آنالیز روزانه جدید برای کد MI {string} وارد میکند',
  (actor: Actor, miCode: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    const details = freshBomDetailsFor(standardBom, []);
    rememberAttempt<NewBomDetails>(details);
    return actor.attemptsTo(EnterNewBomDetails(standardBom, details));
  },
);

When('شماره ردیابی را خالی میگذارد', () => {
  const changes: NewBomDetails = {
    ...theAttempt<NewBomDetails>(),
    trackingNumber: '',
  };
  rememberAttempt<NewBomDetails>(changes);
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterLeavingTrackingNumberEmpty(),
  );
});

Then('پیغام خطای شماره ردیابی نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureTrackingNumberErrorShown()),
);

When('{actor} شماره ردیابی آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    AttemptToClearTrackingNumber(theLastRegisteredBom().orderNumber),
  ),
);

// قانون: وزن مواد اولیه نمیتواند ثبت نشود

When('وزن هر یک از مواد اولیه ها را خالی میگذارد', () => {
  const attempted = theAttempt<NewBomDetails>();
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterLeavingAllMaterialWeightsEmpty({
      id: attempted.standardBomId,
      miCode: attempted.standardBomMiCode,
    }),
  );
});

Then('پیغام خطای وزن مواد اولیه نامعتبر نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureInvalidMaterialWeightErrorShown()),
);

When('{actor} وزن یکی از مواد اولیه آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    AttemptToClearWeightOfOneMaterial(theLastRegisteredBom().orderNumber),
  ),
);

Then('پیغام خطای وزن مواد اولیه نامعتبر داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureInvalidMaterialWeightErrorShown()),
);

// قانون: وزن مواد اولیه نمیتواند صفر باشد

When('وزن هر یک از مواد اولیه ها را صفر میگذارد', () => {
  const attempted = theAttempt<NewBomDetails>();
  return actorInTheSpotlight().attemptsTo(
    AttemptToRegisterWithAllMaterialWeightsZero({
      id: attempted.standardBomId,
      miCode: attempted.standardBomMiCode,
    }),
  );
});

When('{actor} وزن یکی از مواد اولیه آن را صفر می کند', (actor: Actor) =>
  actor.attemptsTo(
    AttemptToZeroWeightOfOneMaterial(theLastRegisteredBom().orderNumber),
  ),
);

// قانون: یک آنالیز میتواند توضیحات نداشته باشد

When('توضیحات را خالی میگذراد', () => {
  // No-op: the preceding "ثبت می کند" step (shared with the top-level scenario) already
  // registered the daily BOM using `freshBomDetailsFor`'s defaults, which never set a description
  // unless explicitly overridden — there is nothing left here to leave empty.
});

Then('آنالیز جدیدی ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureBomWasRegistered(theAttempt<NewBomDetails>().orderNumber),
  ),
);

When('{actor} توضیحیات آن را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    AttemptToClearDescription(theLastRegisteredBom().orderNumber),
  ),
);

Then('آنالیز روزانه ویرایش شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureBomWasEditedWith({ description: '' })),
);

import { DataTable, Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  RegisterStandardBomWithMiCodeUnlessRegistered,
  RegisterStandardBomWithStandardWeights,
} from '../../screenplay/bom-registration/register-standard-bom';
import {
  ConfirmThePreview,
  EnsureBomUnchangedSinceRegistration,
  EnsurePreviewClosed,
  EnsurePreviewShows,
  EnsureRegisteredThenEditedInTheAuditLog,
  RegisterBomAndSeeItsPreview,
} from '../../screenplay/bom-registration/bom-preview';
import { LogInAsPersona, realNameFor } from '../../screenplay/common/personas';
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
  EnsureBomWasRegisteredFor,
  EnsureBomWasRegisteredWith,
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
  EnsureBomIsStoredWith,
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
// actor is known.
//
// Idempotent within a scenario: the Persian-digit rules' examples repeat this background line
// verbatim, and a second standard BOM with the same MI code would be refused as a duplicate. The
// precondition only has to be *true*, so the second call finds it already is and reuses it
// (`RegisterStandardBomWithMiCodeUnlessRegistered`).
Given(
  'اینکه آنالیز استانداردی با کد MI {string} در سیستم ثبت شده باشد',
  async (miCode: string) => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));
    await admin.attemptsTo(
      RegisterStandardBomWithMiCodeUnlessRegistered(miCode),
    );
  },
);

// سناریو: ثبت آنالیز روزانه جدید
//
// Also «ثبت آنالیز روزانه برای کد MI وارد شده با رقم فارسی»: the MI code is typed as given
// («۰۰۰۱»), and the standard BOM it means is the one registered as «0001» —
// `theStandardBomRegisteredWithMiCode` treats the two as one value.

When(
  '{actor} آنالیز روزانه جدید برای کد MI {string} ثبت می کند',
  (actor: Actor, miCode: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    // The UI-driven draft never needs real master ids: the "new daily BOM" form is assumed to
    // clone the chosen standard BOM's own composition once it's selected — see
    // `register-bom.ts#EnterNewBomDetails`'s own comment.
    const details = freshBomDetailsFor(standardBom, []);
    rememberAttempt<NewBomDetails>(details);
    return actor.attemptsTo(
      RegisterBom.using(standardBom, details, undefined, miCode),
    );
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

const aDailyBomIsRegisteredFor = (miCode: string) => {
  const standardBom = theStandardBomRegisteredWithMiCode(miCode);
  return actorInTheSpotlight().attemptsTo(
    RegisterBomAndRememberIt(standardBom),
  );
};

Given(
  'اینکه یک آنالیز روزانه برای کد MI {string} در سیستم ثبت شده باشد',
  aDailyBomIsRegisteredFor,
);

// The same precondition as an «و» continuation («ویرایش شماره سفارش با رقم فارسی»), which drops
// the «اینکه» — see the top of `step-definitions/common.steps.ts`.
Given(
  'یک آنالیز روزانه برای کد MI {string} در سیستم ثبت شده باشد',
  aDailyBomIsRegisteredFor,
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
    AttemptToClearWeightOfOneMaterial.using(theLastRegisteredBom().orderNumber),
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

// قانون: پس از ثبت آنالیز روزانه، پیش نمایش اختلاف وزن مواد اولیه آن با آنالیز استاندارد به کاربر
// نشان داده می شود
//
// Reused from above: "آنالیز روزانه جدیدی ثبت شده باشد", "آنالیز روزانه ویرایش نشده باشد" and
// "پیغام خطای وزن مواد اولیه نامعتبر نشان داده شود"; "اطلاعات ویرایش شده در سیستم ثبت شده باشد"
// lives in common.steps.ts.

// Runs after the background, so the actor in the spotlight is the background's نیکروش; borrowing
// یاشار moves it, and the active When that follows names its actor and takes it back.
Given(
  'اینکه آنالیز استاندارد زیر با وزن استاندارد مواد اولیه اش در سیستم ثبت شده باشد:',
  (table: DataTable) => {
    const rows = table.hashes();
    return actorCalled('یاشار').attemptsTo(
      RegisterStandardBomWithStandardWeights(
        rows[0]['کد MI'],
        rows.map((row) => ({
          componentName: row['نام جز'],
          materialName: row['نام مواد اولیه'],
          standardWeightInGrams: Number(row['وزن استاندارد مواد اولیه']),
        })),
      ),
    );
  },
);

When(
  '{actor} آنالیز روزانه زیر را برای کد MI {string} ثبت می کند:',
  (actor: Actor, miCode: string, table: DataTable) => {
    const rows = table.hashes();
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    const details = freshBomDetailsFor(standardBom, []);
    rememberAttempt<NewBomDetails>(details);
    return actor.attemptsTo(
      RegisterBom.using(standardBom, details, (componentName, materialName) => {
        const row = rows.find(
          (r) =>
            r['نام جز'] === componentName &&
            r['نام مواد اولیه'] === materialName,
        );
        if (!row) {
          throw new Error(
            `No weight given for ${componentName} / ${materialName}.`,
          );
        }
        return Number(row['وزن مواد اولیه']);
      }),
    );
  },
);

Then(
  'پیش نمایش اختلاف وزن زیر به {actor} نشان داده شود',
  (actor: Actor, table: DataTable) =>
    actor.attemptsTo(
      EnsurePreviewShows(
        table.hashes().map((row) => ({
          componentName: row['نام جز'],
          materialName: row['نام مواد اولیه'],
          weight: row['وزن مواد اولیه'],
          difference: row['اختلاف وزن'],
          direction: row['جهت اختلاف'],
        })),
      ),
    ),
);

// Shared with daily-bom-edit-details.feature, whose background registers neither a standard BOM with
// this MI code nor a session for the actor — so both are made true here first (each a no-op after
// this feature's own background), the standard BOM by یاشار without moving the spotlight.
Given(
  'اینکه {actor} آنالیز روزانه جدیدی برای کد MI {string} ثبت کرده و پیش نمایش آن به او نشان داده شده باشد',
  async (actor: Actor, miCode: string) => {
    await actorCalled('یاشار').attemptsTo(
      LogInAsPersona('یاشار'),
      RegisterStandardBomWithMiCodeUnlessRegistered(miCode),
    );
    const performer = actorCalled(actor.name);
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    const details = freshBomDetailsFor(standardBom, []);
    rememberAttempt<NewBomDetails>(details);
    return performer.attemptsTo(
      LogInAsPersona(actor.name),
      RegisterBomAndSeeItsPreview(standardBom, details),
    );
  },
);

When('{actor} پیش نمایش را تایید می کند', (actor: Actor) =>
  actor.attemptsTo(ConfirmThePreview()),
);

Then('پیش نمایش بسته شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsurePreviewClosed()),
);

Then('آنالیز روزانه بدون تغییر در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureBomUnchangedSinceRegistration()),
);

When(
  '{actor} از پیش نمایش آن آنالیز روزانه را ویرایش می کند',
  (actor: Actor) => {
    setCurrentEditTarget('bom');
    const changes: Partial<NewBomDetails> = { orderNumber: freshOrderNumber() };
    rememberAttempt<Partial<NewBomDetails>>(changes);
    return actor.attemptsTo(EditBom.fromThePreview(changes));
  },
);

// «… از پیش نمایش وزن یکی از مواد اولیه آن را با دلیل «…» تغییر می دهد» (daily-bom-edit-details.feature)
// is defined in daily-bom-edit-details.steps.ts; its «اطلاعات ویرایش شده در سیستم ثبت شده باشد» is
// the shared one in common.steps.ts, which this sets up the same way as the `When` above.

// Both events are the spotlight actor's (نیکروش registered and edited), but reading the audit log
// is the system admin's — یاشار, signed in by the background's first line.
Then(
  'رویداد ثبت و سپس رویداد ویرایش آن آنالیز روزانه در رویدادهای سیستم دیده شود',
  () => {
    const editor = actorInTheSpotlight().name;
    return actorCalled('یاشار').attemptsTo(
      EnsureRegisteredThenEditedInTheAuditLog(realNameFor(editor)),
    );
  },
);

When(
  '{actor} از پیش نمایش وزن یکی از مواد اولیه آن را پاک می کند',
  (actor: Actor) =>
    actor.attemptsTo(AttemptToClearWeightOfOneMaterial.fromThePreview()),
);

// قانون: رقم های شماره سفارش، شماره ردیابی و توضیحات آنالیز روزانه با رقم انگلیسی ثبت می شوند،
// حتی اگر با رقم فارسی وارد شوند
//
// The outline's «<فیلد>» expands to three different sentences, so each field gets its own pair of
// definitions over one shared implementation. The «ثبت می کند» is active — the form, typed as
// given; the «ثبت شده باشد» reads the stored value back from `GET boms`, so it proves what the
// system kept rather than what was typed (the preview dialog that a registration leaves open hides
// the list anyway — `acceptance-tests/CLAUDE.md`). «ثبت آنالیز روزانه با رقم انگلیسی» is the same
// pair with a Latin-digit value.

type TypedBomField = 'orderNumber' | 'trackingNumber' | 'description';

const registersADailyBomWith =
  (field: TypedBomField) => (actor: Actor, miCode: string, value: string) => {
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    const details = freshBomDetailsFor(standardBom, [], { [field]: value });
    rememberAttempt<NewBomDetails>(details);
    return actor.attemptsTo(RegisterBom.using(standardBom, details));
  };

const aDailyBomWasRegisteredWith = (field: TypedBomField) => (value: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureBomWasRegisteredWith(theAttempt<NewBomDetails>(), field, value),
  );

When(
  '{actor} آنالیز روزانه جدیدی برای کد MI {string} با شماره سفارش {string} ثبت می کند',
  registersADailyBomWith('orderNumber'),
);

When(
  '{actor} آنالیز روزانه جدیدی برای کد MI {string} با شماره ردیابی {string} ثبت می کند',
  registersADailyBomWith('trackingNumber'),
);

When(
  '{actor} آنالیز روزانه جدیدی برای کد MI {string} با توضیحات {string} ثبت می کند',
  registersADailyBomWith('description'),
);

Then(
  'آنالیز روزانه جدیدی با شماره سفارش {string} در سیستم ثبت شده باشد',
  aDailyBomWasRegisteredWith('orderNumber'),
);

Then(
  'آنالیز روزانه جدیدی با شماره ردیابی {string} در سیستم ثبت شده باشد',
  aDailyBomWasRegisteredWith('trackingNumber'),
);

Then(
  'آنالیز روزانه جدیدی با توضیحات {string} در سیستم ثبت شده باشد',
  aDailyBomWasRegisteredWith('description'),
);

// «ویرایش شماره سفارش با رقم فارسی» — its «و یک آنالیز روزانه ...» Given is defined above.

When(
  '{actor} شماره سفارش آن را به {string} تغییر می دهد',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(
      EditBom.using(theLastRegisteredBom().orderNumber, { orderNumber }),
    ),
);

Then(
  'آنالیز روزانه با شماره سفارش {string} در سیستم ثبت شده باشد',
  (orderNumber: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureBomIsStoredWith(theLastRegisteredBom(), { orderNumber }),
    ),
);

// قانون: کد MI وارد شده با رقم فارسی، همان کد MI با رقم انگلیسی است
// («... آنالیز روزانه جدید برای کد MI ... ثبت می کند» is the top-level scenario's When, above.)

Then('آنالیز روزانه جدیدی برای کد MI {string} ثبت شده باشد', (miCode: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureBomWasRegisteredFor(
      theStandardBomRegisteredWithMiCode(miCode),
      theAttempt<NewBomDetails>().orderNumber,
    ),
  ),
);

import { Before, DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  rejectDailyBomAsAPrecondition,
  thatDailyBom,
} from '../../screenplay/bom-analyzing/daily-bom-approval';
import {
  AttemptToResampleDailyBom,
  AttemptToResampleTheSameDailyBomAgain,
  EnsureANewDailyBomWasRegisteredFor,
  EnsureANewDailyBomWasRegisteredWith,
  EnsureNoNewDailyBomWasRegisteredFor,
  EnsurePreviousDailyBomStatusIs,
  EnsureResamplingOfferedOnlyFor,
  FinishResamplingLeavingDescriptionEmpty,
  FinishResamplingWithOneWeight,
  forgetEveryKnownDailyBom,
  ordinalFor,
  registerDailyBomOfTrackingNumberAsAPrecondition,
  registerDailyBomsOfTrackingNumberInOrderAsAPrecondition,
  resampleDailyBomAsAPrecondition,
  ResampleDailyBom,
  ViewDailyBomsOfTrackingNumber,
} from '../../screenplay/bom-analyzing/resampling-bom';

// resampling-bom.feature — «نمونه گیری مجدد». Door split (acceptance-tests/CLAUDE.md's table):
// the active «… نمونه گیری مجدد می کند» and «… را مشاهده می کند» drive the browser; the passive
// Givens and the refused «تلاش می کند …» attempts go through the API; the outcome `Then`s read the
// API (`POST boms/report`, `GET boms/:id`). See `screenplay/bom-analyzing/resampling-bom.ts`.
//
// Defined elsewhere, reused verbatim:
// - «اینکه آنالیز استانداردی با کد MI … در سیستم ثبت شده باشد» —
//   step-definitions/bom-registration/registring-bom.steps.ts.
// - «آنالیز روزانه با شماره سفارش … توسط … با دلیل … عدم تایید شده باشد», «{actor} وارد سیستم شده
//   باشد», «اینکه {actor} وارد سیستم شده باشد», «پیغام خطای عدم دسترسی نشان داده شود» —
//   step-definitions/common.steps.ts.
// - «وضعیت آن آنالیز روزانه … باشد» — step-definitions/bom-analyzing/approving-bom.steps.ts; «آن»
//   is the daily BOM `EnsureANewDailyBomWasRegisteredFor` brings into focus.
// - «پیغام خطای وزن مواد اولیه نامعتبر نشان داده شود» —
//   step-definitions/bom-registration/registring-bom.steps.ts.

/**
 * The «اما …» steps that change what the preceding «… نمونه گیری مجدد می کند» submits. Cucumber
 * runs that `When` before it can know an «اما» follows, and the Gherkin uses the one sentence both
 * alone (resample and submit) and amended (resample, but with a weight left empty). So the `When`
 * looks ahead: when the scenario carries one of these, it fills the form in and leaves submitting
 * to the amending step.
 */
const AMENDING_STEPS: readonly RegExp[] = [
  /^وزن یکی از مواد اولیه را .+ میگذارد$/,
  /^توضیحات را خالی میگذارد$/,
];

let resamplingIsAmendedByALaterStep = false;

Before(({ pickle }) => {
  forgetEveryKnownDailyBom();
  resamplingIsAmendedByALaterStep = pickle.steps.some((step) =>
    AMENDING_STEPS.some((pattern) => pattern.test(step.text)),
  );
});

const resamples = (actor: Actor, trackingNumber: string) =>
  actor.attemptsTo(
    resamplingIsAmendedByALaterStep
      ? ResampleDailyBom.withoutSubmittingUsing(trackingNumber)
      : ResampleDailyBom.using(trackingNumber),
  );

// پیش زمینه

Given(
  'آنالیز روزانه ای با شماره سفارش {string} و شماره ردیابی {string} برای کد MI {string} در سیستم ثبت شده باشد',
  (orderNumber: string, trackingNumber: string, miCode: string) =>
    registerDailyBomOfTrackingNumberAsAPrecondition(
      orderNumber,
      trackingNumber,
      miCode,
    ),
);

// سناریو: نمونه گیری مجدد از آنالیز روزانه عدم تایید

When(
  '{actor} از آنالیز روزانه عدم تایید شماره ردیابی {string} نمونه گیری مجدد می کند',
  resamples,
);

Then(
  'آنالیز روزانه جدیدی برای شماره ردیابی {string} ثبت شده باشد',
  (trackingNumber: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureANewDailyBomWasRegisteredFor(trackingNumber),
    ),
);

Then(
  'وضعیت آنالیز روزانه قبلی شماره ردیابی {string} {string} باقی بماند',
  (trackingNumber: string, status: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsurePreviousDailyBomStatusIs(trackingNumber, status),
    ),
);

// قانون: آنالیز نمونه گیری مجدد همان شماره سفارش، شماره ردیابی و کد MI آنالیز عدم تایید را دارد

Then('آنالیز روزانه جدیدی با اطلاعات زیر ثبت شده باشد', (table: DataTable) => {
  const [row] = table.hashes();
  return actorInTheSpotlight().attemptsTo(
    EnsureANewDailyBomWasRegisteredWith({
      orderNumber: row['شماره سفارش'],
      trackingNumber: row['شماره ردیابی'],
      miCode: row['کد MI'],
    }),
  );
});

// قانون: نمونه گیری مجدد فقط برای آخرین آنالیز روزانه یک شماره ردیابی ممکن است

Given(
  'اینکه آنالیز های روزانه شماره ردیابی {string} به ترتیب ثبت با وضعیت های {string} در سیستم ثبت شده باشند',
  (trackingNumber: string, statusesCsv: string) =>
    registerDailyBomsOfTrackingNumberInOrderAsAPrecondition(
      trackingNumber,
      statusesCsv.split(',').map((status) => status.trim()),
    ),
);

When(
  '{actor} آنالیز های روزانه شماره ردیابی {string} را مشاهده می کند',
  (actor: Actor, trackingNumber: string) =>
    actor.attemptsTo(ViewDailyBomsOfTrackingNumber.using(trackingNumber)),
);

Then(
  'نمونه گیری مجدد فقط برای آنالیز روزانه {string} ممکن باشد',
  (ordinal: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureResamplingOfferedOnlyFor(ordinalFor(ordinal)),
    ),
);

Given(
  'اینکه {actor} از آنالیز روزانه عدم تایید شماره ردیابی {string} نمونه گیری مجدد کرده باشد',
  (actor: Actor, trackingNumber: string) =>
    resampleDailyBomAsAPrecondition(actor, trackingNumber),
);

When(
  '{actor} تلاش می کند دوباره از همان آنالیز روزانه عدم تایید نمونه گیری مجدد کند',
  (actor: Actor) =>
    actor.attemptsTo(AttemptToResampleTheSameDailyBomAgain.viaApi()),
);

Then(
  'آنالیز روزانه جدید دیگری برای شماره ردیابی {string} ثبت نشده باشد',
  (trackingNumber: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureNoNewDailyBomWasRegisteredFor(trackingNumber),
    ),
);

// «آن آنالیز روزانه جدید» is the one the resampling precondition just registered, which it left
// in focus.
Given(
  'آن آنالیز روزانه جدید توسط {actorName} با دلیل {string} عدم تایید شده باشد',
  (reviewerName: string, reason: string) =>
    rejectDailyBomAsAPrecondition(thatDailyBom(), reviewerName, reason),
);

When(
  '{actor} از آخرین آنالیز روزانه عدم تایید شماره ردیابی {string} نمونه گیری مجدد می کند',
  resamples,
);

// قانون: آنالیز نمونه گیری مجدد همان قوانین آنالیز روزانه را دارد

When('وزن یکی از مواد اولیه را خالی میگذارد', () =>
  actorInTheSpotlight().attemptsTo(FinishResamplingWithOneWeight('')),
);

When('وزن یکی از مواد اولیه را صفر میگذارد', () =>
  actorInTheSpotlight().attemptsTo(FinishResamplingWithOneWeight('0')),
);

Then(
  'آنالیز روزانه جدیدی برای شماره ردیابی {string} ثبت نشده باشد',
  (trackingNumber: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureNoNewDailyBomWasRegisteredFor(trackingNumber),
    ),
);

When('توضیحات را خالی میگذارد', () =>
  actorInTheSpotlight().attemptsTo(FinishResamplingLeavingDescriptionEmpty()),
);

// قانون: فقط بازرس کنترل کیفیت، مدیریت و مدیر سیستم مجاز به نمونه گیری مجدد هستند

When(
  '{actor} تلاش می کند از آنالیز روزانه عدم تایید شماره ردیابی {string} نمونه گیری مجدد کند',
  (actor: Actor, trackingNumber: string) =>
    actor.attemptsTo(AttemptToResampleDailyBom.viaApi(trackingNumber)),
);

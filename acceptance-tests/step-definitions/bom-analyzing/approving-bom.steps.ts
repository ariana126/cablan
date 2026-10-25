import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  A_REASON_OF_SPACES_ONLY,
  ApproveDailyBom,
  AttemptToApproveDailyBom,
  AttemptToClearOrderNumberOfDailyBom,
  AttemptToRejectDailyBom,
  changeMaterialWeightsAsAPrecondition,
  CorrectAndApproveDailyBom,
  EditDailyBom,
  editDailyBomAsAPrecondition,
  EnsureApprovalStatusIs,
  EnsureManagementNoteIs,
  EnsureNoManagementNote,
  EnsureNoReviewer,
  EnsureReviewedBy,
  EnsureToldARejectionReasonIsRequired,
  EnsureToldTheDailyBomMustBeEditedFirst,
  ensureMaterialWeightsAsAPrecondition,
  MaterialWeightChange,
  NO_REASON,
  RegisterNewDailyBom,
  registerDailyBomToApprove,
  RejectDailyBom,
  thatDailyBom,
  theDailyBomWithOrderNumber,
} from '../../screenplay/bom-analyzing/daily-bom-approval';

// approving-bom.feature — every step goes through the API; see `daily-bom-approval.ts`'s module
// comment for why, and for how "آن آنالیز روزانه" is resolved.
//
// Defined elsewhere, shared with other features:
// - "اینکه {actor} وارد سیستم شده باشد" / "{actor} وارد سیستم شده باشد", and
//   "پیغام خطای عدم دسترسی نشان داده شود" — step-definitions/common.steps.ts.
// - "اینکه آنالیز روزانه با شماره سفارش ... توسط ... تایید شده باشد" and "... توسط ... با دلیل ...
//   عدم تایید شده باشد" — also step-definitions/common.steps.ts (bom-dashboard and both
//   bom-reporting features use them too).
// - "«...» وزن مواد اولیه «...» جز «...» آن را به «...» تغییر داده و سپس آن را تایید کرده باشد" —
//   step-definitions/common.steps.ts (viewing-audit-log uses it too).

/** A «نام جز | نام مواد اولیه | وزن مواد اولیه» table, as weight changes. */
const weightsFrom = (table: DataTable): MaterialWeightChange[] =>
  table.hashes().map((row) => ({
    componentName: row['نام جز'],
    materialName: row['نام مواد اولیه'],
    weight: Number(row['وزن مواد اولیه']),
  }));

/** A one-column «توضیحات مدیریت» table, as the note's lines in order. */
const noteLinesFrom = (table: DataTable): string[] =>
  table.hashes().map((row) => row['توضیحات مدیریت']);

Given(
  'اینکه آنالیز روزانه ای با شماره سفارش {string} در سیستم ثبت شده باشد',
  (orderNumber: string) => registerDailyBomToApprove(orderNumber),
);

Given(
  'اینکه آنالیز روزانه با شماره سفارش {string} با وزن مواد اولیه زیر در سیستم ثبت شده باشد',
  (orderNumber: string, table: DataTable) =>
    ensureMaterialWeightsAsAPrecondition(
      theDailyBomWithOrderNumber(orderNumber),
      weightsFrom(table),
    ),
);

Given(
  'اینکه وزن مواد اولیه {string} جز {string} در آنالیز روزانه با شماره سفارش {string} برابر {string} باشد',
  (
    materialName: string,
    componentName: string,
    orderNumber: string,
    weight: string,
  ) =>
    ensureMaterialWeightsAsAPrecondition(
      theDailyBomWithOrderNumber(orderNumber),
      [{ componentName, materialName, weight: Number(weight) }],
    ),
);

Given(
  '{actorName} وزن مواد اولیه {string} جز {string} آن را به {string} تغییر داده باشد',
  (
    editorName: string,
    materialName: string,
    componentName: string,
    weight: string,
  ) =>
    changeMaterialWeightsAsAPrecondition(thatDailyBom(), editorName, [
      { componentName, materialName, weight: Number(weight) },
    ]),
);

Given('پس از آن توسط {actorName} ویرایش شده باشد', (editorName: string) =>
  editDailyBomAsAPrecondition(thatDailyBom(), editorName),
);

When(
  '{actor} آنالیز روزانه با شماره سفارش {string} را تایید می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(
      ApproveDailyBom.viaApi(theDailyBomWithOrderNumber(orderNumber)),
    ),
);

When('{actor} آن آنالیز روزانه را تایید می کند', (actor: Actor) =>
  actor.attemptsTo(ApproveDailyBom.viaApi(thatDailyBom())),
);

When(
  '{actor} تلاش می کند آنالیز روزانه با شماره سفارش {string} را تایید کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(
      AttemptToApproveDailyBom.viaApi(theDailyBomWithOrderNumber(orderNumber)),
    ),
);

When('{actor} تلاش می کند آن آنالیز روزانه را تایید کند', (actor: Actor) =>
  actor.attemptsTo(AttemptToApproveDailyBom.viaApi(thatDailyBom())),
);

When(
  '{actor} آنالیز روزانه با شماره سفارش {string} را با دلیل {string} عدم تایید می کند',
  (actor: Actor, orderNumber: string, reason: string) =>
    actor.attemptsTo(
      RejectDailyBom.viaApi(theDailyBomWithOrderNumber(orderNumber), reason),
    ),
);

When(
  '{actor} تلاش می کند آنالیز روزانه با شماره سفارش {string} را با دلیل {string} عدم تایید کند',
  (actor: Actor, orderNumber: string, reason: string) =>
    actor.attemptsTo(
      AttemptToRejectDailyBom.viaApi(
        theDailyBomWithOrderNumber(orderNumber),
        reason,
      ),
    ),
);

When(
  '{actor} تلاش می کند آنالیز روزانه با شماره سفارش {string} را بدون نوشتن دلیل عدم تایید کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(
      AttemptToRejectDailyBom.viaApi(
        theDailyBomWithOrderNumber(orderNumber),
        NO_REASON,
      ),
    ),
);

When(
  '{actor} تلاش می کند آنالیز روزانه با شماره سفارش {string} را با دلیلی که فقط از فاصله تشکیل شده عدم تایید کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(
      AttemptToRejectDailyBom.viaApi(
        theDailyBomWithOrderNumber(orderNumber),
        A_REASON_OF_SPACES_ONLY,
      ),
    ),
);

When(
  '{actor} تلاش می کند آن آنالیز روزانه را با دلیل {string} عدم تایید کند',
  (actor: Actor, reason: string) =>
    actor.attemptsTo(AttemptToRejectDailyBom.viaApi(thatDailyBom(), reason)),
);

When(
  '{actor} آنالیز روزانه جدیدی با شماره سفارش {string} ثبت می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(RegisterNewDailyBom.viaApi(orderNumber)),
);

When('{actor} آن آنالیز روزانه را ویرایش می کند', (actor: Actor) =>
  actor.attemptsTo(EditDailyBom.viaApi(thatDailyBom())),
);

When('{actor} شماره سفارش آن آنالیز روزانه را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(AttemptToClearOrderNumberOfDailyBom.viaApi(thatDailyBom())),
);

When(
  '{actor} وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را به {string} تغییر می دهد و سپس آن را تایید می کند',
  (actor: Actor, materialName: string, componentName: string, weight: string) =>
    actor.attemptsTo(
      CorrectAndApproveDailyBom.viaApi(thatDailyBom(), [
        { componentName, materialName, weight: Number(weight) },
      ]),
    ),
);

When(
  '{actor} وزن مواد اولیه آن آنالیز روزانه را به صورت زیر تغییر می دهد و سپس آن را تایید می کند',
  (actor: Actor, table: DataTable) =>
    actor.attemptsTo(
      CorrectAndApproveDailyBom.viaApi(thatDailyBom(), weightsFrom(table)),
    ),
);

Then('وضعیت آن آنالیز روزانه {string} باشد', (status: string) =>
  actorInTheSpotlight().attemptsTo(EnsureApprovalStatusIs(status)),
);

Then('وضعیت آن آنالیز روزانه {string} باقی بماند', (status: string) =>
  actorInTheSpotlight().attemptsTo(EnsureApprovalStatusIs(status)),
);

Then('تایید\\/رد کننده آن {string} باشد', (reviewerName: string) =>
  actorInTheSpotlight().attemptsTo(EnsureReviewedBy(reviewerName)),
);

Then('تایید\\/رد کننده ای برای آن ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNoReviewer()),
);

Then('توضیحات مدیریت آن {string} باشد', (note: string) =>
  actorInTheSpotlight().attemptsTo(EnsureManagementNoteIs([note])),
);

Then('توضیحات مدیریت آن به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureManagementNoteIs(noteLinesFrom(table)),
  ),
);

Then('توضیحات مدیریت آن آنالیز روزانه به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureManagementNoteIs(noteLinesFrom(table)),
  ),
);

Then('توضیحات مدیریتی برای آن ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNoManagementNote()),
);

Then('به او گفته شود که نوشتن دلیل عدم تایید لازم است', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldARejectionReasonIsRequired()),
);

Then('به او گفته شود که آنالیز روزانه باید پیش از تغییر وضعیت ویرایش شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheDailyBomMustBeEditedFirst()),
);

import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  ApproveDailyBom,
  AttemptToApproveDailyBom,
  AttemptToClearOrderNumberOfDailyBom,
  AttemptToRevokeDailyBomApproval,
  EditDailyBom,
  editDailyBomAsAPrecondition,
  EnsureApprovalStatusIs,
  EnsureApprovedBy,
  EnsureNoApprover,
  RegisterNewDailyBom,
  registerDailyBomToApprove,
  RevokeDailyBomApproval,
  thatDailyBom,
  theDailyBomWithOrderNumber,
} from '../../screenplay/bom-analyzing/daily-bom-approval';

// approving-bom.feature — every step goes through the API; see `daily-bom-approval.ts`'s module
// comment for why, and for how "آن آنالیز روزانه" is resolved.
//
// Defined elsewhere, shared with other features:
// - "اینکه {actor} وارد سیستم شده باشد" / "{actor} وارد سیستم شده باشد", and
//   "پیغام خطای عدم دسترسی نشان داده شود" — step-definitions/common.steps.ts.
// - "اینکه آنالیز روزانه با شماره سفارش ... توسط ... تایید شده باشد" — also
//   step-definitions/common.steps.ts (bom-dashboard and both bom-reporting backgrounds use it too).

Given(
  'اینکه آنالیز روزانه ای با شماره سفارش {string} در سیستم ثبت شده باشد',
  (orderNumber: string) => registerDailyBomToApprove(orderNumber),
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

When('{actor} تایید آن آنالیز روزانه را لغو می کند', (actor: Actor) =>
  actor.attemptsTo(RevokeDailyBomApproval.viaApi(thatDailyBom())),
);

When('{actor} تلاش می کند تایید آن آنالیز روزانه را لغو کند', (actor: Actor) =>
  actor.attemptsTo(AttemptToRevokeDailyBomApproval.viaApi(thatDailyBom())),
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

Then('وضعیت آن آنالیز روزانه {string} باشد', (status: string) =>
  actorInTheSpotlight().attemptsTo(EnsureApprovalStatusIs(status)),
);

Then('وضعیت آن آنالیز روزانه {string} باقی بماند', (status: string) =>
  actorInTheSpotlight().attemptsTo(EnsureApprovalStatusIs(status)),
);

Then('تایید کننده آن {string} باشد', (approverName: string) =>
  actorInTheSpotlight().attemptsTo(EnsureApprovedBy(approverName)),
);

Then('تایید کننده ای برای آن ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNoApprover()),
);

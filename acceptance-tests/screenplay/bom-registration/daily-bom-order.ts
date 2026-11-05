import { d, Interaction, Question, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  Send,
} from '@serenity-js/rest';
import { performAsTheSystemAdmin } from '../common/observer';
import { withLatinDigits } from '../common/persian-digits';
import { EnsureProblemDetail } from '../common/problem-detail';
import {
  aCorrection,
  editIntentFields,
  ROUTINE_EDIT_REASON,
} from '../common/edit-reason';
import {
  approvalStatusFor,
  approveDailyBomAsAPrecondition,
  focusOnTheDailyBom,
  thatDailyBom,
} from '../bom-analyzing/daily-bom-approval';
import { RegisterStandardBomWithMiCodeUnlessRegistered } from './register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from './standard-bom-details';
import { RegisterBomAndRememberIt } from './register-bom';
import {
  freshWeightInGrams,
  RegisteredBom,
  theLastRegisteredBom,
} from './bom-details';
import { BomSummary, TheBomList, ViewBomList } from './view-bom-list';
import { StandardBomSummary } from './view-standard-bom-list';

/**
 * Issue #101 on the daily-BOM side: a daily BOM belongs to a defined order and carries one of that
 * order's MI codes — at registration, and through every later change of its MI code or order
 * number. Preconditions and facts go over the API as the System Admin; the registrations and edits
 * a scenario demonstrates go through `/boms`' form (`register-bom.ts`, `edit-bom.ts`).
 */

/** `GET boms/:id` — the fields these rules are about. */
interface DailyBomDetail {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  standardBomId: string;
  standardBomMiCode: string;
  approvalStatus: string;
  components: {
    id: string;
    name: string;
    materials: { id: string; name: string; weight: number }[];
  }[];
}

// ---------------------------------------------------------------------------------------------
// Preconditions

/**
 * «(اینکه) (N) آنالیز روزانه (ای) برای سفارش … با کد MI … ثبت (و توسط … تایید) شده باشد» — `count`
 * daily BOMs on that order and MI code, registered by the System Admin (the order defined or
 * extended first — `register-bom.ts#RegisterBomAndRememberIt`), each approved by `approverName` when
 * one is named. The last becomes "آن آنالیز روزانه": the one remembered (`bom-details.ts`) and in
 * focus for the review vocabulary («وضعیت آن آنالیز روزانه …»).
 */
export const dailyBomsAreRegisteredForOrder = async (
  count: number,
  orderNumber: string,
  miCode: string,
  approverName?: string,
): Promise<void> => {
  await performAsTheSystemAdmin(
    RegisterStandardBomWithMiCodeUnlessRegistered(miCode),
  );
  const standardBom = theStandardBomRegisteredWithMiCode(miCode);
  for (let registered = 0; registered < count; registered += 1) {
    await performAsTheSystemAdmin(
      RegisterBomAndRememberIt(standardBom, { orderNumber }),
    );
    focusOnTheDailyBom(theLastRegisteredBom());
    if (approverName) {
      await approveDailyBomAsAPrecondition(thatDailyBom(), approverName);
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Attempts over HTTP

/**
 * «{actor} تلاش می کند کد MI آن آنالیز روزانه را با دلیل … به … تغییر دهد» — `PATCH boms/:id` with
 * the new `standardBomMiCode` and the composition cloned from that standard BOM (the API changes a
 * composition only as a whole), each line keeping the weight it had where component and material
 * match. No expectation on the answer.
 */
export const AttemptToChangeMiCodeOfDailyBom = (
  bom: RegisteredBom,
  newMiCode: string,
  reason: string = ROUTINE_EDIT_REASON,
): Interaction =>
  Interaction.where(
    d`#actor attempts to change the MI code of daily BOM "${bom.orderNumber}" to "${newMiCode}" (via API)`,
    async (actor) => {
      const target = theStandardBomRegisteredWithMiCode(newMiCode);
      await Send.a(GetRequest.to(`boms/${bom.id}`)).performAs(actor);
      const current = await actor.answer(LastResponse.body<DailyBomDetail>());
      await Send.a(GetRequest.to('standard-boms')).performAs(actor);
      const standardBom = (
        await actor.answer(LastResponse.body<StandardBomSummary[]>())
      ).find((candidate) => candidate.id === target.id);
      if (!standardBom) {
        throw new Error(`Standard BOM "${newMiCode}" was not found.`);
      }
      const weightOf = (componentName: string, materialName: string) =>
        current.components
          .find((component) => component.name === componentName)
          ?.materials.find((material) => material.name === materialName)
          ?.weight ?? freshWeightInGrams();
      await Send.a(
        PatchRequest.to(`boms/${bom.id}`).with({
          standardBomMiCode: newMiCode,
          components: standardBom.components.map((component) => ({
            componentId: component.id,
            materials: component.materials.map((material) => ({
              materialId: material.id,
              weight: weightOf(component.name, material.name),
            })),
          })),
          ...editIntentFields(aCorrection(reason)),
        }),
      ).performAs(actor);
    },
  );

// ---------------------------------------------------------------------------------------------
// Facts, read by the observer

const TheDailyBom = (id: string) =>
  Question.about(d`daily BOM ${id}`, async (actor) => {
    await Send.a(GetRequest.to(`boms/${id}`)).performAs(actor);
    return actor.answer(LastResponse.body<DailyBomDetail>());
  });

/** «آن آنالیز روزانه (همچنان) شماره سفارش … را داشته باشد» */
export const EnsureDailyBomHasOrderNumber = (
  bom: { id: string },
  orderNumber: string,
): Task =>
  Task.where(
    d`#actor ensures daily BOM ${bom.id} has order number "${orderNumber}"`,
    Ensure.that(
      TheDailyBom(bom.id).orderNumber,
      equals(withLatinDigits(orderNumber)),
    ),
  );

/** «آن آنالیز روزانه کد MI … را داشته باشد» */
export const EnsureDailyBomHasMiCode = (
  bom: { id: string },
  miCode: string,
): Task =>
  Task.where(
    d`#actor ensures daily BOM ${bom.id} has MI code "${miCode}"`,
    Ensure.that(
      TheDailyBom(bom.id).standardBomMiCode,
      equals(withLatinDigits(miCode)),
    ),
  );

/** «آن آنالیز روزانه ویرایش نشده باشد» — still the order number and MI code it was registered with. */
export const EnsureDailyBomIsAsRegistered = (bom: RegisteredBom): Task =>
  Task.where(
    d`#actor ensures daily BOM "${bom.orderNumber}" was not edited`,
    Ensure.that(TheDailyBom(bom.id).orderNumber, equals(bom.orderNumber)),
    Ensure.that(
      TheDailyBom(bom.id).standardBomMiCode,
      equals(bom.standardBomMiCode),
    ),
  );

/**
 * «آنالیز روزانه جدیدی برای سفارش … با کد MI … ثبت شده باشد» — the daily BOM just registered,
 * found by the attempt's tracking number (fresh per attempt), is stored under the order number as
 * the system keeps it (Latin digits) and on the standard BOM that MI code names.
 */
export const EnsureNewBomWasRegisteredForOrder = (
  trackingNumber: string,
  orderNumber: string,
  miCode: string,
): Task => {
  const theOne = Question.about(
    d`the daily BOM with tracking number "${trackingNumber}"`,
    async (actor) => {
      const matching = (await actor.answer(TheBomList())).filter(
        (bom) => bom.trackingNumber === trackingNumber,
      );
      if (matching.length !== 1) {
        throw new Error(
          `Expected exactly one daily BOM with tracking number "${trackingNumber}", found ${matching.length}.`,
        );
      }
      return matching[0];
    },
  );
  return Task.where(
    d`#actor ensures a daily BOM was registered for order "${orderNumber}" with MI code "${miCode}"`,
    ViewBomList(),
    Ensure.that(theOne.orderNumber, equals(withLatinDigits(orderNumber))),
    Ensure.that(
      theOne.standardBomId,
      equals(theStandardBomRegisteredWithMiCode(miCode).id),
    ),
  );
};

const TheDailyBomsOfOrder = (orderNumber: string) =>
  Question.about(d`the daily BOMs of order "${orderNumber}"`, async (actor) => {
    await Send.a(GetRequest.to('boms')).performAs(actor);
    return (await actor.answer(LastResponse.body<BomSummary[]>())).filter(
      (bom) => bom.orderNumber === withLatinDigits(orderNumber),
    );
  });

/**
 * «هر N آنالیز روزانه سفارش … همچنان کد MI … و وضعیت … داشته باشند» — exactly N daily BOMs on the
 * order, each still on that MI code's standard BOM and in that review status.
 */
export const EnsureEveryDailyBomOfOrder = (
  count: number,
  orderNumber: string,
  miCode: string,
  statusLabel: string,
): Task =>
  Task.where(
    d`#actor ensures all ${count} daily BOMs of order "${orderNumber}" are "${miCode}" and "${statusLabel}"`,
    Ensure.that(
      Question.about(
        d`what the daily BOMs of order "${orderNumber}" hold`,
        async (actor) => {
          const boms = await actor.answer(TheDailyBomsOfOrder(orderNumber));
          const details: { miCode: string; status: string }[] = [];
          for (const bom of boms) {
            const detail = await actor.answer(TheDailyBom(bom.id));
            details.push({
              miCode: detail.standardBomMiCode,
              status: detail.approvalStatus,
            });
          }
          return details;
        },
      ),
      equals(
        Array.from({ length: count }, () => ({
          miCode: withLatinDigits(miCode),
          status: approvalStatusFor(statusLabel),
        })),
      ),
    ),
  );

/** «هیچ آنالیز روزانه ای با شماره سفارش … در سیستم نمانده باشد» */
export const EnsureNoDailyBomHasOrderNumber = (orderNumber: string): Task =>
  Task.where(
    d`#actor ensures no daily BOM has order number "${orderNumber}"`,
    Ensure.that(
      Question.about(
        d`how many daily BOMs order "${orderNumber}" has`,
        async (actor) =>
          (await actor.answer(TheDailyBomsOfOrder(orderNumber))).length,
      ),
      equals(0),
    ),
  );

/** «هیچ آنالیز روزانه ای با کد MI … ثبت نشده باشد» — a precondition that only confirms it. */
export const EnsureNoDailyBomIsOnStandardBom = (miCode: string): Task =>
  Task.where(
    d`#actor ensures no daily BOM is registered on MI code "${miCode}"`,
    Ensure.that(
      Question.about(
        d`how many daily BOMs MI code "${miCode}" has`,
        async (actor) => {
          const { id } = theStandardBomRegisteredWithMiCode(miCode);
          await Send.a(GetRequest.to('boms')).performAs(actor);
          return (await actor.answer(LastResponse.body<BomSummary[]>())).filter(
            (bom) => bom.standardBomId === id,
          ).length;
        },
      ),
      equals(0),
    ),
  );

// ---------------------------------------------------------------------------------------------
// What the actor was told — every attempt here goes over HTTP

/** «پیغام خطای سفارش تعریف نشده نشان داده شود» */
export const EnsureToldTheOrderIsNotDefined = (): Task =>
  EnsureProblemDetail(400, 'bom-order-not-defined');

/** «پیغام خطای کد MI خارج از سفارش نشان داده شود» */
export const EnsureToldTheMiCodeIsNotOnTheOrder = (): Task =>
  EnsureProblemDetail(400, 'bom-mi-code-not-in-order');

/** «پیغام خطای کد MI نشان داده شود», after a registration with none chosen on an order with several. */
export const EnsureToldAnMiCodeMustBeChosen = (): Task =>
  EnsureProblemDetail(400, 'bom-mi-code-required');

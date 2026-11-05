import {
  AnswersQuestions,
  CollectsArtifacts,
  Interaction,
  Question,
  QuestionAdapter,
  UsesAbilities,
} from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { readAsTheSystemAdmin } from '../common/observer';
import { withLatinDigits } from '../common/persian-digits';

/**
 * An order («سفارش», issue #101): a unique order number with the MI codes (standard BOMs) assigned
 * to it — pinned contract, `docs/superpowers/plans/2026-11-05-order-management.md`. An order number
 * is one value whatever digits it is written in («ORD-۵۰۰۱» is «ORD-5001»), and so is an MI code.
 */
export interface OrderMiCode {
  standardBomId: string;
  miCode: string;
  productId: string;
  productName: string;
}

export interface OrderReadModel {
  id: string;
  orderNumber: string;
  miCodes: OrderMiCode[];
  dailyBomCount: number;
}

export interface OrderList {
  items: OrderReadModel[];
}

/** `orders/by-number/:orderNumber` — the backend normalises the digits; the suite does too, so the
 * path never carries a Persian digit. */
export const orderByNumberResource = (orderNumber: string): string =>
  `orders/by-number/${encodeURIComponent(withLatinDigits(orderNumber))}`;

/** One value whatever its digits: what a Gherkin literal and a stored value are compared as. */
export const sameCode = (a: string, b: string): boolean =>
  withLatinDigits(a) === withLatinDigits(b);

/** The MI codes an order holds, in Latin digits and sorted — compared as a set by every `Then`. */
export const miCodesOf = (order: OrderReadModel): string[] =>
  order.miCodes.map((code) => withLatinDigits(code.miCode)).sort();

export const asSortedCodes = (codes: string[]): string[] =>
  codes.map(withLatinDigits).sort();

/** An actor able to send a request — what a Question's actor is cast to before it reads. */
export type Reader = UsesAbilities & AnswersQuestions & CollectsArtifacts;

/**
 * The order numbered `orderNumber` as the system holds it now, or `undefined` when there is none
 * (`404`). Read by whoever performs it — the observer, for facts. Anything other than 200/404 fails
 * loudly: a read that went wrong must not pass for "not defined".
 */
export const readTheOrderNumbered = async (
  actor: Reader,
  orderNumber: string,
): Promise<OrderReadModel | undefined> => {
  await Send.a(GetRequest.to(orderByNumberResource(orderNumber))).performAs(
    actor,
  );
  const status = await actor.answer(LastResponse.status());
  if (status === 404) {
    return undefined;
  }
  if (status !== 200) {
    throw new Error(
      `Reading order "${orderNumber}" answered ${status}, expected 200 or 404.`,
    );
  }
  return actor.answer(LastResponse.body<OrderReadModel>());
};

/** The order numbered `orderNumber`, read by the System Admin — for an attempt's setup: finding the
 * id the attempt is about before the actor under test makes it (`common/observer.ts`). */
export const theOrderNumbered = async (
  orderNumber: string,
): Promise<OrderReadModel> =>
  readAsTheSystemAdmin<OrderReadModel>(orderByNumberResource(orderNumber));

/** Every order (`GET orders`) — as the actor performing the interaction that asks. */
export const TheOrders = (): QuestionAdapter<OrderReadModel[]> =>
  Question.about('every order', async (actor) => {
    await Send.a(GetRequest.to('orders')).performAs(actor);
    return (await actor.answer(LastResponse.body<OrderList>())).items;
  });

// ---------------------------------------------------------------------------------------------
// What the system held before an attempt — so «… ویرایش نشده باشد» / «سفارش جدیدی ثبت نشده باشد»
// can say nothing changed, whichever door the attempt went through.

let ordersBeforeTheAttempt: OrderReadModel[] | undefined;

/** Notes every order as it is now. Performed by the observer, before the attempt. */
export const NoteTheOrders = (): Interaction =>
  Interaction.where('#actor notes every order', async (actor) => {
    ordersBeforeTheAttempt = await actor.answer(TheOrders());
  });

export const theOrdersNotedBeforeTheAttempt = (): OrderReadModel[] => {
  if (!ordersBeforeTheAttempt) {
    throw new Error(
      'No orders were noted before the attempt — its step should note them first ' +
        '(`planning/order-details.ts#NoteTheOrders`).',
    );
  }
  return ordersBeforeTheAttempt;
};

/** A comparable picture of an order: number and MI codes, never the id or the count. */
export const pictureOf = (
  order: OrderReadModel,
): { orderNumber: string; miCodes: string[] } => ({
  orderNumber: withLatinDigits(order.orderNumber),
  miCodes: miCodesOf(order),
});

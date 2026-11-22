import { Question, Task } from '@serenity-js/core';
import { Ensure, equals, isTrue } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { OrderList } from './order-details';

/**
 * Who may see the list of orders (issue #130): every production role but the QC inspector, who
 * only looks one order up by number from the daily-BOM form (`GET orders/by-number/:n`, still
 * open to her). The rule is the backend's, applied to the role the user holds *now* — a role
 * changed while they are signed in takes effect on their very next request — so these go over
 * HTTP, with whatever session the actor already has: no fresh login, which is the point of
 * role-based-home-page's «تغییر نقش کاربر بدون ورود دوباره …» rule.
 */
export const ViewOrderList = {
  /** «… لیست سفارشات را مشاهده می کند» / «… تلاش می کند لیست سفارشات را مشاهده کند» —
   * `GET orders` with the actor's current session. No expectation on the answer. */
  viaApi: (): Task =>
    Task.where(
      '#actor views the list of orders (via API)',
      Send.a(GetRequest.to('orders')),
    ),
};

const TheAnswerIsAListOfOrders = () =>
  Question.about('whether the answer is a list of orders', async (actor) =>
    Array.isArray((await actor.answer(LastResponse.body<OrderList>())).items),
  );

/** «لیست سفارشات به او نشان داده شود» — the request was answered with the list. */
export const EnsureOrderListWasShown = (): Task =>
  Task.where(
    '#actor ensures the list of orders was shown',
    Ensure.that(LastResponse.status(), equals(200)),
    Ensure.that(TheAnswerIsAListOfOrders(), isTrue()),
  );

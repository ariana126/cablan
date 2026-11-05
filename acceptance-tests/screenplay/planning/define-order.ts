import { actorCalled, d, Interaction, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Enter } from '@serenity-js/web';
import { OrdersPage } from '../ui/orders-page';
import { LogInAsPersona } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import { withLatinDigits } from '../common/persian-digits';
import {
  OpenNewOrderForm,
  SubmitTheOrderForm,
  ToggleMiCodes,
} from './orders-form';
import { readTheOrderNumbered, sameCode } from './order-details';

/**
 * Defining an order (issue #101): `POST orders { orderNumber, miCodes }` → 201 `{ id }`, Management
 * and the System Admin only. The browser door is `/orders`' «تعریف سفارش» dialog.
 */
export const DefineOrder = {
  /** «{actor} سفارش … را با کد(های) MI … تعریف می کند» — the dialog, submitted and answered. */
  using: (orderNumber: string, miCodes: string[]): Task =>
    Task.where(
      d`#actor defines order "${orderNumber}" with MI codes ${miCodes.join(', ')}`,
      OpenNewOrderForm(),
      Enter.theValue(orderNumber).into(OrdersPage.orderNumberField()),
      ToggleMiCodes(miCodes),
      SubmitTheOrderForm(),
    ),

  /** The API door: preconditions and every «تلاش …» attempt. No expectation on the answer. */
  viaApiUsing: (orderNumber: string, miCodes: string[]): Task =>
    Task.where(
      d`#actor defines order "${orderNumber}" with MI codes ${miCodes.join(', ')} (via API)`,
      Send.a(PostRequest.to('orders').with({ orderNumber, miCodes })),
    ),
};

/**
 * «اطلاعات سفارش جدید با کد MI … وارد میکند» — the dialog filled with a fresh order number and the
 * MI code, not submitted yet: the «اما …» step that follows changes one field and submits.
 */
export const EnterNewOrderDetails = (
  orderNumber: string,
  miCodes: string[],
): Task =>
  Task.where(
    d`#actor enters a new order with MI codes ${miCodes.join(', ')}, without submitting yet`,
    OpenNewOrderForm(),
    Enter.theValue(orderNumber).into(OrdersPage.orderNumberField()),
    ToggleMiCodes(miCodes),
  );

/** «اما شماره سفارش را خالی میگذارد» (in the order form) — clears it, then submits. */
export const AttemptToDefineLeavingOrderNumberEmpty = (): Task =>
  Task.where(
    '#actor attempts to define the order leaving its number empty',
    Enter.theValue('').into(OrdersPage.orderNumberField()),
    SubmitTheOrderForm(),
  );

/**
 * A precondition that only needs the order to *exist with these MI codes*: defines it when it is
 * not, and assigns whichever of `miCodes` it lacks when it is (`POST orders/:id/mi-codes`; a 409
 * `order-mi-code-already-assigned` means another step got there first, which is just as good).
 * Idempotent, so a Background line, a Given repeating it and every daily-BOM precondition that
 * needs the order can all state it.
 */
export const DefineOrderUnlessDefined = (
  orderNumber: string,
  miCodes: string[],
): Interaction =>
  Interaction.where(
    d`#actor makes sure order "${orderNumber}" is defined with MI codes ${miCodes.join(', ')}`,
    async (actor) => {
      const existing = await readTheOrderNumbered(actor, orderNumber);
      if (!existing) {
        await Send.a(
          PostRequest.to('orders').with({
            orderNumber: withLatinDigits(orderNumber),
            miCodes: miCodes.map(withLatinDigits),
          }),
        ).performAs(actor);
        await Ensure.that(LastResponse.status(), equals(201)).performAs(actor);
        return;
      }
      for (const miCode of miCodes) {
        if (existing.miCodes.some((held) => sameCode(held.miCode, miCode))) {
          continue;
        }
        await Send.a(
          PostRequest.to(`orders/${existing.id}/mi-codes`).with({
            miCode: withLatinDigits(miCode),
          }),
        ).performAs(actor);
        const status = await actor.answer(LastResponse.status());
        if (status !== 204 && status !== 409) {
          throw new Error(
            `Assigning MI code "${miCode}" to order "${orderNumber}" answered ${status}.`,
          );
        }
      }
    },
  );

/**
 * The same precondition, made true by the System Admin from anywhere — a step, a task, or inside an
 * `Interaction` of another actor's task — without moving the spotlight. This is what every
 * daily-BOM precondition and UI registration of the suite calls first since issue #101: a daily
 * BOM can only be registered for a defined order holding its MI code.
 */
export const defineOrderAsTheSystemAdminUnlessDefined = (
  orderNumber: string,
  miCodes: string[],
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(
      LogInAsPersona('یاشار'),
      DefineOrderUnlessDefined(orderNumber, miCodes),
    ),
  );

/** `defineOrderAsTheSystemAdminUnlessDefined` as an activity, for a task's activity list. */
export const TheOrderIsDefinedFor = (
  orderNumber: string,
  miCode: string,
): Interaction =>
  Interaction.where(
    d`#actor makes sure order "${orderNumber}" holds MI code "${miCode}"`,
    () => defineOrderAsTheSystemAdminUnlessDefined(orderNumber, [miCode]),
  );

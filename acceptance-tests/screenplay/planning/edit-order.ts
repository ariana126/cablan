import { d, Interaction, Task } from '@serenity-js/core';
import { PatchRequest, Send } from '@serenity-js/rest';
import { Enter } from '@serenity-js/web';
import { OrdersPage } from '../ui/orders-page';
import {
  ConfirmTheCorrection,
  ConfirmTheCorrectionIfAsked,
  DeclineTheCorrection,
} from '../common/correction-confirmation';
import { withLatinDigits } from '../common/persian-digits';
import {
  OpenEditOrderForm,
  RemoveMiCodes,
  SubmitTheOrderEdit,
  SubmitTheOrderForm,
  theOrderDialogHasAnswered,
  WaitForTheOrderDialogToBeAnswered,
} from './orders-form';
import { theOrderNumbered } from './order-details';

/**
 * Editing an order (issue #101): `PATCH orders/:id { orderNumber?, miCodes?, applyToRelatedRecords? }`,
 * where `miCodes` replaces the whole list — so "removing an MI code" is the list without it. An order
 * with daily BOMs can't be edited (409 `record-has-dependents`, kind `daily-bom`), except by the System
 * Admin's correction of its number alone, confirmed with «اعمال در اطلاعات و سوابق مرتبط».
 */

export interface OrderChanges {
  orderNumber?: string;
  /** MI codes to take off the order. */
  removedMiCodes?: string[];
}

export const EditOrder = {
  /** «{actor} شماره سفارش … را به … تغییر می دهد و کد MI … را از آن برمی دارد» — «ویرایش» in the
   * order's details dialog; in its own dialog a new number, each removed code's chip taken off with
   * «برداشتن <code>», then «ثبت». */
  using: (orderNumber: string, changes: OrderChanges): Task =>
    Task.where(
      d`#actor edits order "${orderNumber}" with ${changes}`,
      OpenEditOrderForm(orderNumber),
      ...(changes.orderNumber !== undefined
        ? [
            Enter.theValue(changes.orderNumber).into(
              OrdersPage.orderNumberField(),
            ),
          ]
        : []),
      ...(changes.removedMiCodes?.length
        ? [RemoveMiCodes(changes.removedMiCodes)]
        : []),
      SubmitTheOrderForm(),
    ),
};

/**
 * The System Admin's correction of the number of an order in use (issue #110's exception, approved
 * for orders): the edit dialog, then the correction confirmation stacked over it
 * (`common/correction-confirmation.ts`).
 */
export const CorrectOrderNumber = {
  /** «… تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند» */
  confirming: (orderNumber: string, newOrderNumber: string): Task =>
    Task.where(
      d`#actor corrects order number "${orderNumber}" to "${newOrderNumber}", confirming it`,
      OpenEditOrderForm(orderNumber),
      Enter.theValue(newOrderNumber).into(OrdersPage.orderNumberField()),
      SubmitTheOrderEdit(),
      ConfirmTheCorrection(),
      WaitForTheOrderDialogToBeAnswered(),
    ),

  /**
   * The same, onto a number another order has: the site may refuse it at once (the edit dialog
   * says so) or only after the confirmation — the design does not pin which check runs first — so
   * the confirmation is given only if asked, as `record-correction.ts` does for a duplicate code.
   */
  confirmingIfAsked: (orderNumber: string, newOrderNumber: string): Task =>
    Task.where(
      d`#actor corrects order number "${orderNumber}" to "${newOrderNumber}", confirming if asked`,
      OpenEditOrderForm(orderNumber),
      Enter.theValue(newOrderNumber).into(OrdersPage.orderNumberField()),
      SubmitTheOrderEdit(),
      ConfirmTheCorrectionIfAsked(theOrderDialogHasAnswered),
      WaitForTheOrderDialogToBeAnswered(),
    ),

  /** «… اما اعمال آن در اطلاعات و سوابق مرتبط را تایید نمی کند» — «انصراف»; nothing is sent again. */
  declining: (orderNumber: string, newOrderNumber: string): Task =>
    Task.where(
      d`#actor corrects order number "${orderNumber}" to "${newOrderNumber}", then declines`,
      OpenEditOrderForm(orderNumber),
      Enter.theValue(newOrderNumber).into(OrdersPage.orderNumberField()),
      SubmitTheOrderEdit(),
      DeclineTheCorrection(),
    ),
};

/** Every «تلاش …» edit of an order goes over HTTP; the `Then`s judge the answer. The order is
 * looked up by the System Admin first (`order-details.ts#theOrderNumbered`). */
export const AttemptToEditOrder = {
  /** «{actor} تلاش می کند شماره سفارش … را به … تغییر دهد» */
  changingItsNumber: (
    orderNumber: string,
    newOrderNumber: string,
  ): Interaction =>
    Interaction.where(
      d`#actor attempts to change order number "${orderNumber}" to "${newOrderNumber}" (via API)`,
      async (actor) => {
        const { id } = await theOrderNumbered(orderNumber);
        await Send.a(
          PatchRequest.to(`orders/${id}`).with({ orderNumber: newOrderNumber }),
        ).performAs(actor);
      },
    ),

  /** «{actor} تلاش می کند کد MI … را از سفارش … بردارد» — the order's list without that code. */
  removingMiCode: (miCode: string, orderNumber: string): Interaction =>
    Interaction.where(
      d`#actor attempts to remove MI code "${miCode}" from order "${orderNumber}" (via API)`,
      async (actor) => {
        const order = await theOrderNumbered(orderNumber);
        const miCodes = order.miCodes
          .map((held) => held.miCode)
          .filter((held) => withLatinDigits(held) !== withLatinDigits(miCode));
        await Send.a(
          PatchRequest.to(`orders/${order.id}`).with({ miCodes }),
        ).performAs(actor);
      },
    ),
};

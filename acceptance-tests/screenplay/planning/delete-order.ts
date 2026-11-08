import { d, Interaction, Task } from '@serenity-js/core';
import { DeleteRequest, Send } from '@serenity-js/rest';
import { Click } from '@serenity-js/web';
import { OrdersPage } from '../ui/orders-page';
import {
  OpenDeleteOrderConfirmation,
  WaitForTheOrderDialogToBeAnswered,
} from './orders-form';
import { theOrderNumbered } from './order-details';

/**
 * Deleting an order (issue #101): `DELETE orders/:id` → 204. An order with daily BOMs is refused
 * (409 `record-has-dependents`) — except for the System Admin, whose delete removes its daily BOMs
 * with it (issue #110's exception, approved for orders).
 */
export const DeleteOrder = {
  /** «{actor} سفارش … را حذف می کند» — «حذف» in the order's details panel, then the confirmation's «حذف». */
  using: (orderNumber: string): Task =>
    Task.where(
      d`#actor deletes order "${orderNumber}"`,
      OpenDeleteOrderConfirmation(orderNumber),
      Click.on(OrdersPage.confirmDeleteButton()),
      WaitForTheOrderDialogToBeAnswered(),
    ),

  /** «{actor} تلاش می کند سفارش … را حذف کند» — no expectation on the answer. */
  viaApiUsing: (orderNumber: string): Interaction =>
    Interaction.where(
      d`#actor deletes order "${orderNumber}" (via API)`,
      async (actor) => {
        const { id } = await theOrderNumbered(orderNumber);
        await Send.a(DeleteRequest.to(`orders/${id}`)).performAs(actor);
      },
    ),
};

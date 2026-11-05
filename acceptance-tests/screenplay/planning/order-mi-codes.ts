import { d, Interaction, Task } from '@serenity-js/core';
import { PostRequest, Send } from '@serenity-js/rest';
import { Click } from '@serenity-js/web';
import { OrdersPage } from '../ui/orders-page';
import {
  ChooseTheMiCodeToAdd,
  OpenAddMiCodeForm,
  WaitForTheOrderDialogToBeAnswered,
} from './orders-form';
import { theOrderNumbered } from './order-details';

/**
 * Assigning one more MI code to an order (issue #101): `POST orders/:id/mi-codes { miCode }` → 204.
 * Allowed even on an order that has daily BOMs, which it leaves untouched — the one change the
 * dependency rule does not guard. The browser door is the row's «افزودن کد MI».
 */
export const AddMiCodeToOrder = {
  /** «{actor} کد MI … را به سفارش … اضافه می کند» */
  using: (miCode: string, orderNumber: string): Task =>
    Task.where(
      d`#actor adds MI code "${miCode}" to order "${orderNumber}"`,
      OpenAddMiCodeForm(orderNumber),
      ChooseTheMiCodeToAdd(miCode),
      Click.on(OrdersPage.addButton()),
      WaitForTheOrderDialogToBeAnswered(),
    ),

  /** «{actor} تلاش می کند کد MI … را (دوباره) به سفارش … اضافه کند» — no expectation on the answer.
   * The order's id is looked up by the System Admin first, so a role that may not read orders is
   * refused by the rule under test, not by its setup. */
  viaApiUsing: (miCode: string, orderNumber: string): Interaction =>
    Interaction.where(
      d`#actor adds MI code "${miCode}" to order "${orderNumber}" (via API)`,
      async (actor) => {
        const { id } = await theOrderNumbered(orderNumber);
        await Send.a(
          PostRequest.to(`orders/${id}/mi-codes`).with({ miCode }),
        ).performAs(actor);
      },
    ),
};

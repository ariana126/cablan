import { d, Task, Wait } from '@serenity-js/core';
import { Ensure, isGreaterThan, not } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { ProductsPage } from '../ui/products-page';
import {
  OpenDeleteConfirmation,
  WaitForTheDeleteConfirmationToBeAnswered,
} from './products-form';
import { theLastRegisteredProduct } from './product-details';

export const DeleteProduct = {
  /**
   * Deletes a product through the real delete-confirmation dialog — the UI door this feature's
   * top-level "حذف می کند" scenario drives. Mirrors
   * `screenplay/bom-registration/delete-component.ts#DeleteComponent.using`.
   */
  using: (name: string): Task =>
    Task.where(
      d`#actor deletes the product "${name}"`,
      OpenDeleteConfirmation(name),
      Click.on(ProductsPage.confirmDeleteButton()),
      WaitForTheDeleteConfirmationToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string): Task =>
    Task.where(
      d`#actor deletes product ${id} (via API)`,
      Send.a(DeleteRequest.to(`products/${id}`)),
    ),
};

/** Through the UI, assert what the visitor sees: the product's name is gone from the list. */
export const EnsureProductWasDeleted = (): Task => {
  const target = theLastRegisteredProduct();
  return Task.where(
    d`#actor ensures "${target.name}" was deleted`,
    Wait.until(ProductsPage.productNamed(target.name), not(isVisible())),
  );
};

/**
 * The access-denied "تلاش می کند" rule is the only caller of this step, and its attempt always
 * goes through the API (`DeleteProduct.viaApiUsing`), so — unlike the register/edit equivalents —
 * `LastResponse` reliably reflects that attempt; no door-agnostic re-query needed. Mirrors
 * `screenplay/bom-registration/delete-component.ts#EnsureComponentWasNotDeleted`.
 */
export const EnsureProductWasNotDeleted = (): Task =>
  Task.where(
    '#actor ensures the product was not deleted',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

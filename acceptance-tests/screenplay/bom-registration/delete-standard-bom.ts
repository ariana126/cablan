import { d, Task, Wait } from '@serenity-js/core';
import { Ensure, isGreaterThan, not } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import {
  OpenDeleteConfirmation,
  WaitForTheDeleteConfirmationToBeAnswered,
} from './standard-bom-form';
import { theLastRegisteredStandardBom } from './standard-bom-details';

export const DeleteStandardBom = {
  /**
   * Deletes a standard BOM through the real delete-confirmation dialog — the UI door this
   * feature's top-level "حذف می کند" scenario drives. Mirrors
   * `screenplay/bom-registration/delete-product.ts#DeleteProduct.using`.
   */
  using: (miCode: string): Task =>
    Task.where(
      d`#actor deletes the standard BOM "${miCode}"`,
      OpenDeleteConfirmation(miCode),
      Click.on(StandardBomsPage.confirmDeleteButton()),
      WaitForTheDeleteConfirmationToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string): Task =>
    Task.where(
      d`#actor deletes standard BOM ${id} (via API)`,
      Send.a(DeleteRequest.to(`standard-boms/${id}`)),
    ),
};

/** Through the UI, assert what the visitor sees: the standard BOM's MI code is gone from the list. */
export const EnsureStandardBomWasDeleted = (): Task => {
  const target = theLastRegisteredStandardBom();
  return Task.where(
    d`#actor ensures standard BOM "${target.miCode}" was deleted`,
    Wait.until(
      StandardBomsPage.standardBomNamed(target.miCode),
      not(isVisible()),
    ),
  );
};

/**
 * The access-denied "تلاش می کند" rule is the only caller of this step, and its attempt always
 * goes through the API (`DeleteStandardBom.viaApiUsing`), so `LastResponse` reliably reflects that
 * attempt; no door-agnostic re-query needed. Mirrors
 * `screenplay/bom-registration/delete-product.ts#EnsureProductWasNotDeleted`.
 */
export const EnsureStandardBomWasNotDeleted = (): Task =>
  Task.where(
    '#actor ensures the standard BOM was not deleted',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

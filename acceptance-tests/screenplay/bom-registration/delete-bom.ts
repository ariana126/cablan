import { d, Task, Wait } from '@serenity-js/core';
import { Ensure, isGreaterThan, not } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import {
  OpenDeleteConfirmation,
  WaitForTheDeleteConfirmationToBeAnswered,
} from './bom-form';
import { theLastRegisteredBom } from './bom-details';

export const DeleteBom = {
  /**
   * Deletes a daily BOM through the real delete-confirmation dialog — the UI door this feature's
   * top-level "حذف می کند" scenario drives. Mirrors
   * `screenplay/bom-registration/delete-standard-bom.ts#DeleteStandardBom.using`.
   */
  using: (orderNumber: string): Task =>
    Task.where(
      d`#actor deletes the daily BOM "${orderNumber}"`,
      OpenDeleteConfirmation(orderNumber),
      Click.on(BomsPage.confirmDeleteButton()),
      WaitForTheDeleteConfirmationToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string): Task =>
    Task.where(
      d`#actor deletes daily BOM ${id} (via API)`,
      Send.a(DeleteRequest.to(`boms/${id}`)),
    ),
};

/** Through the UI, assert what the visitor sees: the daily BOM's order number is gone from the list. */
export const EnsureBomWasDeleted = (): Task => {
  const target = theLastRegisteredBom();
  return Task.where(
    d`#actor ensures daily BOM "${target.orderNumber}" was deleted`,
    Wait.until(BomsPage.bomNamed(target.orderNumber), not(isVisible())),
  );
};

/**
 * The access-denied "تلاش می کند" rule is the only caller of this step, and its attempt always
 * goes through the API (`DeleteBom.viaApiUsing`), so `LastResponse` reliably reflects that
 * attempt; no door-agnostic re-query needed. Mirrors
 * `screenplay/bom-registration/delete-standard-bom.ts#EnsureStandardBomWasNotDeleted`.
 */
export const EnsureBomWasNotDeleted = (): Task =>
  Task.where(
    '#actor ensures the daily BOM was not deleted',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

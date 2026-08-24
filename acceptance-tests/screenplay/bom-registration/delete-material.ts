import { d, Task, Wait } from '@serenity-js/core';
import { Ensure, isGreaterThan, not } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { MaterialsPage } from '../ui/materials-page';
import {
  OpenDeleteConfirmation,
  WaitForTheDeleteConfirmationToBeAnswered,
} from './materials-form';
import { theLastRegisteredMaterial } from './material-details';

export const DeleteMaterial = {
  /**
   * Deletes a material through the real delete-confirmation dialog — the UI door this feature's
   * top-level "حذف می کند" scenario drives.
   */
  using: (name: string): Task =>
    Task.where(
      d`#actor deletes the material "${name}"`,
      OpenDeleteConfirmation(name),
      Click.on(MaterialsPage.confirmDeleteButton()),
      WaitForTheDeleteConfirmationToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string): Task =>
    Task.where(
      d`#actor deletes material ${id} (via API)`,
      Send.a(DeleteRequest.to(`materials/${id}`)),
    ),
};

/** Through the UI, assert what the visitor sees: the material's name is gone from the list. */
export const EnsureMaterialWasDeleted = (): Task => {
  const target = theLastRegisteredMaterial();
  return Task.where(
    d`#actor ensures "${target.name}" was deleted`,
    Wait.until(MaterialsPage.materialNamed(target.name), not(isVisible())),
  );
};

/**
 * The access-denied "تلاش می کند" rule is the only caller of this step, and its attempt always
 * goes through the API (`DeleteMaterial.viaApiUsing`), so — unlike the register/edit equivalents —
 * `LastResponse` reliably reflects that attempt; no door-agnostic re-query needed. Mirrors
 * `screenplay/authentication/delete-user.ts#EnsureUserWasNotDeleted`.
 */
export const EnsureMaterialWasNotDeleted = (): Task =>
  Task.where(
    '#actor ensures the material was not deleted',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

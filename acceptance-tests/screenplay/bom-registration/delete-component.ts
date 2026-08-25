import { d, Task, Wait } from '@serenity-js/core';
import { Ensure, isGreaterThan, not } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { ComponentsPage } from '../ui/components-page';
import {
  OpenDeleteConfirmation,
  WaitForTheDeleteConfirmationToBeAnswered,
} from './components-form';
import { theLastRegisteredComponent } from './component-details';

export const DeleteComponent = {
  /**
   * Deletes a component through the real delete-confirmation dialog — the UI door this feature's
   * top-level "حذف می کند" scenario drives. Mirrors
   * `screenplay/bom-registration/delete-material.ts#DeleteMaterial.using`.
   */
  using: (name: string): Task =>
    Task.where(
      d`#actor deletes the component "${name}"`,
      OpenDeleteConfirmation(name),
      Click.on(ComponentsPage.confirmDeleteButton()),
      WaitForTheDeleteConfirmationToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string): Task =>
    Task.where(
      d`#actor deletes component ${id} (via API)`,
      Send.a(DeleteRequest.to(`components/${id}`)),
    ),
};

/** Through the UI, assert what the visitor sees: the component's name is gone from the list. */
export const EnsureComponentWasDeleted = (): Task => {
  const target = theLastRegisteredComponent();
  return Task.where(
    d`#actor ensures "${target.name}" was deleted`,
    Wait.until(ComponentsPage.componentNamed(target.name), not(isVisible())),
  );
};

/**
 * The access-denied "تلاش می کند" rule is the only caller of this step, and its attempt always
 * goes through the API (`DeleteComponent.viaApiUsing`), so — unlike the register/edit equivalents
 * — `LastResponse` reliably reflects that attempt; no door-agnostic re-query needed. Mirrors
 * `screenplay/bom-registration/delete-material.ts#EnsureMaterialWasNotDeleted`.
 */
export const EnsureComponentWasNotDeleted = (): Task =>
  Task.where(
    '#actor ensures the component was not deleted',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

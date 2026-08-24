import { Check, d, Question, Task, Wait } from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  property,
} from '@serenity-js/assertions';
import { LastResponse, PatchRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { MaterialsPage } from '../ui/materials-page';
import {
  OpenEditMaterialForm,
  WaitForTheMaterialFormToBeAnswered,
} from './materials-form';
import {
  NewMaterialDetails,
  theLastRegisteredMaterial,
} from './material-details';
import { TheMaterialList, ViewMaterialList } from './view-material-list';

const editRequestBody = (changes: Partial<NewMaterialDetails>) => {
  const body: Record<string, unknown> = {};
  if (changes.name !== undefined) body.name = changes.name;
  return Question.fromObject(body);
};

export const EditMaterial = {
  /**
   * Edits a material's name through the real "edit material" form — the UI door this feature's
   * top-level "ویرایش می کند"/"تغییر می دهد" scenarios drive. Locates the form by the material's
   * *current* name, since that's what the rendered list still shows until the edit succeeds.
   */
  using: (currentName: string, changes: Partial<NewMaterialDetails>): Task =>
    Task.where(
      d`#actor edits the material "${currentName}"`,
      OpenEditMaterialForm(currentName),
      ...(changes.name !== undefined
        ? [Enter.theValue(changes.name).into(MaterialsPage.nameField())]
        : []),
      Click.on(MaterialsPage.submitButton()),
      WaitForTheMaterialFormToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string, changes: Partial<NewMaterialDetails>): Task =>
    Task.where(
      d`#actor edits material ${id} (via API)`,
      Send.a(PatchRequest.to(`materials/${id}`).with(editRequestBody(changes))),
    ),
};

/** Through the UI, assert what the visitor sees: the edited name in the rendered list. */
export const EnsureMaterialWasEditedWith = (
  changes: Partial<NewMaterialDetails>,
): Task => {
  if (changes.name === undefined) {
    throw new Error(
      'EnsureMaterialWasEditedWith expects a "name" change — name is the only field this ' +
        'feature edits.',
    );
  }
  const newName = changes.name;
  return Task.where(
    d`#actor ensures the material was edited to "${newName}"`,
    Wait.until(MaterialsPage.materialNamed(newName), isVisible()),
  );
};

/**
 * Door-agnostic on purpose, the same way `register-material.ts#EnsureNewMaterialWasNotRegistered`
 * is: this feature's "مواد اولیه ویرایش نشده باشد" step follows an API-driven attempt
 * (access-denied) as well as two UI-driven ones (missing/duplicate name), so rather than reading
 * `LastResponse` it re-queries the system and checks the one fact that matters regardless of
 * door — the material `theLastRegisteredMaterial()` names is still exactly as it was.
 *
 * As in the register equivalent, the re-query is skipped when `LastResponse` already reports an
 * error (> 399) — the access-denied rule's API-driven attempt. Re-querying there would call
 * `Send.a(GetRequest...)` on the same actor's `CallAnApi` ability, overwriting `LastResponse` with
 * the GET's 200 before the shared "پیغام خطای عدم دسترسی نشان داده شود" step
 * (`step-definitions/common.steps.ts`) reads the original attempt's 403 off it.
 */
export const EnsureMaterialWasNotEdited = (): Task => {
  const target = theLastRegisteredMaterial();
  return Task.where(
    d`#actor ensures "${target.name}" was not edited`,
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewMaterialList(),
        Ensure.that(
          TheMaterialList(),
          containAtLeastOneItemThat(
            and(
              property('id', equals(target.id)),
              property('name', equals(target.name)),
            ),
          ),
        ),
      ),
  );
};

/** The "اسم آن مواد اولیه را پاک می کند" step: opens the edit form and clears the name field. */
export const AttemptToClearMaterialName = (currentName: string): Task =>
  Task.where(
    d`#actor attempts to clear the name of "${currentName}"`,
    OpenEditMaterialForm(currentName),
    Enter.theValue('').into(MaterialsPage.nameField()),
    Click.on(MaterialsPage.submitButton()),
    WaitForTheMaterialFormToBeAnswered(),
  );

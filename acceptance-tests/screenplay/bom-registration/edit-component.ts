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
import { ComponentsPage } from '../ui/components-page';
import {
  OpenEditComponentForm,
  WaitForTheComponentFormToBeAnswered,
} from './components-form';
import {
  NewComponentDetails,
  theLastRegisteredComponent,
} from './component-details';
import { TheComponentList, ViewComponentList } from './view-component-list';

const editRequestBody = (changes: Partial<NewComponentDetails>) => {
  const body: Record<string, unknown> = {};
  if (changes.name !== undefined) body.name = changes.name;
  return Question.fromObject(body);
};

export const EditComponent = {
  /**
   * Edits a component's name through the real "edit component" form — the UI door this feature's
   * top-level "ویرایش می کند"/"تغییر می دهد" scenarios drive. Locates the form by the component's
   * *current* name, since that's what the rendered list still shows until the edit succeeds.
   * Mirrors `screenplay/bom-registration/edit-material.ts#EditMaterial.using`.
   */
  using: (currentName: string, changes: Partial<NewComponentDetails>): Task =>
    Task.where(
      d`#actor edits the component "${currentName}"`,
      OpenEditComponentForm(currentName),
      ...(changes.name !== undefined
        ? [Enter.theValue(changes.name).into(ComponentsPage.nameField())]
        : []),
      Click.on(ComponentsPage.submitButton()),
      WaitForTheComponentFormToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string, changes: Partial<NewComponentDetails>): Task =>
    Task.where(
      d`#actor edits component ${id} (via API)`,
      Send.a(
        PatchRequest.to(`components/${id}`).with(editRequestBody(changes)),
      ),
    ),
};

/** Through the UI, assert what the visitor sees: the edited name in the rendered list. */
export const EnsureComponentWasEditedWith = (
  changes: Partial<NewComponentDetails>,
): Task => {
  if (changes.name === undefined) {
    throw new Error(
      'EnsureComponentWasEditedWith expects a "name" change — name is the only field this ' +
        'feature edits.',
    );
  }
  const newName = changes.name;
  return Task.where(
    d`#actor ensures the component was edited to "${newName}"`,
    Wait.until(ComponentsPage.componentNamed(newName), isVisible()),
  );
};

/**
 * Door-agnostic on purpose, the same way
 * `screenplay/bom-registration/edit-material.ts#EnsureMaterialWasNotEdited` is: this feature's
 * "جز ویرایش نشده باشد" step follows an API-driven attempt (access-denied) as well as two
 * UI-driven ones (missing/duplicate name), so rather than reading `LastResponse` it re-queries the
 * system and checks the one fact that matters regardless of door — the component
 * `theLastRegisteredComponent()` names is still exactly as it was.
 *
 * As in the register equivalent, the re-query is skipped when `LastResponse` already reports an
 * error (> 399) — the access-denied rule's API-driven attempt.
 */
export const EnsureComponentWasNotEdited = (): Task => {
  const target = theLastRegisteredComponent();
  return Task.where(
    d`#actor ensures "${target.name}" was not edited`,
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewComponentList(),
        Ensure.that(
          TheComponentList(),
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

/** The "اسم آن جز را پاک می کند" step: opens the edit form and clears the name field. */
export const AttemptToClearComponentName = (currentName: string): Task =>
  Task.where(
    d`#actor attempts to clear the name of "${currentName}"`,
    OpenEditComponentForm(currentName),
    Enter.theValue('').into(ComponentsPage.nameField()),
    Click.on(ComponentsPage.submitButton()),
    WaitForTheComponentFormToBeAnswered(),
  );

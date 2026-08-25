import {
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, isGreaterThan, isLessThan } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { ComponentsPage } from '../ui/components-page';
import {
  OpenNewComponentForm,
  WaitForTheComponentFormToBeAnswered,
} from './components-form';
import {
  NewComponentDetails,
  rememberRegisteredComponent,
  theAttempt,
} from './component-details';
import { TheComponentList, ViewComponentList } from './view-component-list';

const registerRequestBody = (details: NewComponentDetails) =>
  Question.fromObject({ name: details.name });

export const RegisterComponent = {
  /**
   * Registers a component through the real "new component" form — the UI door this feature's
   * top-level "ثبت می کند" scenarios drive, mirroring
   * `screenplay/bom-registration/register-material.ts#RegisterMaterial.using`.
   */
  using: (details: NewComponentDetails): Task =>
    Task.where(
      d`#actor registers a new component "${details.name}"`,
      OpenNewComponentForm(),
      Enter.theValue(details.name).into(ComponentsPage.nameField()),
      Click.on(ComponentsPage.submitButton()),
      WaitForTheComponentFormToBeAnswered(),
    ),

  /** The API door — used for background test-data setup and the access-denied "تلاش می کند" rule. */
  viaApiUsing: (details: NewComponentDetails): Task =>
    Task.where(
      d`#actor registers a new component "${details.name}" (via API)`,
      Send.a(PostRequest.to('components').with(registerRequestBody(details))),
    ),
};

const RememberTheRegisteredComponent = (name: string): Interaction =>
  Interaction.where(
    d`#actor remembers "${name}" as the target component`,
    async (actor) => {
      // Confirmed against `backend/src/modules/components/infrastructure/http/controllers/
      // component/component.controller.ts#register`: `POST /api/components` answers `201` with
      // `{ id }`.
      const body = await actor.answer(LastResponse.body<{ id: string }>());
      rememberRegisteredComponent({ id: body.id, name });
    },
  );

/**
 * Registers a component via the API and remembers it as "the last registered component"/"the
 * component named X" (`component-details.ts`), for scenarios that go on to edit or delete it —
 * possibly as a *different* actor than the one performing this task. Used for `Given`
 * (passive-voiced) preconditions only; the feature's active-voiced scenarios drive the UI instead.
 */
export const RegisterComponentAndRememberIt = (
  details: NewComponentDetails,
): Task =>
  Task.where(
    d`#actor registers "${details.name}" and remembers it as the target component`,
    RegisterComponent.viaApiUsing(details),
    RememberTheRegisteredComponent(details.name),
  );

/** Through the UI, assert what the visitor sees: the new component's name in the rendered list. */
export const EnsureComponentWasRegistered = (
  details: NewComponentDetails,
): Task =>
  Task.where(
    d`#actor ensures "${details.name}" was registered`,
    Wait.until(ComponentsPage.componentNamed(details.name), isVisible()),
  );

const CountOfComponentsNamed = (name: string): QuestionAdapter<number> =>
  Question.about(`the count of components named "${name}"`, async (actor) => {
    const components = await actor.answer(TheComponentList());
    return components.filter((component) => component.name === name).length;
  });

/**
 * Door-agnostic on purpose, mirroring
 * `screenplay/bom-registration/register-material.ts#EnsureNewMaterialWasNotRegistered`: this
 * feature's "جز جدیدی ثبت نشده باشد" step follows both a UI-driven attempt (missing/duplicate
 * name) and an API-driven one (access-denied), so rather than reading `LastResponse` — which the
 * UI-driven callers never populate — this re-queries the system and checks the invariant the
 * uniqueness rule actually protects: never more than one component sharing the attempted name.
 *
 * The re-query is skipped when `LastResponse` already reports an error (> 399): that's the
 * access-denied rule's API-driven attempt, whose failed response is the proof the re-query would
 * otherwise reconfirm — skipping it also avoids overwriting `LastResponse` with a GET's 200 before
 * the shared "پیغام خطای عدم دسترسی نشان داده شود" step reads the original attempt's 403 off it.
 */
export const EnsureNewComponentWasNotRegistered = (): Task => {
  const attempted = theAttempt<NewComponentDetails>();
  return Task.where(
    '#actor ensures a new component was not registered',
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewComponentList(),
        Ensure.that(CountOfComponentsNamed(attempted.name), isLessThan(2)),
      ),
  );
};

/**
 * Opens the "new component" form and drafts the details without submitting yet — the "اما ... را
 * خالی می گذارد" steps' shared shape, mirroring
 * `screenplay/bom-registration/register-material.ts#EnterNewMaterialDetails`.
 */
export const EnterNewComponentDetails = (details: NewComponentDetails): Task =>
  Task.where(
    '#actor enters new component details',
    OpenNewComponentForm(),
    Enter.theValue(details.name).into(ComponentsPage.nameField()),
  );

/**
 * The "اما اسم جز را خالی می گذارد" step: clears the name field of the already-open form (see
 * `EnterNewComponentDetails`) and submits.
 */
export const AttemptToRegisterLeavingNameEmpty = (): Task =>
  Task.where(
    '#actor attempts to register a new component leaving the name empty',
    Enter.theValue('').into(ComponentsPage.nameField()),
    Click.on(ComponentsPage.submitButton()),
    WaitForTheComponentFormToBeAnswered(),
  );

const EnsureComponentDialogErrorShown = (description: string): Task =>
  Task.where(
    description,
    Wait.until(ComponentsPage.dialogError(), isVisible()),
  );

export const EnsureComponentNameErrorShown = (): Task =>
  EnsureComponentDialogErrorShown(
    '#actor ensures the component-name error was shown',
  );

export const EnsureDuplicateComponentNameErrorShown = (): Task =>
  EnsureComponentDialogErrorShown(
    '#actor ensures the duplicate-component-name error was shown',
  );

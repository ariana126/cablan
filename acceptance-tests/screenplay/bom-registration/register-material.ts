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
import { MaterialsPage } from '../ui/materials-page';
import {
  OpenNewMaterialForm,
  WaitForTheMaterialFormToBeAnswered,
} from './materials-form';
import {
  NewMaterialDetails,
  rememberRegisteredMaterial,
  theAttempt,
} from './material-details';
import { TheMaterialList, ViewMaterialList } from './view-material-list';

const registerRequestBody = (details: NewMaterialDetails) =>
  Question.fromObject({ name: details.name });

export const RegisterMaterial = {
  /**
   * Registers a material through the real "new material" form — the UI door this feature's
   * top-level "ثبت می کند" scenarios drive (the dispatch this automation was written against
   * calls for a real browser here, this being the suite's first `screenplay/ui/`).
   */
  using: (details: NewMaterialDetails): Task =>
    Task.where(
      d`#actor registers a new material "${details.name}"`,
      OpenNewMaterialForm(),
      Enter.theValue(details.name).into(MaterialsPage.nameField()),
      Click.on(MaterialsPage.submitButton()),
      WaitForTheMaterialFormToBeAnswered(),
    ),

  /** The API door — used for background test-data setup and the access-denied "تلاش می کند" rule. */
  viaApiUsing: (details: NewMaterialDetails): Task =>
    Task.where(
      d`#actor registers a new material "${details.name}" (via API)`,
      Send.a(PostRequest.to('materials').with(registerRequestBody(details))),
    ),
};

const RememberTheRegisteredMaterial = (name: string): Interaction =>
  Interaction.where(
    d`#actor remembers "${name}" as the target material`,
    async (actor) => {
      // ASSUMPTION: `POST /api/materials` answers with a body carrying at least `id` — no
      // backend `materials` module exists yet at the time this was written.
      const body = await actor.answer(LastResponse.body<{ id: string }>());
      rememberRegisteredMaterial({ id: body.id, name });
    },
  );

/**
 * Registers a material via the API and remembers it as "the last registered material"/"the
 * material named X" (`material-details.ts`), for scenarios that go on to edit or delete it —
 * possibly as a *different* actor than the one performing this task, which is why the id is
 * captured from the response rather than left for the next step to work out. Used for `Given`
 * (passive-voiced) preconditions only; the feature's active-voiced scenarios drive the UI instead.
 */
export const RegisterMaterialAndRememberIt = (
  details: NewMaterialDetails,
): Task =>
  Task.where(
    d`#actor registers "${details.name}" and remembers it as the target material`,
    RegisterMaterial.viaApiUsing(details),
    RememberTheRegisteredMaterial(details.name),
  );

/** Through the UI, assert what the visitor sees: the new material's name in the rendered list. */
export const EnsureMaterialWasRegistered = (
  details: NewMaterialDetails,
): Task =>
  Task.where(
    d`#actor ensures "${details.name}" was registered`,
    Wait.until(MaterialsPage.materialNamed(details.name), isVisible()),
  );

const CountOfMaterialsNamed = (name: string): QuestionAdapter<number> =>
  Question.about(`the count of materials named "${name}"`, async (actor) => {
    const materials = await actor.answer(TheMaterialList());
    return materials.filter((material) => material.name === name).length;
  });

/**
 * Door-agnostic on purpose: this feature's "مواد اولیه جدیدی ثبت نشده باشد" step follows both a
 * UI-driven attempt (missing/duplicate name) and an API-driven one (access-denied), so rather than
 * reading `LastResponse` — which the UI-driven callers never populate, since their request went
 * through the browser, not `CallAnApi` — this re-queries the system and checks the invariant the
 * uniqueness rule actually protects: never more than one material sharing the attempted name.
 * That holds whether zero existed before (missing-name/access-denied) or one already did
 * (duplicate-name).
 *
 * The re-query is skipped when `LastResponse` already reports an error (> 399): that's the
 * access-denied rule's API-driven attempt, whose failed response is the proof the re-query would
 * otherwise reconfirm. Skipping it there matters, not just saves a call — re-querying calls
 * `Send.a(GetRequest...)` on the same actor's `CallAnApi` ability, which would overwrite
 * `LastResponse` with the GET's 200 before the shared "پیغام خطای عدم دسترسی نشان داده شود" step
 * (`step-definitions/common.steps.ts`) gets to read the original attempt's 403 off it.
 */
export const EnsureNewMaterialWasNotRegistered = (): Task => {
  const attempted = theAttempt<NewMaterialDetails>();
  return Task.where(
    '#actor ensures a new material was not registered',
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewMaterialList(),
        Ensure.that(CountOfMaterialsNamed(attempted.name), isLessThan(2)),
      ),
  );
};

/**
 * Opens the "new material" form and drafts the details without submitting yet — the "اما ... را
 * خالی می گذارد" steps' shared shape, mirroring
 * `screenplay/authentication/register-user.ts#EnterNewUserDetails`.
 */
export const EnterNewMaterialDetails = (details: NewMaterialDetails): Task =>
  Task.where(
    '#actor enters new material details',
    OpenNewMaterialForm(),
    Enter.theValue(details.name).into(MaterialsPage.nameField()),
  );

/**
 * The "اما اسم مواد اولیه را خالی می گذارد" step: clears the name field of the already-open form
 * (see `EnterNewMaterialDetails`) and submits.
 */
export const AttemptToRegisterLeavingNameEmpty = (): Task =>
  Task.where(
    '#actor attempts to register a new material leaving the name empty',
    Enter.theValue('').into(MaterialsPage.nameField()),
    Click.on(MaterialsPage.submitButton()),
    WaitForTheMaterialFormToBeAnswered(),
  );

const EnsureMaterialDialogErrorShown = (description: string): Task =>
  Task.where(description, Wait.until(MaterialsPage.dialogError(), isVisible()));

export const EnsureMaterialNameErrorShown = (): Task =>
  EnsureMaterialDialogErrorShown(
    '#actor ensures the material-name error was shown',
  );

export const EnsureDuplicateMaterialNameErrorShown = (): Task =>
  EnsureMaterialDialogErrorShown(
    '#actor ensures the duplicate-material-name error was shown',
  );

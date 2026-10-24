import {
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  not,
  property,
} from '@serenity-js/assertions';
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
import { withLatinDigits } from '../common/persian-digits';

const registerRequestBody = (details: NewMaterialDetails) =>
  Question.fromObject({ name: details.name, code: details.code });

/**
 * Types the code, then the name, into the open material form — the order the form shows them in.
 */
const FillInMaterialForm = (details: NewMaterialDetails): Task =>
  Task.where(
    d`#actor fills in the material form with code "${details.code}" and name "${details.name}"`,
    Enter.theValue(details.code).into(MaterialsPage.codeField()),
    Enter.theValue(details.name).into(MaterialsPage.nameField()),
  );

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
      FillInMaterialForm(details),
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

const RememberTheRegisteredMaterial = (
  details: NewMaterialDetails,
): Interaction =>
  Interaction.where(
    d`#actor remembers "${details.name}" as the target material`,
    async (actor) => {
      // ASSUMPTION: `POST /api/materials` answers with a body carrying at least `id` — no
      // backend `materials` module exists yet at the time this was written.
      const body = await actor.answer(LastResponse.body<{ id: string }>());
      rememberRegisteredMaterial({
        id: body.id,
        code: details.code,
        name: details.name,
      });
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
    RememberTheRegisteredMaterial(details),
  );

/** Through the UI, assert what the visitor sees: the new material's name in the rendered list. */
export const EnsureMaterialWasRegistered = (
  details: NewMaterialDetails,
): Task =>
  Task.where(
    d`#actor ensures "${details.name}" was registered`,
    Wait.until(MaterialsPage.materialNamed(details.name), isVisible()),
  );

/**
 * Door-agnostic on purpose: this feature's "مواد اولیه جدیدی ثبت نشده باشد" step follows both
 * UI-driven attempts (missing/duplicate name, missing/duplicate code) and an API-driven one
 * (access-denied), so rather than reading `LastResponse` — which the UI-driven callers never
 * populate, since their request went through the browser, not `CallAnApi` — this re-queries the
 * system and checks that no material carries exactly the attempted name AND code. Every attempt
 * pairs the field under test with a fresh value for the other one, so that pair can only exist if
 * the attempt itself got through: a duplicate-name attempt carries a fresh code, a duplicate-code
 * attempt a fresh name, and a blank-field attempt a blank (compared as `''`, however the read
 * model renders it) that no valid material has.
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
        Ensure.that(
          TheMaterialListAsEntered(),
          not(
            containAtLeastOneItemThat(
              and(
                property('name', equals(asEntered(attempted.name))),
                property('code', equals(asEntered(attempted.code))),
              ),
            ),
          ),
        ),
      ),
  );
};

/**
 * A value the way the comparison above reads it: trimmed, and with Persian/Arabic-Indic digits as
 * Latin ones — «M-۱۰۱» and «M-101» are the same code (issue #62), so a Persian-digit duplicate the
 * system wrongly let through must not pass for a different material.
 */
const asEntered = (value: string | null | undefined): string =>
  withLatinDigits((value ?? '').trim());

/** The material list with each blank/absent value read as `''`, the way a visitor enters one. */
const TheMaterialListAsEntered = (): QuestionAdapter<NewMaterialDetails[]> =>
  Question.about('the registered materials', async (actor) => {
    const materials = await actor.answer(TheMaterialList());
    return materials.map((material) => ({
      name: asEntered(material.name),
      code: asEntered(material.code),
    }));
  });

/**
 * «مواد اولیه جدیدی با <کد|اسم> «…» در سیستم ثبت شده باشد» — reads the materials back from
 * `GET materials` and looks for the one just attempted, stored with `field` equal to `expected`: the
 * value the system should have kept, with Latin digits even where the visitor typed Persian ones.
 * The material is identified by the attempt's *other* field, typed as given and with no digits.
 */
export const EnsureMaterialWasStoredWith = (
  attempt: NewMaterialDetails,
  field: keyof NewMaterialDetails,
  expected: string,
): Task => {
  const otherField: keyof NewMaterialDetails =
    field === 'code' ? 'name' : 'code';
  return Task.where(
    d`#actor ensures the new material was stored with ${field} "${expected}"`,
    ViewMaterialList(),
    Ensure.that(
      TheMaterialList(),
      containAtLeastOneItemThat(
        and(
          property(otherField, equals(attempt[otherField])),
          property(field, equals(expected)),
        ),
      ),
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
    FillInMaterialForm(details),
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

/**
 * The "اما کد مواد اولیه را خالی می گذارد" step: clears the code field of the already-open form
 * (see `EnterNewMaterialDetails`) and submits.
 */
export const AttemptToRegisterLeavingCodeEmpty = (): Task =>
  Task.where(
    '#actor attempts to register a new material leaving the code empty',
    Enter.theValue('').into(MaterialsPage.codeField()),
    Click.on(MaterialsPage.submitButton()),
    WaitForTheMaterialFormToBeAnswered(),
  );

/**
 * Through the UI, assert what the visitor sees: an error under the one field the rule is about.
 * Visibility only, never wording — the same as every other form error in this suite.
 */
export const EnsureMaterialNameErrorShown = (): Task =>
  Task.where(
    '#actor ensures the material-name error was shown',
    Wait.until(MaterialsPage.nameError(), isVisible()),
  );

export const EnsureDuplicateMaterialNameErrorShown = (): Task =>
  Task.where(
    '#actor ensures the duplicate-material-name error was shown',
    Wait.until(MaterialsPage.nameError(), isVisible()),
  );

export const EnsureMaterialCodeErrorShown = (): Task =>
  Task.where(
    '#actor ensures the material-code error was shown',
    Wait.until(MaterialsPage.codeError(), isVisible()),
  );

export const EnsureDuplicateMaterialCodeErrorShown = (): Task =>
  Task.where(
    '#actor ensures the duplicate-material-code error was shown',
    Wait.until(MaterialsPage.codeError(), isVisible()),
  );

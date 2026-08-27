import {
  Answerable,
  AnswersQuestions,
  d,
  Interaction,
  notes,
  Question,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
import { isGreaterThan, isTrue } from '@serenity-js/assertions';
import { By, Click, isVisible, Navigate, PageElement } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';

/**
 * Establishes a real browser session before the daily BOMs page is ever navigated to — mirrors
 * `screenplay/bom-registration/standard-bom-form.ts#EstablishBrowserSession`; see that module's
 * comment for the full reasoning.
 */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the daily BOMs UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/** The "locate task" every UI-driving daily BOM task below starts from. ASSUMPTION: route "/boms". */
export const LocateBomsPage = (): Task =>
  Task.where(
    '#actor locates the daily BOMs page',
    EstablishBrowserSession(),
    Navigate.to('/boms'),
    Wait.until(BomsPage.heading(), isVisible()),
  );

export const OpenNewBomForm = (): Task =>
  Task.where(
    '#actor opens the new daily BOM form',
    LocateBomsPage(),
    Click.on(BomsPage.addButton()),
    Wait.until(BomsPage.standardBomSelect(), isVisible()),
  );

export const OpenEditBomForm = (orderNumber: string): Task =>
  Task.where(
    `#actor opens the edit form for the daily BOM "${orderNumber}"`,
    LocateBomsPage(),
    Wait.until(BomsPage.editButton(orderNumber), isVisible()),
    Click.on(BomsPage.editButton(orderNumber)),
    Wait.until(BomsPage.orderNumberField(), isVisible()),
  );

export const OpenDeleteConfirmation = (orderNumber: string): Task =>
  Task.where(
    `#actor opens the delete confirmation for the daily BOM "${orderNumber}"`,
    LocateBomsPage(),
    Wait.until(BomsPage.deleteButton(orderNumber), isVisible()),
    Click.on(BomsPage.deleteButton(orderNumber)),
    Wait.until(BomsPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Whether the daily BOM form is currently showing an error — either a field-level `<mat-error>`
 * (`BomsPage.formErrors()`) or the form's own root-level one (`BomsPage.formError()`). Both are
 * real, distinct surfaces this form uses (see `BomsPage.formError()`'s own comment for why one
 * rejection needs the second), so anything that waits for "an error was shown" has to check both.
 *
 * Field errors are checked by PRESENCE (`count() > 0`), not `.isVisible()`: `mat-dialog-content`
 * scrolls (`overflow-y: auto; max-height: 32rem` — `bom-form-dialog.scss`), and a composition with
 * enough materials can genuinely push one out of the dialog's visible scrollport. Confirmed
 * empirically against the real page: a material's `<mat-error>` element that's scrolled out still
 * has real, non-zero layout (`getBoundingClientRect`, `display: block`, `visibility: visible`) —
 * it's `count() > 0`-present — but `@serenity-js/web`'s `isVisible()` additionally checks
 * `document.elementFromPoint()` at the element's centre to catch occlusion, and an element clipped
 * by an `overflow: auto` ancestor's scrollport fails that check even though it's genuinely
 * rendered. The root error (`<p class="form-error" role="alert">`) sits outside that scrollable
 * area — see `BomsPage.formError()`'s own comment — so it's never scrolled out, and checking its
 * `.isVisible()` is both correct and necessary (it's how a rejection with no field to attach to is
 * told apart from no rejection at all).
 */
const aFormErrorIsVisible = async (
  actor: AnswersQuestions & UsesAbilities,
): Promise<boolean> => {
  const fieldErrorCount = await actor.answer(BomsPage.formErrors().count());
  if (fieldErrorCount > 0) {
    return true;
  }
  const rootError = await actor.answer(BomsPage.formError());
  return rootError.isVisible();
};

/**
 * `aFormErrorIsVisible` above, wrapped as a `Question` so it can be `Wait.until`-ed on directly —
 * used by `EnsureInvalidMaterialWeightErrorShown`, whose error can land on EITHER surface
 * depending on which invalid-weight rule triggered it: an emptied weight has "no reliable field
 * path" (see `BomsPage.formError()`'s own comment) and falls through to the root error, while a
 * weight explicitly set to zero is caught by the client-side `min()` validator and renders as a
 * per-material `<mat-error>` instead. The narrower `EnsureBomFormErrorShown`/`formErrors()`-only
 * check below only covers the second case, so it can't be reused here.
 */
const AFormErrorIsVisible = () =>
  Question.about('whether a form error is visible', aFormErrorIsVisible);

/**
 * Submitting a form means clicking *and* waiting for the answer (this suite's waiting convention):
 * polls until either the dialog has closed — the order number field is no longer visible, meaning
 * the request succeeded — or the site has told the visitor what was wrong (a field-level or
 * root-level error became visible). Mirrors
 * `screenplay/bom-registration/standard-bom-form.ts#WaitForTheStandardBomFormToBeAnswered`.
 */
export const WaitForTheBomFormToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the daily BOM form to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const orderNumberField = await actor.answer(
          BomsPage.orderNumberField(),
        );
        if (!(await orderNumberField.isVisible())) {
          return;
        }
        if (await aFormErrorIsVisible(actor)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/** Same idea as `WaitForTheBomFormToBeAnswered`, for the delete confirmation dialog. */
export const WaitForTheDeleteConfirmationToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the delete confirmation to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const confirmButton = await actor.answer(
          BomsPage.confirmDeleteButton(),
        );
        if (!(await confirmButton.isVisible())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/**
 * Picks an option off an already-open `mat-select` by text it CONTAINS — the mechanism
 * `BomsPage.standardBomSelect()` is driven through. A module-owned copy of
 * `standard-bom-form.ts#SelectOption`, not a shared import: each feature area owns its own small
 * form-driving helpers independently, the same way the backend's `boms` module owns its own
 * `Weight` value object rather than reusing `standard-boms`' one.
 *
 * Deliberately **not** `By.role('option', { name: optionText })`: the real markup
 * (`bom-form-dialog.ts`) renders each option's accessible name as `"«miCode» — «brand»"`
 * (e.g. `"0001 — لگراند"`), and this helper is only ever handed the MI code — a prefix of that
 * name, never the whole thing. That looks like a job for `{ exact: false }`, but it isn't one:
 * `@serenity-js/playwright`'s `By.role` compiles to Playwright's raw `role=` selector-engine
 * string, whose `[name=…]` attribute is *always* a whole-string match — `exact` only toggles its
 * `i`/`s` (case) suffix, never turns it into a substring search the way the higher-level
 * `page.getByRole()` API does. (Confirmed empirically against the real page: `role=option[name="…
 * "i]` with a prefix never matches, `page.getByRole('option', {name: '…'})` does.) `mat-option` is
 * Angular Material's own host element selector, so `:has-text()` — a genuine substring match, case
 * -insensitive — reaches the same option by its rendered text instead.
 */
export const SelectOption = (
  comboBox: Answerable<PageElement>,
  optionText: string,
): Task =>
  Task.where(
    d`#actor selects "${optionText}"`,
    Click.on(comboBox),
    Click.on(
      PageElement.located(By.cssContainingText('mat-option', optionText)),
    ),
  );

const EnsureBomFormErrorShown = (description: string): Task =>
  Task.where(
    description,
    Wait.until(BomsPage.formErrors().count(), isGreaterThan(0)),
  );

/** "پیغام خطای شماره سفارش نشان داده شود" */
export const EnsureOrderNumberErrorShown = (): Task =>
  EnsureBomFormErrorShown('#actor ensures the order-number error was shown');

/** "پیغام خطای شماره ردیابی نشان داده شود" */
export const EnsureTrackingNumberErrorShown = (): Task =>
  EnsureBomFormErrorShown('#actor ensures the tracking-number error was shown');

/**
 * "پیغام خطای وزن مواد اولیه نامعتبر نشان داده شود" / "... داده شود" — one shared error message
 * covers both "left empty" and "set to zero", per the dispatch this automation was written
 * against, so both rules' negative examples reuse this single task.
 */
export const EnsureInvalidMaterialWeightErrorShown = (): Task =>
  Task.where(
    '#actor ensures the invalid-material-weight error was shown',
    Wait.until(AFormErrorIsVisible(), isTrue()),
  );

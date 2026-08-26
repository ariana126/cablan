import {
  Answerable,
  d,
  Interaction,
  notes,
  Task,
  Wait,
} from '@serenity-js/core';
import { isGreaterThan } from '@serenity-js/assertions';
import { By, Click, isVisible, Navigate, PageElement } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';

/**
 * Establishes a real browser session before the standard BOMs page is ever navigated to — mirrors
 * `screenplay/bom-registration/products-form.ts#EstablishBrowserSession`; see that module's comment
 * for the full reasoning.
 */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the standard BOMs UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/** The "locate task" every UI-driving standard BOM task below starts from. */
export const LocateStandardBomsPage = (): Task =>
  Task.where(
    '#actor locates the standard BOMs page',
    EstablishBrowserSession(),
    Navigate.to('/standard-boms'),
    Wait.until(StandardBomsPage.heading(), isVisible()),
  );

export const OpenNewStandardBomForm = (): Task =>
  Task.where(
    '#actor opens the new standard BOM form',
    LocateStandardBomsPage(),
    Click.on(StandardBomsPage.addButton()),
    Wait.until(StandardBomsPage.productSelect(), isVisible()),
  );

export const OpenEditStandardBomForm = (currentMiCode: string): Task =>
  Task.where(
    d`#actor opens the edit form for standard BOM "${currentMiCode}"`,
    LocateStandardBomsPage(),
    Wait.until(StandardBomsPage.editButton(currentMiCode), isVisible()),
    Click.on(StandardBomsPage.editButton(currentMiCode)),
    Wait.until(StandardBomsPage.miCodeField(), isVisible()),
  );

export const OpenDeleteConfirmation = (miCode: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation for standard BOM "${miCode}"`,
    LocateStandardBomsPage(),
    Wait.until(StandardBomsPage.deleteButton(miCode), isVisible()),
    Click.on(StandardBomsPage.deleteButton(miCode)),
    Wait.until(StandardBomsPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Submitting a form means clicking *and* waiting for the answer (this suite's waiting convention):
 * polls until either the dialog has closed — the MI code field is no longer visible, meaning the
 * request succeeded — or the site has told the visitor what was wrong (a field error became
 * visible). Mirrors `screenplay/bom-registration/products-form.ts#WaitForTheProductFormToBeAnswered`.
 */
export const WaitForTheStandardBomFormToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the standard BOM form to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const miCodeField = await actor.answer(StandardBomsPage.miCodeField());
        if (!(await miCodeField.isVisible())) {
          return;
        }
        const errorCount = await actor.answer(
          StandardBomsPage.formErrors().count(),
        );
        if (errorCount > 0) {
          const firstError = await actor.answer(
            StandardBomsPage.formErrors().first(),
          );
          if (await firstError.isVisible()) {
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/** Same idea as `WaitForTheStandardBomFormToBeAnswered`, for the delete confirmation dialog. */
export const WaitForTheDeleteConfirmationToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the delete confirmation to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const confirmButton = await actor.answer(
          StandardBomsPage.confirmDeleteButton(),
        );
        if (!(await confirmButton.isVisible())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/**
 * Picks an option off an already-open `mat-select` by its visible text — the mechanism
 * `productSelect()`/`activeToggle()` are both driven through. ASSUMPTION: Angular Material renders
 * each option with an implicit ARIA `option` role, the same way a native `<select>`'s `<option>`s
 * do.
 */
export const SelectOption = (
  comboBox: Answerable<PageElement>,
  optionText: string,
): Task =>
  Task.where(
    d`#actor selects "${optionText}"`,
    Click.on(comboBox),
    Click.on(
      PageElement.located(By.role('option', { name: optionText, exact: true })),
    ),
  );

const EnsureStandardBomFormErrorShown = (description: string): Task =>
  Task.where(
    description,
    Wait.until(StandardBomsPage.formErrors().count(), isGreaterThan(0)),
  );

/** "پیغام خطای کد MI نشان داده شود" / "پیغام خطای کد MI تکراری نشان داده شود" */
export const EnsureMiCodeErrorShown = (): Task =>
  EnsureStandardBomFormErrorShown('#actor ensures the MI-code error was shown');

export const EnsureDuplicateMiCodeErrorShown = (): Task =>
  EnsureStandardBomFormErrorShown(
    '#actor ensures the duplicate-MI-code error was shown',
  );

/** "پیغام خطای برند نشان داده شود" */
export const EnsureBrandErrorShown = (): Task =>
  EnsureStandardBomFormErrorShown('#actor ensures the brand error was shown');

/** "پیغام خطای متراژ استاندارد نشان داده شود" */
export const EnsureStandardLengthErrorShown = (): Task =>
  EnsureStandardBomFormErrorShown(
    '#actor ensures the standard-length error was shown',
  );

/** "پیغام خطای عدم تعیین وضعیت فعال بودن نشان داده شود" */
export const EnsureActiveNotSpecifiedErrorShown = (): Task =>
  EnsureStandardBomFormErrorShown(
    '#actor ensures the active-not-specified error was shown',
  );

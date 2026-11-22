import { Answerable, d, Interaction, notes, Task } from '@serenity-js/core';
import { POLLING_INTERVAL_MS, WaitUntil } from '../common/polling';
import { isGreaterThan } from '@serenity-js/assertions';
import { By, Click, isVisible, Navigate, PageElement } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import { ChooseRowAction } from '../common/row-actions';
import { AuthNotes, LogIn } from '../common/login';
import { ChooseFromSearchableSelect } from '../common/searchable-select';
import { PersonaCredentialsNotes } from '../common/personas';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { ProductSummary } from './view-product-list';
import { freshWeightInGrams } from './standard-bom-details';
import {
  theDialogWasNotAnswered,
  theOpenDialogShowsAnAlert,
} from '../common/dialog-answer';

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
    WaitUntil(StandardBomsPage.heading(), isVisible()),
  );

export const OpenNewStandardBomForm = (): Task =>
  Task.where(
    '#actor opens the new standard BOM form',
    LocateStandardBomsPage(),
    Click.on(StandardBomsPage.addButton()),
    WaitUntil(StandardBomsPage.productSelect(), isVisible()),
  );

export const OpenEditStandardBomForm = (currentMiCode: string): Task =>
  Task.where(
    d`#actor opens the edit form for standard BOM "${currentMiCode}"`,
    LocateStandardBomsPage(),
    ChooseRowAction(currentMiCode, 'edit'),
    WaitUntil(StandardBomsPage.miCodeField(), isVisible()),
  );

export const OpenDeleteConfirmation = (miCode: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation for standard BOM "${miCode}"`,
    LocateStandardBomsPage(),
    ChooseRowAction(miCode, 'delete'),
    WaitUntil(StandardBomsPage.confirmDeleteButton(), isVisible()),
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
        if (await theOpenDialogShowsAnAlert(actor)) {
          return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, POLLING_INTERVAL_MS),
        );
      } while (Date.now() < deadline);
      throw theDialogWasNotAnswered('standard BOM dialog');
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
        if (await theOpenDialogShowsAnAlert(actor)) {
          return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, POLLING_INTERVAL_MS),
        );
      } while (Date.now() < deadline);
      throw theDialogWasNotAnswered('standard BOM dialog');
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
    WaitUntil(StandardBomsPage.formErrors().count(), isGreaterThan(0)),
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

/**
 * Chooses the product a new standard BOM is based on — a searchable autocomplete combobox, so the
 * product's name is typed to narrow the list and the matching option is clicked.
 */
export const SearchAndSelectProduct = (
  comboBox: Answerable<PageElement>,
  productName: string,
): Task =>
  ChooseFromSearchableSelect(
    comboBox,
    productName,
    PageElement.located(By.role('option', { name: productName, exact: true })),
  );

/**
 * The same fill, for a product known only by its name — issue #128's standard BOM form, opened from
 * the offer right after the product was registered through the browser, so no id was ever noted.
 */
export const FillInTheStandardWeightsOfProductNamed = (
  productName: string,
): Interaction =>
  FillInTheStandardWeightsOfTheProductWhere(
    (candidate) => candidate.name === productName,
    `"${productName}"`,
  );

/**
 * Fills in a fresh standard weight for every material of the product `isTheProduct` picks out of
 * `GET products`, in the open standard BOM form — the form reaches a weight field only by its
 * material's name (`StandardBomsPage.weightField`).
 */
export const FillInTheStandardWeightsOfTheProductWhere = (
  isTheProduct: (candidate: ProductSummary) => boolean,
  described: string,
): Interaction =>
  Interaction.where(
    '#actor fills in a standard weight for each cloned material',
    async (actor) => {
      await Send.a(GetRequest.to('products')).performAs(actor);
      const products = await actor.answer(
        LastResponse.body<ProductSummary[]>(),
      );
      const found = products.find(isTheProduct);
      if (!found) {
        throw new Error(
          `Product ${described} was not found while filling in its cloned material weights.`,
        );
      }
      for (const component of found.components) {
        for (const material of component.materials) {
          const weightField = await actor.answer(
            StandardBomsPage.weightField(material.name),
          );
          await weightField.enterValue(`${freshWeightInGrams()}`);
        }
      }
    },
  );

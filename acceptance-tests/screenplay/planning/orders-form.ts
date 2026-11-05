import {
  AnswersQuestions,
  d,
  Interaction,
  notes,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
import { isPresent } from '@serenity-js/assertions';
import {
  Click,
  isEnabled,
  isVisible,
  Key,
  Navigate,
  Press,
} from '@serenity-js/web';
import { OrdersPage } from '../ui/orders-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import {
  theDialogWasNotAnswered,
  theOpenDialogShowsAnAlert,
} from '../common/dialog-answer';

/**
 * The browser half of «سفارشات» (issue #101): finding the page, opening its dialogs, choosing MI
 * codes and waiting for each dialog's answer. Every UI order task in `screenplay/planning/` is built
 * from these; the locators are `ui/orders-page.ts`'s.
 */

/** Signs the actor in through `/login` with the persona credentials «… وارد سیستم شده باشد» noted —
 * the same way `bom-registration/bom-form.ts` reaches `/boms`. */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the orders page',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/** The locate task every UI order task starts from: `/orders`, waited for by its heading. */
export const LocateOrdersPage = (): Task =>
  Task.where(
    '#actor locates the orders page',
    EstablishBrowserSession(),
    Navigate.to('/orders'),
    Wait.until(OrdersPage.heading(), isVisible()),
  );

export const OpenNewOrderForm = (): Task =>
  Task.where(
    '#actor opens the new order form',
    LocateOrdersPage(),
    Click.on(OrdersPage.defineButton()),
    Wait.until(OrdersPage.orderNumberField(), isVisible()),
  );

/** Clicks one of `orderNumber`'s row buttons, once its row has rendered. */
const ClickInTheRowOf = (
  orderNumber: string,
  button: ReturnType<typeof OrdersPage.editButton>,
  label: string,
): Task =>
  Task.where(
    d`#actor chooses «${label}» for order "${orderNumber}"`,
    Wait.until(OrdersPage.rowOf(orderNumber), isVisible()),
    Click.on(button.of(OrdersPage.rowOf(orderNumber))),
  );

export const OpenEditOrderForm = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the edit form of order "${orderNumber}"`,
    LocateOrdersPage(),
    ClickInTheRowOf(orderNumber, OrdersPage.editButton(), 'ویرایش'),
    Wait.until(OrdersPage.orderNumberField(), isVisible()),
  );

export const OpenAddMiCodeForm = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the add-MI-code form of order "${orderNumber}"`,
    LocateOrdersPage(),
    ClickInTheRowOf(orderNumber, OrdersPage.addMiCodeButton(), 'افزودن کد MI'),
    Wait.until(OrdersPage.miCodeSelect(), isVisible()),
  );

export const OpenDeleteOrderConfirmation = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation of order "${orderNumber}"`,
    LocateOrdersPage(),
    ClickInTheRowOf(orderNumber, OrdersPage.deleteButton(), 'حذف'),
    Wait.until(OrdersPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Clicks each of `miCodes` in the open multiple select «کدهای MI» — a click toggles an option, so
 * this both adds and removes — then closes its panel with Escape, which closes the select's overlay
 * only: the CDK sends a key to the topmost overlay, never to the dialog under it.
 */
export const ToggleMiCodes = (miCodes: string[]): Task =>
  Task.where(
    d`#actor toggles MI codes ${miCodes.join(', ')}`,
    Wait.until(OrdersPage.miCodesSelect(), isEnabled()),
    Click.on(OrdersPage.miCodesSelect()),
    ...miCodes.flatMap((miCode) => [
      Wait.until(OrdersPage.miCodeOption(miCode), isPresent()),
      Click.on(OrdersPage.miCodeOption(miCode)),
    ]),
    Press.the(Key.Escape),
  );

/**
 * Picks `miCode` in the add dialog's single select «کد MI». Like the daily-BOM form's
 * (`bom-form.ts#ChooseMiCode`), a select whose options are still loading refuses to open, so it
 * waits until the select is enabled and the option is there.
 */
export const ChooseTheMiCodeToAdd = (miCode: string): Task =>
  Task.where(
    d`#actor chooses MI code "${miCode}" to add`,
    Wait.until(OrdersPage.miCodeSelect(), isEnabled()),
    Click.on(OrdersPage.miCodeSelect()),
    Wait.until(OrdersPage.miCodeOption(miCode), isPresent()),
    Click.on(OrdersPage.miCodeOption(miCode)),
  );

/**
 * Whether the order dialog has answered: every dialog has closed (accepted), or the open one shows
 * a field error or its alert banner (refused). Shared with the correction confirmation's "if asked"
 * poll (`common/correction-confirmation.ts#ConfirmTheCorrectionIfAsked`).
 */
export const theOrderDialogHasAnswered = async (
  actor: AnswersQuestions & UsesAbilities,
): Promise<boolean> => {
  if ((await actor.answer(OrdersPage.openDialogs().count())) === 0) {
    return true;
  }
  if ((await actor.answer(OrdersPage.formErrors().count())) > 0) {
    return true;
  }
  return theOpenDialogShowsAnAlert(actor);
};

/** Submitting means clicking *and* waiting for the answer; throws when none came within 5 s. */
export const WaitForTheOrderDialogToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the order dialog to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        if (await theOrderDialogHasAnswered(actor)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
      throw theDialogWasNotAnswered('order dialog');
    },
  );

export const SubmitTheOrderForm = (): Task =>
  Task.where(
    '#actor submits the order form',
    Click.on(OrdersPage.submitButton()),
    WaitForTheOrderDialogToBeAnswered(),
  );

/**
 * Submits the edit and leaves the dialog where the site left it — for the System Admin's
 * renumbering of an order in use, where the answer is the correction confirmation opening over the
 * edit dialog rather than the dialog closing or refusing.
 */
export const SubmitTheOrderEdit = (): Task =>
  Task.where(
    '#actor submits the order edit',
    Click.on(OrdersPage.submitButton()),
  );

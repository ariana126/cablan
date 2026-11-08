import {
  AnswersQuestions,
  d,
  Interaction,
  notes,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
import { isPresent, not } from '@serenity-js/assertions';
import { Click, Enter, isEnabled, isVisible, Navigate } from '@serenity-js/web';
import { OrdersPage } from '../ui/orders-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import {
  theDialogWasNotAnswered,
  theOpenDialogShowsAnAlert,
} from '../common/dialog-answer';

/**
 * The browser half of «سفارشات» (issue #101, reworked by #111): finding the page, opening an
 * order's details panel and the dialogs its actions open, picking MI codes from the autocompletes
 * and waiting for each dialog's answer. Every UI order task in `screenplay/planning/` is built
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

/**
 * Opens `orderNumber`'s details panel: searches for the order (so it is near the top of the list,
 * however many orders there are), clicks the details button in its number cell and waits for the
 * panel. Every action on an order lives in that panel since issue #111.
 *
 * The search box is waited for as present, never visible: while it is empty and unfocused, its
 * Material label lies over the input's centre and takes pointer events (`pointer-events: all`), so
 * `isVisible()`'s hit-test finds the label and never reports the input visible.
 */
const OpenTheDetailsOf = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the details of order "${orderNumber}"`,
    Wait.until(OrdersPage.searchBox(), isPresent()),
    Enter.theValue(orderNumber).into(OrdersPage.searchBox()),
    Wait.until(OrdersPage.detailsOpener(orderNumber), isPresent()),
    Click.on(OrdersPage.detailsOpener(orderNumber)),
    Wait.until(OrdersPage.details(orderNumber), isPresent()),
  );

/** Chooses one of the details panel's actions. The panel may sit below the list on a narrow
 * viewport, so it is waited for as present and enabled, not visible; `Click.on` scrolls to it. */
const ChooseInTheDetailsOf = (
  orderNumber: string,
  action: ReturnType<typeof OrdersPage.editButtonOf>,
  label: string,
): Task =>
  Task.where(
    d`#actor chooses «${label}» for order "${orderNumber}"`,
    OpenTheDetailsOf(orderNumber),
    Wait.until(action, isEnabled()),
    Click.on(action),
  );

export const OpenEditOrderForm = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the edit form of order "${orderNumber}"`,
    LocateOrdersPage(),
    ChooseInTheDetailsOf(
      orderNumber,
      OrdersPage.editButtonOf(orderNumber),
      'ویرایش',
    ),
    Wait.until(OrdersPage.orderNumberField(), isVisible()),
  );

export const OpenAddMiCodeForm = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the add-MI-code form of order "${orderNumber}"`,
    LocateOrdersPage(),
    ChooseInTheDetailsOf(
      orderNumber,
      OrdersPage.addMiCodeButtonOf(orderNumber),
      'افزودن کد MI',
    ),
    // Present, not visible: an empty, unfocused field's label covers its centre (see above).
    Wait.until(OrdersPage.miCodeInput(), isPresent()),
  );

export const OpenDeleteOrderConfirmation = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation of order "${orderNumber}"`,
    LocateOrdersPage(),
    ChooseInTheDetailsOf(
      orderNumber,
      OrdersPage.deleteButtonOf(orderNumber),
      'حذف',
    ),
    Wait.until(OrdersPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Picks `miCode` from an open dialog's MI-code autocomplete: types the code, then clicks the option
 * that starts with it once the panel offers it. Clicking an option closes the panel itself, so no
 * Escape is pressed — with no overlay above it, Escape would close the dialog.
 */
const PickMiCodeIn = (
  input: ReturnType<typeof OrdersPage.miCodeInput>,
  miCode: string,
): Task =>
  Task.where(
    d`#actor picks MI code "${miCode}"`,
    Wait.until(input, isEnabled()),
    Enter.theValue(miCode).into(input),
    Wait.until(OrdersPage.miCodeOption(miCode), isPresent()),
    Click.on(OrdersPage.miCodeOption(miCode)),
  );

/** Adds each of `miCodes` to the define/edit dialog's «کدهای MI» chip grid, waiting for its chip. */
export const ChooseMiCodes = (miCodes: string[]): Task =>
  Task.where(
    d`#actor chooses MI codes ${miCodes.join(', ')}`,
    ...miCodes.flatMap((miCode) => [
      PickMiCodeIn(OrdersPage.miCodesInput(), miCode),
      Wait.until(OrdersPage.removeMiCodeButton(miCode), isPresent()),
    ]),
  );

/** Takes each of `miCodes` off the define/edit dialog's chip grid with its «برداشتن <code>». */
export const RemoveMiCodes = (miCodes: string[]): Task =>
  Task.where(
    d`#actor removes MI codes ${miCodes.join(', ')}`,
    ...miCodes.flatMap((miCode) => [
      Wait.until(OrdersPage.removeMiCodeButton(miCode), isPresent()),
      Click.on(OrdersPage.removeMiCodeButton(miCode)),
      Wait.until(OrdersPage.removeMiCodeButton(miCode), not(isPresent())),
    ]),
  );

/** Picks `miCode` in the add dialog's single autocomplete «کد MI». */
export const ChooseTheMiCodeToAdd = (miCode: string): Task =>
  Task.where(
    d`#actor chooses MI code "${miCode}" to add`,
    PickMiCodeIn(OrdersPage.miCodeInput(), miCode),
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

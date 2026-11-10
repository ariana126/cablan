import {
  AnswersQuestions,
  d,
  Interaction,
  notes,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
import { equals, isPresent, not } from '@serenity-js/assertions';
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
 * order's details dialog and the dialogs its actions open, picking MI codes from the autocompletes
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
 * Closes whatever order's details dialog is open (its «بستن»), and waits until no dialog is left —
 * an open dialog hides the page behind it from role locators, the search box included. The details
 * reopen by themselves after a saved or cancelled action (issue #114), so a task reaching for the
 * page must not assume they are shut. Nothing to do on a freshly loaded page.
 */
const CloseTheOrderDetailsIfOpen = (): Interaction =>
  Interaction.where(
    '#actor closes the order details if they are open',
    async (actor) => {
      if ((await actor.answer(OrdersPage.openDetails().count())) > 0) {
        await Click.on(OrdersPage.closeDetailsButton()).performAs(actor);
      }
      await Wait.until(OrdersPage.openDialogs().count(), equals(0)).performAs(
        actor,
      );
    },
  );

/**
 * Opens `orderNumber`'s details dialog: searches for the order (so it is near the top of the list,
 * however many orders there are), clicks the details button in its number cell and waits for the
 * dialog. Every action on an order lives in that dialog since issue #114 (a panel since #111).
 *
 * The search box is waited for as present, never visible: while it is empty and unfocused, its
 * Material label lies over the input's centre and takes pointer events (`pointer-events: all`), so
 * `isVisible()`'s hit-test finds the label and never reports the input visible.
 */
const OpenTheDetailsOf = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the details of order "${orderNumber}"`,
    CloseTheOrderDetailsIfOpen(),
    Wait.until(OrdersPage.searchBox(), isPresent()),
    Enter.theValue(orderNumber).into(OrdersPage.searchBox()),
    Wait.until(OrdersPage.detailsOpener(orderNumber), isPresent()),
    Click.on(OrdersPage.detailsOpener(orderNumber)),
    Wait.until(OrdersPage.details(orderNumber), isPresent()),
  );

/**
 * Chooses one of the details dialog's actions, waited for as present and enabled (not visible — a
 * long MI-code list may push the footer out of a short viewport; `Click.on` scrolls to it). The
 * details close and the action's own dialog takes their place: waiting for them to be gone is what
 * keeps «حذف» of the confirmation from being confused with the details' own «حذف».
 */
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
    Wait.until(OrdersPage.details(orderNumber), not(isPresent())),
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
 * How many dialogs other than an order's details are open — the action dialogs (define, edit, add
 * an MI code, confirm a deletion, the correction confirmation).
 */
const openActionDialogs = async (
  actor: AnswersQuestions & UsesAbilities,
): Promise<number> =>
  (await actor.answer(OrdersPage.openDialogs().count())) -
  (await actor.answer(OrdersPage.openDetails().count()));

/**
 * Whether the order dialog has answered: no action dialog is left (accepted, or cancelled — the
 * order's details may already have reopened by themselves, issue #114), or the open one shows a
 * field error or its alert banner (refused). Shared with the correction confirmation's "if asked"
 * poll (`common/correction-confirmation.ts#ConfirmTheCorrectionIfAsked`).
 */
export const theOrderDialogHasAnswered = async (
  actor: AnswersQuestions & UsesAbilities,
): Promise<boolean> => {
  if ((await openActionDialogs(actor)) === 0) {
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

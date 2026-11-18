import {
  AnswersQuestions,
  Interaction,
  Task,
  UsesAbilities,
} from '@serenity-js/core';
import { POLLING_INTERVAL_MS, WaitUntil } from './polling';
import { isPresent, not } from '@serenity-js/assertions';
import { Click, isVisible } from '@serenity-js/web';
import { CorrectionConfirmationDialog } from '../ui/correction-confirmation-dialog';
import { theOpenDialogShowsAnAlert } from './dialog-answer';

/**
 * Issue #110's one exception to issue #94's rule: the System Admin may correct the name (and a
 * material's code) of a record other records use, the correction carried into every related record
 * and snapshot — but only once they confirm it. The Gherkin says «… و اعمال آن در اطلاعات و سوابق
 * مرتبط را تایید می کند» for the confirmation given and «… اما … را تایید نمی کند» for it withheld.
 *
 * Over HTTP the confirmation is one optional flag on the record's ordinary edit route; without it
 * (or for anyone else) the edit is issue #94's 409 `record-has-dependents`. In the browser that 409
 * is what opens the confirmation dialog (`ui/correction-confirmation-dialog.ts`) over the still
 * open edit dialog. These tasks are the browser half, to be performed right after the edit form was
 * submitted; each record's edit task then waits for its own form's answer.
 */

/** The flag a correction is sent with over the API — `docs/superpowers/plans/2026-11-04-…`. */
export const withTheCorrectionApplied = <T extends object>(
  body: T,
): T & { applyToRelatedRecords: true } => ({
  ...body,
  applyToRelatedRecords: true,
});

/** «… و اعمال آن … را تایید می کند»: the confirmation must be asked; «تایید», then it closes. */
export const ConfirmTheCorrection = (): Task =>
  Task.where(
    '#actor confirms applying the correction to every related record',
    WaitUntil(CorrectionConfirmationDialog.dialog(), isVisible()),
    Click.on(CorrectionConfirmationDialog.confirmButton()),
    WaitUntil(CorrectionConfirmationDialog.dialog(), not(isPresent())),
  );

/** «… اما اعمال آن … را تایید نمی کند»: the confirmation must be asked; «انصراف», then it closes. */
export const DeclineTheCorrection = (): Task =>
  Task.where(
    '#actor declines applying the correction to the related records',
    WaitUntil(CorrectionConfirmationDialog.dialog(), isVisible()),
    Click.on(CorrectionConfirmationDialog.cancelButton()),
    WaitUntil(CorrectionConfirmationDialog.dialog(), not(isPresent())),
  );

/**
 * The same confirmation, given *if* it is asked — for a correction the site may refuse before it
 * ever asks. The design runs uniqueness rules "before anything is written" but does not pin whether
 * that comes before or after the dependents check, so a duplicate code may be refused at once
 * (the edit dialog says so) or only after the confirmation (the re-sent edit is refused). Polls
 * until the confirmation is **present** (then waits for it to be visible, confirms it and waits for
 * it to close) or, with no confirmation in the DOM at all, `formHasAnswered` says the edit dialog
 * already closed or showed what was wrong — never judging the form while a confirmation is
 * stacked over it; throws when neither happens
 * within 5 s, like the forms' own `WaitFor…ToBeAnswered`.
 */
export const ConfirmTheCorrectionIfAsked = (
  formHasAnswered: (
    actor: AnswersQuestions & UsesAbilities,
  ) => Promise<boolean>,
): Interaction =>
  Interaction.where(
    '#actor confirms applying the correction, if asked',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        // Presence, not visibility: while the confirmation is opening its overlay already covers
        // the edit dialog (so `formHasAnswered`, judging by a field's visibility, would read the
        // covered form as closed) yet the confirmation itself is still animating in and not yet
        // "visible". If it is in the DOM, the site has asked.
        const confirmation = await actor.answer(
          CorrectionConfirmationDialog.dialog(),
        );
        if (await confirmation.isPresent()) {
          await WaitUntil(
            CorrectionConfirmationDialog.dialog(),
            isVisible(),
          ).performAs(actor);
          await Click.on(
            CorrectionConfirmationDialog.confirmButton(),
          ).performAs(actor);
          await WaitUntil(
            CorrectionConfirmationDialog.dialog(),
            not(isPresent()),
          ).performAs(actor);
          return;
        }
        if (
          (await formHasAnswered(actor)) ||
          (await theOpenDialogShowsAnAlert(actor))
        ) {
          return;
        }
        await pause();
      } while (Date.now() < deadline);
      throw new Error(
        'The edit was neither refused nor followed by the correction confirmation within 5 s.',
      );
    },
  );

const pause = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));

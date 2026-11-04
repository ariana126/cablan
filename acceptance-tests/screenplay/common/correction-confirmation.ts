import {
  AnswersQuestions,
  Interaction,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
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
    Wait.until(CorrectionConfirmationDialog.dialog(), isVisible()),
    Click.on(CorrectionConfirmationDialog.confirmButton()),
    Wait.until(CorrectionConfirmationDialog.dialog(), not(isPresent())),
  );

/** «… اما اعمال آن … را تایید نمی کند»: the confirmation must be asked; «انصراف», then it closes. */
export const DeclineTheCorrection = (): Task =>
  Task.where(
    '#actor declines applying the correction to the related records',
    Wait.until(CorrectionConfirmationDialog.dialog(), isVisible()),
    Click.on(CorrectionConfirmationDialog.cancelButton()),
    Wait.until(CorrectionConfirmationDialog.dialog(), not(isPresent())),
  );

/**
 * The same confirmation, given *if* it is asked — for a correction the site may refuse before it
 * ever asks. The design runs uniqueness rules "before anything is written" but does not pin whether
 * that comes before or after the dependents check, so a duplicate code may be refused at once
 * (the edit dialog says so) or only after the confirmation (the re-sent edit is refused). Polls
 * until the confirmation opens (then confirms it and waits for it to close) or `formHasAnswered`
 * says the edit dialog already closed or showed what was wrong; throws when neither happens
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
        const confirmation = await actor.answer(
          CorrectionConfirmationDialog.dialog(),
        );
        if (await confirmation.isVisible()) {
          await Click.on(
            CorrectionConfirmationDialog.confirmButton(),
          ).performAs(actor);
          while (Date.now() < deadline + 5_000) {
            const stillOpen = await actor.answer(
              CorrectionConfirmationDialog.dialog(),
            );
            if (!(await stillOpen.isPresent())) {
              return;
            }
            await pause();
          }
          throw new Error('The correction confirmation did not close.');
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
  new Promise((resolve) => setTimeout(resolve, 250));

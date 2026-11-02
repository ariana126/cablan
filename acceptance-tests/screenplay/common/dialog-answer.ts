import { AnswersQuestions, UsesAbilities } from '@serenity-js/core';
import { OpenDialog } from '../ui/dialog-alert';

/**
 * Whether the open dialog is showing its alert banner — "the site has told the visitor what was
 * wrong", for the `WaitFor…ToBeAnswered` polls that otherwise know only their own field errors.
 * A refused edit or delete of a record other records use (issue #94) is told there and leaves the
 * dialog open, so without this a poll would sit out its whole deadline before giving up.
 */
export const theOpenDialogShowsAnAlert = async (
  actor: AnswersQuestions & UsesAbilities,
): Promise<boolean> => (await actor.answer(OpenDialog.alert())).isVisible();

/**
 * What a `WaitFor…ToBeAnswered` poll throws when its deadline passes with the dialog still open
 * and saying nothing — neither closed (accepted) nor showing an error or its alert (refused). A
 * poll that gave up silently let the next step judge a request whose answer never came, so a
 * refusal scenario with no «به او گفته شود …» step could pass without the site having refused
 * anything.
 */
export const theDialogWasNotAnswered = (dialog: string): Error =>
  new Error(
    `The ${dialog} was not answered within 5 s: it is still open and shows neither an error ` +
      'nor an alert.',
  );

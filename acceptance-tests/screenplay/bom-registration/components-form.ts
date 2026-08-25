import { d, Interaction, notes, Task, Wait } from '@serenity-js/core';
import { Click, isVisible, Navigate } from '@serenity-js/web';
import { ComponentsPage } from '../ui/components-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';

/**
 * Establishes a real browser session before the components page is ever navigated to. Mirrors
 * `screenplay/bom-registration/materials-form.ts#EstablishBrowserSession` — see that module's
 * comment for the full reasoning: the scenario's background only authenticates the actor's
 * `CallAnApi` ability, so a UI-driving component task needs its own real `/login` visit first.
 */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the components UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/**
 * Navigates to the components page and waits for it to have rendered — the "locate task" every
 * UI-driving component task below starts from. Per this suite's waiting convention, the wait
 * belongs here, in the locate task, not in whatever task follows it.
 */
export const LocateComponentsPage = (): Task =>
  Task.where(
    '#actor locates the components page',
    EstablishBrowserSession(),
    Navigate.to('/components'),
    Wait.until(ComponentsPage.heading(), isVisible()),
  );

export const OpenNewComponentForm = (): Task =>
  Task.where(
    '#actor opens the new component form',
    LocateComponentsPage(),
    Click.on(ComponentsPage.addButton()),
    Wait.until(ComponentsPage.nameField(), isVisible()),
  );

export const OpenEditComponentForm = (currentName: string): Task =>
  Task.where(
    d`#actor opens the edit form for "${currentName}"`,
    LocateComponentsPage(),
    Wait.until(ComponentsPage.editButton(currentName), isVisible()),
    Click.on(ComponentsPage.editButton(currentName)),
    Wait.until(ComponentsPage.nameField(), isVisible()),
  );

export const OpenDeleteConfirmation = (name: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation for "${name}"`,
    LocateComponentsPage(),
    Wait.until(ComponentsPage.deleteButton(name), isVisible()),
    Click.on(ComponentsPage.deleteButton(name)),
    Wait.until(ComponentsPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Submitting a form means clicking *and* waiting for the answer (this suite's waiting
 * convention): polls until either the dialog has closed — the name field is no longer visible,
 * meaning the request succeeded — or the site has told the visitor what was wrong (the dialog's
 * error region became visible). Mirrors
 * `screenplay/bom-registration/materials-form.ts#WaitForTheMaterialFormToBeAnswered`.
 */
export const WaitForTheComponentFormToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the component form to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const nameField = await actor.answer(ComponentsPage.nameField());
        if (!(await nameField.isVisible())) {
          return;
        }
        const error = await actor.answer(ComponentsPage.dialogError());
        if (await error.isVisible()) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/** Same idea as `WaitForTheComponentFormToBeAnswered`, for the delete confirmation dialog. */
export const WaitForTheDeleteConfirmationToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the delete confirmation to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const confirmButton = await actor.answer(
          ComponentsPage.confirmDeleteButton(),
        );
        if (!(await confirmButton.isVisible())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

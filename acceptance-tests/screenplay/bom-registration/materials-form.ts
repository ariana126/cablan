import { d, Interaction, notes, Task, Wait } from '@serenity-js/core';
import { Click, isVisible, Navigate } from '@serenity-js/web';
import { MaterialsPage } from '../ui/materials-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';

/**
 * Establishes a real browser session before the materials page is ever navigated to.
 *
 * The scenario's background (`Given <actor> وارد سیستم شده باشد` → `LogInAsPersona`,
 * `screenplay/common/personas.ts`) only authenticates the actor's `CallAnApi` ability — it posts to
 * `POST /api/auth/login` and attaches the resulting Bearer token to that ability alone. It does
 * nothing to the actor's separate `BrowseTheWebWithPlaywright` ability/browser context, so a
 * UI-driving material task that merely navigated to `/materials` would hit the frontend's route
 * guard with no session and get redirected to `/login`.
 *
 * This drives the real `/login` page instead — the suite's public UI door (see
 * `acceptance-tests/CLAUDE.md`'s "two doors" boundary; writing the token into `localStorage`
 * directly would reach around it) — using the same username/password `LogInAsPersona` already
 * authenticated over the API, remembered on the acting actor's own notepad rather than threaded
 * through every material task's parameters: `AuthNotes`' `username` (set by `LogIn.viaApiUsing`)
 * and `PersonaCredentialsNotes`' `password` (set by `LogInAsPersona` itself). That keeps this task
 * usable by whichever persona is in the spotlight without ever having to know their name.
 *
 * Deliberately scoped to this feature's UI-driving tasks rather than folded into `LogInAsPersona`
 * itself: that task backs every feature area's background step, most of which never touch a
 * browser, and driving one there would add real navigation cost and risk suite-wide for no reason
 * in the API-only scenarios.
 */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the materials UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/**
 * Navigates to the materials page and waits for it to have rendered — the "locate task" every
 * UI-driving material task below starts from. Per this suite's waiting convention (see
 * `acceptance-tests/CLAUDE.md`), the wait belongs here, in the locate task, not in whatever task
 * follows it; establishing the browser session the navigation depends on belongs here for the same
 * reason — see `EstablishBrowserSession` above.
 */
export const LocateMaterialsPage = (): Task =>
  Task.where(
    '#actor locates the materials page',
    EstablishBrowserSession(),
    Navigate.to('/materials'),
    Wait.until(MaterialsPage.heading(), isVisible()),
  );

export const OpenNewMaterialForm = (): Task =>
  Task.where(
    '#actor opens the new material form',
    LocateMaterialsPage(),
    Click.on(MaterialsPage.addButton()),
    Wait.until(MaterialsPage.nameField(), isVisible()),
  );

export const OpenEditMaterialForm = (currentName: string): Task =>
  Task.where(
    d`#actor opens the edit form for "${currentName}"`,
    LocateMaterialsPage(),
    Wait.until(MaterialsPage.editButton(currentName), isVisible()),
    Click.on(MaterialsPage.editButton(currentName)),
    Wait.until(MaterialsPage.nameField(), isVisible()),
  );

export const OpenDeleteConfirmation = (name: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation for "${name}"`,
    LocateMaterialsPage(),
    Wait.until(MaterialsPage.deleteButton(name), isVisible()),
    Click.on(MaterialsPage.deleteButton(name)),
    Wait.until(MaterialsPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Submitting a form means clicking *and* waiting for the answer (this suite's waiting
 * convention): polls until either the dialog has closed — the name field is no longer visible,
 * meaning the request succeeded — or the site has told the visitor what was wrong (the dialog's
 * error region became visible). Reused by both the "new material" and "edit material" forms,
 * which are assumed to share one form component and therefore one error region
 * (`MaterialsPage.dialogError()`). Mirrors `screenplay/common/login.ts`'s
 * `WaitForTheLoginAttemptToBeAnswered`.
 */
export const WaitForTheMaterialFormToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the material form to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const nameField = await actor.answer(MaterialsPage.nameField());
        if (!(await nameField.isVisible())) {
          return;
        }
        const error = await actor.answer(MaterialsPage.dialogError());
        if (await error.isVisible()) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/** Same idea as `WaitForTheMaterialFormToBeAnswered`, for the delete confirmation dialog. */
export const WaitForTheDeleteConfirmationToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the delete confirmation to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const confirmButton = await actor.answer(
          MaterialsPage.confirmDeleteButton(),
        );
        if (!(await confirmButton.isVisible())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

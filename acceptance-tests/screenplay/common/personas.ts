import {
  actorCalled,
  d,
  Interaction,
  Masked,
  notes,
  Question,
  Task,
} from '@serenity-js/core';
import { PostRequest, Send } from '@serenity-js/rest';
import { apiRoleFor, SystemRole } from './roles';
import { LogIn } from './login';

interface Persona {
  readonly displayName: string;
  readonly username: string;
  readonly password: string;
  readonly role: SystemRole;
  /** True for the one persona the backend itself creates — see the comment below `personas`. */
  readonly seeded?: boolean;
}

/**
 * `backend/.env.test.example`'s `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` — read by
 * `DefaultAdminSeeder` (`backend/src/modules/identity/infrastructure/bootstrap/`), which seeds
 * this one account both on process start *and* whenever `POST /testing/truncate` fires (it
 * subscribes to the `DatabaseTruncated` event precisely so a fresh scenario's truncated database
 * always has this account to log into). Its actual system `name` is "System Admin" — یاشار is
 * this suite's narrative label for that seeded account, not a value the backend knows.
 */
const seededSystemAdmin: Persona = {
  displayName: 'یاشار',
  username: process.env.DEFAULT_ADMIN_USERNAME ?? 'admin',
  password: process.env.DEFAULT_ADMIN_PASSWORD ?? 'ChangeMe123!',
  role: 'مدیر سیستم',
  seeded: true,
};

/**
 * The fixed cast of named personas the *whole* spec suite reuses, not just this feature —
 * every `.feature` file's "Given <name> وارد سیستم شده باشد" resolves through here (see
 * `step-definitions/common.steps.ts`). Roles below aren't guessed for this feature; they're
 * cross-referenced against the authorisation rules other, not-yet-automated feature files already
 * state about these same names:
 * - مصطفی registers products/components/materials/standard BOMs
 *   (bom-registration/registring-{component,product,material,standard-bom}.feature's
 *   "فقط مدیریت و مدیر سیستم مجاز..." rules) → مدیریت (Management).
 * - نیکروش registers daily BOM analyses
 *   (bom-registration/registring-bom.feature's "فقط بازرس کنترل کیفیت، مدیریت و مدیر سیستم
 *   مجاز..." rule, with سینا named there as the one role that's *not* allowed) → بازرس کنترل
 *   کیفیت (QC Inspector).
 * - سینا is that excluded "گزارشگیر" in the same rule's "تلاش گزارشگیر برای ثبت آنالیز روزانه"
 *   example → گزارشگیر (Reporter).
 *
 * یاشار is the one persona the backend seeds itself on startup (see `seededSystemAdmin` below).
 * Every other persona is a fixture this module provisions on demand, through یاشار's own admin
 * access, the same way a scenario's own test data is set up over the API rather than reached
 * around it.
 */
const personas: Record<string, Persona> = {
  یاشار: seededSystemAdmin,
  مصطفی: {
    displayName: 'مصطفی',
    username: 'mostafa',
    password: 'Mostafa-P@ss1',
    role: 'مدیریت',
  },
  نیکروش: {
    displayName: 'نیکروش',
    username: 'nikroosh',
    password: 'Nikroosh-P@ss1',
    role: 'بازرس کنترل کیفیت',
  },
  سینا: {
    displayName: 'سینا',
    username: 'sina',
    password: 'Sina-P@ss1',
    role: 'گزارشگیر',
  },
};

/**
 * Remembered on the acting actor's own notepad by `LogInAsPersona` below, alongside `AuthNotes`'
 * `username` (set by `LogIn.viaApiUsing`) — together they let a UI-driving task in a feature area
 * that needs a real browser session (e.g. `screenplay/bom-registration/materials-form.ts`'s
 * `EstablishBrowserSession`) drive the real `/login` page without ever having to know in advance
 * which persona is performing the task. Deliberately per-actor (a Notepad, not module state): this
 * suite's "keep any per-actor secret genuinely per-actor" convention (see `acceptance-tests/
 * CLAUDE.md`) applies to a password exactly as it does to a token.
 */
export interface PersonaCredentialsNotes {
  password: string;
}

const personaNamed = (name: string): Persona => {
  const persona = personas[name];
  if (!persona) {
    throw new Error(
      `No known persona named "${name}" in screenplay/common/personas.ts. Every actor this ` +
        'suite logs in needs a fixed identity (username, password, role) registered there first.',
    );
  }
  return persona;
};

/**
 * Provisions the persona's account through یاشار's admin access, unless they're یاشار themself
 * (the backend seeds that one). Every scenario starts from a truncated database
 * (`support/hooks.ts`'s `Before` hook), so this runs fresh every time rather than checking for an
 * existing account first.
 */
const ProvisionPersonaIfNeeded = (persona: Persona): Interaction =>
  Interaction.where(
    d`#actor provisions ${persona.displayName}'s account, if it doesn't exist yet`,
    async () => {
      if (persona.seeded) {
        return;
      }

      await actorCalled('یاشار').attemptsTo(
        LogIn.viaApiUsing(
          seededSystemAdmin.username,
          seededSystemAdmin.password,
        ),
        Send.a(
          PostRequest.to('users').with(
            Question.fromObject({
              name: persona.displayName,
              username: persona.username,
              password: Masked.valueOf(persona.password),
              role: apiRoleFor(persona.role),
            }),
          ),
        ),
      );
    },
  );

/**
 * Logs the named persona in, provisioning their account first if they're not the seeded admin.
 * Used by the shared "Given <actor> has logged in" steps in `step-definitions/common.steps.ts`,
 * which every feature area's background relies on.
 *
 * Provisioning a non-admin persona borrows یاشار's own actor object internally
 * (`actorCalled('یاشار')`), which moves Serenity's spotlight — the caller (`common.steps.ts`) is
 * responsible for re-affirming it once this task completes.
 */
export const LogInAsPersona = (name: string): Task => {
  const persona = personaNamed(name);
  return Task.where(
    d`#actor logs in as ${persona.displayName}`,
    ProvisionPersonaIfNeeded(persona),
    LogIn.viaApiUsing(persona.username, persona.password),
    notes<PersonaCredentialsNotes>().set(
      'password',
      Masked.valueOf(persona.password),
    ),
  );
};

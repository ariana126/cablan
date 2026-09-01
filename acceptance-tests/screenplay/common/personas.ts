import {
  actorCalled,
  d,
  Interaction,
  Masked,
  notes,
  Question,
  Task,
} from '@serenity-js/core';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { apiRoleFor, SystemRole } from './roles';
import { LogIn } from './login';

interface Persona {
  readonly displayName: string;
  readonly username: string;
  readonly password: string;
  readonly role: SystemRole;
  /** True for the one persona the backend itself creates — see the comment below `personas`. */
  readonly seeded?: boolean;
  /**
   * The literal `name` value the backend actually stores for this persona's account — identical
   * to `displayName` for every persona `ProvisionPersonaIfNeeded` itself registers (it POSTs
   * `name: persona.displayName`), EXCEPT the one persona the backend seeds itself: `DefaultAdminSeeder`
   * (`backend/src/modules/identity/infrastructure/bootstrap/default-admin-seeder.ts`) hardcodes
   * `DEFAULT_ADMIN_NAME = 'System Admin'`, a real value that has nothing to do with یاشار — this
   * suite's own narrative label for that seeded account. Any caller that needs to match a
   * backend-reported `name` against a persona (e.g. an audit log's `actorName`) must go through
   * `realNameFor` below, never assume `displayName` is what the backend actually stored.
   */
  readonly realName?: string;
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
  realName: 'System Admin',
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
 * (the backend seeds that one) or already registered. Checks the live user list first rather than
 * assuming a truncated database always means "never provisioned yet in this scenario" — that
 * assumption held for every feature area until `screenplay/audit-logging/`'s own background needed
 * to register a persona (e.g. مصطفی) as an explicit, individually-tracked domain action of its own,
 * BEFORE some later step in the SAME scenario calls `LogInAsPersona` for that same persona again
 * (the access-denied rule's own outline reuses the shared "{actor} وارد سیستم شده باشد" step for
 * whichever persona each example names). Without this check, that second call would attempt to
 * re-`POST /users` with an already-taken username and fail with 409. Every other call site's own
 * behaviour is unaffected: a persona provisioned for the first time here still POSTs exactly once.
 */
const ProvisionPersonaIfNeeded = (persona: Persona): Interaction =>
  Interaction.where(
    d`#actor provisions ${persona.displayName}'s account, if it doesn't exist yet`,
    async () => {
      if (persona.seeded) {
        return;
      }

      const admin = actorCalled('یاشار');
      await admin.attemptsTo(
        LogIn.viaApiUsing(
          seededSystemAdmin.username,
          seededSystemAdmin.password,
        ),
        Send.a(GetRequest.to('users')),
      );
      const existingUsers = await admin.answer(
        LastResponse.body<Array<{ username: string }>>(),
      );
      if (existingUsers.some((user) => user.username === persona.username)) {
        return;
      }

      await admin.attemptsTo(
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

/** The persona's own `name`/`username`/`password`/`role`, matching exactly what `NewUserDetails`
 * (`screenplay/authentication/user-details.ts`) needs — for a caller that has to perform a
 * persona's OWN registration explicitly, as its own individually-attributed domain action, rather
 * than through `LogInAsPersona`'s own provisioning side effect.
 * `screenplay/audit-logging/audit-log-fixtures.ts` is the one call site: its own "ثبت کاربر جدید با
 * نام «نیکروش»" background row needs نیکروش's registration to be an explicit, separately-tracked
 * audit event credited to یاشار (the admin performing it), captured by its own response — not
 * buried inside `LogInAsPersona`, which never reports the id of the account it just created. */
export interface PersonaIdentity {
  name: string;
  username: string;
  password: string;
  role: SystemRole;
}

export const personaIdentity = (name: string): PersonaIdentity => {
  const persona = personaNamed(name);
  return {
    name: persona.displayName,
    username: persona.username,
    password: persona.password,
    role: persona.role,
  };
};

/** The literal `name` value the backend actually stores for this persona's account — see
 * `Persona.realName`'s own comment above for why this is NOT always `displayName`. */
export const realNameFor = (name: string): string => {
  const persona = personaNamed(name);
  return persona.realName ?? persona.displayName;
};

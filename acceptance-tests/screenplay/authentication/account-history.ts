import { actorCalled, d, Interaction, Question, Task } from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isLessThan,
  not,
  property,
} from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { taskDependingOn } from '../common/task-depending-on';
import { keepingTheSpotlight } from '../common/spotlight';
import {
  LogInAsPersona,
  personaIdentity,
  realNameFor,
} from '../common/personas';
import { apiRoleFor, asSystemRole } from '../common/roles';
import { DeleteUser } from './delete-user';
import { EditUser } from './edit-user';
import { TheUserList, UserSummary, ViewUserList } from './view-user-list';
import { freshMiCode } from '../bom-registration/standard-bom-details';
import { RegisterStandardBomWithMiCodeUnlessRegistered } from '../bom-registration/register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from '../bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import {
  BomSummary,
  TheBomList,
  ViewBomList,
} from '../bom-registration/view-bom-list';

/**
 * registring-user.feature's issue #94 rule: managing an account is not tied to the history that
 * names its user, and leaves that history alone. Deleting a persona's account, or changing their
 * role, works as it always did; what they registered or recorded still carries their name. All
 * over the API — this feature's door throughout.
 */

/** The account of a persona, found in the user list by the username `personas.ts` gives them. */
const TheAccountOf = (personaName: string) =>
  Question.about(d`the account of ${personaName}`, async (actor) => {
    const { username } = personaIdentity(personaName);
    const account = (await actor.answer(TheUserList())).find(
      (user) => user.username === username,
    );
    if (!account) {
      throw new Error(`${personaName} (${username}) has no account.`);
    }
    return account;
  });

/** «… کاربر نیکروش را حذف می کند» */
export const DeleteTheAccountOf = (personaName: string): Task =>
  Task.where(
    d`#actor deletes the account of ${personaName}`,
    ViewUserList(),
    taskDependingOn(
      `#actor deletes the account of ${personaName}`,
      TheAccountOf(personaName),
      (account: UserSummary) => [
        DeleteUser.viaApiUsing(account.id),
        Ensure.that(LastResponse.status(), isLessThan(300)),
      ],
    ),
  );

/** «… نقش مسلمی را به «…» تغییر می دهد» */
export const ChangeTheRoleOf = (personaName: string, role: string): Task =>
  Task.where(
    d`#actor changes the role of ${personaName} to ${role}`,
    ViewUserList(),
    taskDependingOn(
      `#actor changes the role of ${personaName}`,
      TheAccountOf(personaName),
      (account: UserSummary) => [
        EditUser.viaApiUsing(account.id, { role: asSystemRole(role) }),
        Ensure.that(LastResponse.status(), isLessThan(300)),
      ],
    ),
  );

/** «کاربر نیکروش از سیستم حذف شده باشد» */
export const EnsureTheAccountOfIsGone = (personaName: string): Task =>
  Task.where(
    d`#actor ensures ${personaName} has no account any more`,
    ViewUserList(),
    Ensure.that(
      TheUserList(),
      not(
        containAtLeastOneItemThat(
          property('username', equals(personaIdentity(personaName).username)),
        ),
      ),
    ),
  );

/** «مسلمی با نقش «…» در سیستم ثبت شده باشد» */
export const EnsureTheAccountOfHasRole = (
  personaName: string,
  role: string,
): Task =>
  Task.where(
    d`#actor ensures ${personaName} has the role ${role}`,
    ViewUserList(),
    Ensure.that(
      TheUserList(),
      containAtLeastOneItemThat(
        and(
          property('username', equals(personaIdentity(personaName).username)),
          property('role', equals(apiRoleFor(asSystemRole(role)))),
        ),
      ),
    ),
  );

/**
 * «اینکه نیکروش آنالیز روزانه «…» را ثبت کرده باشد» — a standard BOM to register it on (a fresh
 * product's, by the system admin), then the daily BOM registered by the persona themself, so the
 * system records them as its registrar.
 */
export const dailyBomRegisteredByAsAPrecondition = (
  personaName: string,
  orderNumber: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const miCode = freshMiCode();
    await actorCalled('یاشار').attemptsTo(
      LogInAsPersona('یاشار'),
      RegisterStandardBomWithMiCodeUnlessRegistered(miCode),
    );
    await actorCalled(personaName).attemptsTo(
      LogInAsPersona(personaName),
      RegisterBomAndRememberIt(theStandardBomRegisteredWithMiCode(miCode), {
        orderNumber,
      }),
    );
  });

interface BomDetail {
  registeredBy: string;
}

/** «ثبت کننده آنالیز روزانه «…» همچنان نیکروش باشد» — `GET boms/:id`'s `registeredBy`. */
export const EnsureDailyBomRegistrarIs = (
  orderNumber: string,
  personaName: string,
): Task =>
  Task.where(
    d`#actor ensures daily BOM ${orderNumber} still names ${personaName} as its registrar`,
    ViewBomList(),
    Interaction.where(
      d`#actor reads the registrar of daily BOM ${orderNumber}`,
      async (actor) => {
        const bom = (await actor.answer(TheBomList())).find(
          (candidate: BomSummary) => candidate.orderNumber === orderNumber,
        );
        if (!bom) {
          throw new Error(`No daily BOM with order number "${orderNumber}".`);
        }
        await Send.a(GetRequest.to(`boms/${bom.id}`)).performAs(actor);
      },
    ),
    Ensure.that(LastResponse.status(), equals(200)),
    Ensure.that(
      LastResponse.body<BomDetail>().registeredBy,
      equals(realNameFor(personaName)),
    ),
  );

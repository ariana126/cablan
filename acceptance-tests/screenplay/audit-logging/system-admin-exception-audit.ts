import { Actor, actorCalled, d, Question, Task } from '@serenity-js/core';
import {
  containAtLeastOneItemThat,
  contain,
  Ensure,
  equals,
  property,
  and,
} from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { LogInAsPersona, realNameFor } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import { taskDependingOn } from '../common/task-depending-on';
import { tehranWallClockInstant } from '../common/jalali-datetime';
import {
  CorrectMaterial,
  MaterialCorrection,
} from '../bom-registration/record-correction';
import { MaterialSummary } from '../bom-registration/view-material-list';
import {
  AuditChangeRow,
  auditEventIdsFor,
  EnsureChangesOfAuditEvent,
  pollForANewAuditEventId,
  ViewAuditEventDetails,
} from './audit-log-details';
import {
  AuditAction,
  AuditLogEntry,
  AuditRecordType,
  TheAuditLogItems,
  ViewAuditLog,
} from './view-audit-log';

/**
 * Issue #110 in viewing-audit-log.feature: what the System Admin's exceptions leave in the audit
 * log. A correction is the record's ordinary `Edited` entry — one line per changed field — and
 * every earlier entry stays as it was written; the deletions and the reactivation are entries of
 * their own (`MaintenanceExecution`/`Deleted`, `PmPlanItem`/`Deleted`, `Equipment`/`Deleted`,
 * `Equipment`/`Reactivated`), labelled for the business as the list labels them.
 *
 * API throughout, as the rest of this feature: the correction precondition is
 * `PATCH materials/:id` with `applyToRelatedRecords: true` (`record-correction.ts`), waited on until
 * its entry is projected (projection is fire-and-forget — `audit-log-details.ts
 * #pollForANewAuditEventId`); the facts read `POST audit-log` and `GET audit-log/:id/changes`.
 */

/** The audit entry each label of «رویداد «…» …» names. */
const EVENT_BY_LABEL: Record<
  string,
  { recordType: AuditRecordType; action: AuditAction }
> = {
  'حذف سابقه انجام': { recordType: 'MaintenanceExecution', action: 'Deleted' },
  'حذف ردیف غیرفعال برنامه': { recordType: 'PmPlanItem', action: 'Deleted' },
  'حذف تجهیز': { recordType: 'Equipment', action: 'Deleted' },
  'فعال سازی دوباره تجهیز': {
    recordType: 'Equipment',
    action: 'Reactivated',
  },
};

const theEventLabelled = (label: string) => {
  const event = EVENT_BY_LABEL[label];
  if (!event) {
    throw new Error(
      `"${label}" is not a known event label (expected one of: ` +
        `${Object.keys(EVENT_BY_LABEL).join(', ')}).`,
    );
  }
  return event;
};

/** The material the scenario's correction was made to — set by the precondition that made it. */
let correctedMaterialId: string | undefined;

const theCorrectedMaterialId = (): string => {
  if (!correctedMaterialId) {
    throw new Error(
      'No material was corrected in this scenario — expected a preceding «… تغییر داده و اعمال آن ' +
        'در اطلاعات و سوابق مرتبط را تایید کرده باشد».',
    );
  }
  return correctedMaterialId;
};

/**
 * «{editor} نام و کد مواد اولیه «…» را به «…» و «…» تغییر داده و اعمال آن … را تایید کرده باشد» —
 * the editor corrects it over the API at the system's current time, then the system admin waits
 * until its `Edited` entry is in the log; the spotlight stays where it was.
 */
export const correctMaterialForTheAuditLog = (
  editorName: string,
  materialName: string,
  correction: MaterialCorrection,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(
      LogInAsPersona('یاشار'),
      Send.a(GetRequest.to('materials')),
      Ensure.that(LastResponse.status(), equals(200)),
    );
    const material = (
      await admin.answer(LastResponse.body<MaterialSummary[]>())
    ).find((candidate) => candidate.name === materialName);
    if (!material) {
      throw new Error(`No material named "${materialName}" is registered.`);
    }
    const known = await auditEventIdsFor(admin, material.id);

    await actorCalled(editorName).attemptsTo(
      LogInAsPersona(editorName),
      CorrectMaterial.viaApiUsing(materialName, correction),
    );

    await admin.attemptsTo(LogInAsPersona('یاشار'));
    await pollForANewAuditEventId(admin, material.id, 'Edited', known);
    correctedMaterialId = material.id;
  });

/** The entries of the corrected material, newest first, as the actor reads them. */
const ViewTheEntriesOfTheCorrectedMaterial = (): Task =>
  Task.where(
    '#actor views the audit entries of the corrected material',
    ViewAuditLog.viaApiUsing({
      recordId: theCorrectedMaterialId(),
      page: 1,
      pageSize: 100,
    }),
    Ensure.that(LastResponse.status(), equals(200)),
  );

const theOnlyOne = (entries: AuditLogEntry[], what: string): AuditLogEntry => {
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one ${what}, found ${entries.length}.`);
  }
  return entries[0];
};

/**
 * «رویداد ثبت مواد اولیه همچنان با نام «…» و کد «…» نمایش داده شود» — the material's `Registered`
 * entry still reads the name and code it was registered with: the correction rewrote no history.
 */
export const EnsureTheRegistrationOfTheCorrectedMaterialStillReads = (
  name: string,
  code: string,
): Task =>
  Task.where(
    d`#actor ensures the registration of the corrected material still reads "${name}" and "${code}"`,
    ViewTheEntriesOfTheCorrectedMaterial(),
    taskDependingOn(
      '#actor checks the changes of that registration',
      Question.about('the registration entry of the material', async (actor) =>
        theOnlyOne(
          (await actor.answer(TheAuditLogItems())).filter(
            (entry) => entry.action === 'Registered',
          ),
          'registration entry',
        ),
      ),
      (registration) => [
        ViewAuditEventDetails.of(registration.id),
        Ensure.that(
          LastResponse.body<{ changes: AuditChangeRow[] }>().changes,
          and(
            containAtLeastOneItemThat(
              and(
                property('field', equals('name')),
                property('newValue', equals<string | null>(name)),
              ),
            ),
            containAtLeastOneItemThat(
              and(
                property('field', equals('code')),
                property('newValue', equals<string | null>(code)),
              ),
            ),
          ),
        ),
      ],
    ),
  );

/**
 * «رویداد اصلاح زیر توسط {actor} در «…» ثبت شده باشد» — the corrected material has exactly one
 * `Edited` entry by that persona at that Tehran minute, and its change lines are exactly the table's.
 */
export const EnsureTheCorrectionWasLogged = (
  editorName: string,
  at: string,
  expected: AuditChangeRow[],
): Task => {
  const [date, time] = at.trim().split(/\s+/);
  const instant = tehranWallClockInstant(date, time).getTime();
  return Task.where(
    d`#actor ensures the correction by ${editorName} at ${at} was logged`,
    ViewTheEntriesOfTheCorrectedMaterial(),
    taskDependingOn(
      '#actor checks the changes of that correction',
      Question.about('the correction entry of the material', async (actor) =>
        theOnlyOne(
          (await actor.answer(TheAuditLogItems())).filter(
            (entry) =>
              entry.action === 'Edited' &&
              entry.actorName === realNameFor(editorName) &&
              new Date(entry.occurredAt).getTime() === instant,
          ),
          `edit entry by ${editorName} at ${at}`,
        ),
      ),
      (correction) => [
        EnsureChangesOfAuditEvent(correction.id).areExactly(expected),
      ],
    ),
  );
};

/**
 * «رویداد «…» توسط {actor} در لیست رویدادهای سیستم باشد» — the unfiltered list holds an entry of
 * that kind by that persona. The list the `When` viewed is read first; since projection is
 * fire-and-forget, it is viewed again for up to 5 s before the step gives up.
 */
export const ensureTheListHoldsAnEventLabelled = async (
  actor: Actor,
  label: string,
  personaName: string,
): Promise<void> => {
  const expected = {
    actorName: realNameFor(personaName),
    ...theEventLabelled(label),
  };
  const holdsIt = async (): Promise<boolean> =>
    (await actor.answer(TheAuditLogItems())).some(
      (entry) =>
        entry.actorName === expected.actorName &&
        entry.recordType === expected.recordType &&
        entry.action === expected.action,
    );
  const deadline = Date.now() + 5_000;
  while (!(await holdsIt()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await actor.attemptsTo(ViewAuditLog.viaApiUsing());
  }
  await actor.attemptsTo(
    Ensure.that(
      Question.about('the kinds of the audit entries listed', async (who) =>
        (await who.answer(TheAuditLogItems())).map((entry) => ({
          actorName: entry.actorName,
          recordType: entry.recordType,
          action: entry.action,
        })),
      ),
      contain(expected),
    ),
  );
};

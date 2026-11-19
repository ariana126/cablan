import { Actor, d, Interaction, Question, Task } from '@serenity-js/core';
import { contain, Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { POLLING_INTERVAL_MS } from '../common/polling';
import { taskDependingOn } from '../common/task-depending-on';
import { performAsTheSystemAdmin } from '../common/observer';
import { realNameFor } from '../common/personas';
import { withLatinDigits } from '../common/persian-digits';
import { RegisterDailyBomOnStandardBom } from './record-dependencies';
import { theLastRegisteredBom } from './bom-details';
import {
  approvalStatusFor,
  approveDailyBomAsAPrecondition,
  focusOnTheDailyBom,
  rejectDailyBomAsAPrecondition,
  thatDailyBom,
} from '../bom-analyzing/daily-bom-approval';
import {
  AuditLogEntry,
  TheAuditLogItems,
  ViewAuditLog,
} from '../audit-logging/view-audit-log';
import { AuditChangeRow } from '../audit-logging/audit-log-details';
import {
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';

/**
 * Issue #126: what a System Admin's correction of a standard BOM in use leaves behind, and what it
 * must not touch. Its own `Edited` audit entry lists the changed weight's old and new value; every
 * earlier entry stays as written; the daily BOMs registered on it keep their review (status,
 * reviewer, management note), their weights and their edit details, and get no `Edited` entry.
 *
 * API throughout: these are facts, read by the System Admin (the only one who may read the audit
 * log), each compared with a note taken before the correction.
 */

// ---------------------------------------------------------------------------------------------
// The daily BOMs registered on the standard BOM before the correction

const REVIEWER = 'مصطفی';
const ROUTINE_REJECTION_REASON = 'نمونه با استاندارد مطابقت ندارد';

/** A daily BOM as `GET boms/:id` reports what the correction must leave alone. */
interface DailyBomPicture {
  approvalStatus: string;
  reviewedBy: string | null;
  managementNote: string | null;
  components: unknown;
  editHistory: unknown;
}

const pictureOf = (body: DailyBomPicture): DailyBomPicture => ({
  approvalStatus: body.approvalStatus,
  reviewedBy: body.reviewedBy ?? null,
  managementNote: body.managementNote ?? null,
  components: body.components,
  editHistory: body.editHistory,
});

let notedDailyBomIds: string[] = [];
let dailyBomsBeforeTheCorrection: DailyBomPicture[] = [];

const TheNotedDailyBomsNow = () =>
  Question.about('the noted daily BOMs now', async (actor) => {
    const pictures: DailyBomPicture[] = [];
    for (const id of notedDailyBomIds) {
      await Send.a(GetRequest.to(`boms/${id}`)).performAs(actor);
      pictures.push(
        pictureOf(await actor.answer(LastResponse.body<DailyBomPicture>())),
      );
    }
    return pictures;
  });

const NoteTheDailyBoms = (): Interaction =>
  Interaction.where('#actor notes the daily BOMs', async (actor) => {
    dailyBomsBeforeTheCorrection = await actor.answer(TheNotedDailyBomsNow());
  });

/**
 * «آنالیز های روزانه زیر با کد MI «…» ثبت شده باشند» (with «وضعیت تایید») — each registered by the
 * System Admin on the standard BOM, reviewed by مصطفی into the row's status (a routine reason for a
 * rejection), and finally all of them noted as they are.
 */
export const reviewedDailyBomsWereRegisteredOn = async (
  miCode: string,
  rows: Array<{ orderNumber: string; status: string }>,
): Promise<void> => {
  notedDailyBomIds = [];
  for (const row of rows) {
    await performAsTheSystemAdmin(
      RegisterDailyBomOnStandardBom(row.orderNumber, miCode),
    );
    const bom = theLastRegisteredBom();
    notedDailyBomIds.push(bom.id);
    focusOnTheDailyBom({ id: bom.id, orderNumber: row.orderNumber });
    switch (approvalStatusFor(row.status)) {
      case 'approved':
        await approveDailyBomAsAPrecondition(thatDailyBom(), REVIEWER);
        break;
      case 'rejected':
        await rejectDailyBomAsAPrecondition(
          thatDailyBom(),
          REVIEWER,
          ROUTINE_REJECTION_REASON,
        );
        break;
      default:
        break;
    }
  }
  await performAsTheSystemAdmin(NoteTheDailyBoms());
};

const theNotedPart = <K extends keyof DailyBomPicture>(
  pictures: DailyBomPicture[],
  keys: K[],
): Array<Pick<DailyBomPicture, K>> =>
  pictures.map(
    (picture) =>
      Object.fromEntries(keys.map((key) => [key, picture[key]])) as Pick<
        DailyBomPicture,
        K
      >,
  );

const EnsureTheNotedDailyBomsKeep = <K extends keyof DailyBomPicture>(
  description: string,
  keys: K[],
): Task =>
  Task.where(
    description,
    Ensure.that(
      Question.about(
        `the ${keys.join(', ')} of the noted daily BOMs`,
        async (actor) =>
          theNotedPart(await actor.answer(TheNotedDailyBomsNow()), keys),
      ),
      equals(theNotedPart(dailyBomsBeforeTheCorrection, keys)),
    ),
  );

/** «وضعیت تایید، تایید/رد کننده و توضیحات مدیریت هر سه آنالیز روزانه تغییر نکرده باشد» */
export const EnsureTheReviewsOfTheNotedDailyBomsAreUnchanged = (): Task =>
  EnsureTheNotedDailyBomsKeep(
    '#actor ensures the reviews of the noted daily BOMs are unchanged',
    ['approvalStatus', 'reviewedBy', 'managementNote'],
  );

/** «وزن مواد اولیه و جزئیات ویرایش هر سه آنالیز روزانه تغییر نکرده باشد» */
export const EnsureTheWeightsAndEditDetailsOfTheNotedDailyBomsAreUnchanged =
  (): Task =>
    EnsureTheNotedDailyBomsKeep(
      '#actor ensures the weights and edit details of the noted daily BOMs are unchanged',
      ['components', 'editHistory'],
    );

/** How long an absent audit entry is watched for: projection is fire-and-forget
 * (`audit-logging/audit-log-details.ts#pollForANewAuditEventId`), so "none yet" right after the
 * correction would prove nothing. */
const AUDIT_SETTLE_MILLISECONDS = 1_500;

/** «هیچ رویداد ویرایشی برای آن آنالیز های روزانه ثبت نشده باشد» — watched for a moment, not read
 * once: no `Edited` entry for any of the noted daily BOMs. */
export const EnsureNoEditEventRecordedForTheNotedDailyBoms = (): Task =>
  Task.where(
    '#actor ensures no edit of the noted daily BOMs was recorded in the audit log',
    Ensure.that(
      Question.about(
        'the edit entries recorded for the noted daily BOMs',
        async (actor) => {
          const deadline = Date.now() + AUDIT_SETTLE_MILLISECONDS;
          let edits: string[] = [];
          do {
            edits = [];
            for (const recordId of notedDailyBomIds) {
              await ViewAuditLog.viaApiUsing({
                recordId,
                page: 1,
                pageSize: 100,
              }).performAs(actor as Actor);
              const items = await actor.answer(TheAuditLogItems());
              edits.push(
                ...items
                  .filter((item) => item.action === 'Edited')
                  .map((item) => `${item.recordId} ${item.id}`),
              );
            }
            await new Promise((resolve) =>
              setTimeout(resolve, POLLING_INTERVAL_MS),
            );
          } while (edits.length === 0 && Date.now() < deadline);
          return edits;
        },
      ),
      equals<string[]>([]),
    ),
  );

// ---------------------------------------------------------------------------------------------
// The audit log

/** One entry of the audit log with its change lines, as the System Admin reads them. */
interface AuditEntryWithChanges {
  entry: AuditLogEntry;
  changes: AuditChangeRow[];
}

/** Enough for every entry these scenarios make, on one page. */
const AUDIT_PAGE_SIZE = 100;

let auditBeforeTheCorrection: AuditEntryWithChanges[] | undefined;

const changesOf = async (
  actor: Actor,
  entryId: string,
): Promise<AuditChangeRow[]> => {
  await Send.a(GetRequest.to(`audit-log/${entryId}/changes`)).performAs(actor);
  return (
    await actor.answer(LastResponse.body<{ changes: AuditChangeRow[] }>())
  ).changes;
};

const theWholeAuditLog = async (actor: Actor): Promise<AuditLogEntry[]> => {
  await ViewAuditLog.viaApiUsing({
    page: 1,
    pageSize: AUDIT_PAGE_SIZE,
  }).performAs(actor);
  return actor.answer(TheAuditLogItems());
};

/**
 * Notes every audit entry, with its change lines, just before the correction — what «رویدادهای
 * قبلی تغییر نکرده باشند» compares with, and what tells the correction's own entry from older ones.
 * An entry still being projected may be missed; that only leaves it out of the comparison.
 */
export const NoteTheAuditLogBeforeTheCorrection = (): Interaction =>
  Interaction.where(
    '#actor notes the audit log before the correction',
    async (actor) => {
      const entries = await theWholeAuditLog(actor as Actor);
      const noted: AuditEntryWithChanges[] = [];
      for (const entry of entries) {
        noted.push({
          entry,
          changes: await changesOf(actor as Actor, entry.id),
        });
      }
      auditBeforeTheCorrection = noted;
    },
  );

const theAuditNotedBeforeTheCorrection = (): AuditEntryWithChanges[] => {
  if (!auditBeforeTheCorrection) {
    throw new Error(
      'The audit log was not noted before the correction — expected a preceding «… آنالیز ' +
        'استاندارد … را به … اصلاح می کند».',
    );
  }
  return auditBeforeTheCorrection;
};

/**
 * The weight moves a change line tells, as `<old>→<new>`. A weight-only edit may be written one
 * line per material (`materialWeight:<component>:<material>`, the daily BOM's convention) or as the
 * component's own line (`component`, «مغزی: مسی (100 گرم)» → «مغزی: مسی (105 گرم)»); either says
 * the same thing, and the design leaves the shape to the backend.
 */
const weightMovesIn = (change: AuditChangeRow): string[] => {
  const previous = withLatinDigits(change.previousValue ?? '');
  const next = withLatinDigits(change.newValue ?? '');
  if (change.field.startsWith('materialWeight:')) {
    return [`${previous}→${next}`];
  }
  const grams = (text: string) =>
    [...text.matchAll(/\(([\d.]+) گرم\)/g)].map((match) => match[1]);
  const before = grams(previous);
  const after = grams(next);
  return before
    .map((weight, index) => `${weight}→${after[index] ?? ''}`)
    .filter((move) => {
      const [from, to] = move.split('→');
      return from !== to;
    });
};

/** The correction's own entry: `Edited`, on the standard BOM, not noted before the correction —
 * polled for, since projection is fire-and-forget. */
const TheCorrectionEntryOf = (miCode: string) =>
  Question.about(
    d`the audit entry of the correction of standard BOM "${miCode}"`,
    async (actor) => {
      await ViewStandardBomList().performAs(actor as Actor);
      const standardBom = (await actor.answer(TheStandardBomList())).find(
        (candidate) =>
          withLatinDigits(candidate.miCode) === withLatinDigits(miCode),
      );
      if (!standardBom) {
        throw new Error(`No standard BOM with MI code "${miCode}".`);
      }
      const known = theAuditNotedBeforeTheCorrection().map(
        ({ entry }) => entry.id,
      );
      const deadline = Date.now() + 5_000;
      do {
        await ViewAuditLog.viaApiUsing({
          recordId: standardBom.id,
          page: 1,
          pageSize: AUDIT_PAGE_SIZE,
        }).performAs(actor as Actor);
        const entry = (await actor.answer(TheAuditLogItems())).find(
          (candidate) =>
            candidate.action === 'Edited' && !known.includes(candidate.id),
        );
        if (entry) {
          const changes = await changesOf(actor as Actor, entry.id);
          return {
            actorName: entry.actorName,
            weightMoves: changes.flatMap(weightMovesIn),
          };
        }
        await new Promise((resolve) =>
          setTimeout(resolve, POLLING_INTERVAL_MS),
        );
      } while (Date.now() < deadline);
      throw new Error(
        `No new "Edited" audit entry for standard BOM "${miCode}" within 5 s.`,
      );
    },
  );

/** «رویداد ویرایش آنالیز استاندارد «…» توسط {persona} با وزن قبلی «…» و وزن جدید «…» ثبت شده باشد» */
export const EnsureTheStandardWeightCorrectionWasLogged = (
  miCode: string,
  personaName: string,
  weights: { previousWeight: string; newWeight: string },
): Task => {
  const move = `${withLatinDigits(weights.previousWeight)}→${withLatinDigits(weights.newWeight)}`;
  return taskDependingOn(
    `#actor ensures the correction of standard BOM "${miCode}" by ${personaName} was logged as ${move}`,
    TheCorrectionEntryOf(miCode),
    (entry) => [
      Ensure.that(entry.actorName, equals(realNameFor(personaName))),
      Ensure.that(entry.weightMoves, contain(move)),
    ],
  );
};

/** «رویدادهای قبلی تغییر نکرده باشند» — every entry noted before the correction is still in the
 * log, exactly as it was, change lines included. */
export const EnsureTheEarlierAuditEntriesAreUnchanged = (): Task =>
  Task.where(
    '#actor ensures the earlier audit entries are unchanged',
    Ensure.that(
      Question.about(
        'the noted audit entries as the log reads them now',
        async (actor) => {
          const now = await theWholeAuditLog(actor as Actor);
          const entries: Array<AuditEntryWithChanges | undefined> = [];
          for (const { entry } of theAuditNotedBeforeTheCorrection()) {
            const current = now.find((candidate) => candidate.id === entry.id);
            entries.push(
              current && {
                entry: current,
                changes: await changesOf(actor as Actor, current.id),
              },
            );
          }
          return entries;
        },
      ),
      equals<Array<AuditEntryWithChanges | undefined>>(
        Question.about('the audit entries noted before the correction', () =>
          theAuditNotedBeforeTheCorrection(),
        ),
      ),
    ),
  );

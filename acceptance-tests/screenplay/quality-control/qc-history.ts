import { d, Interaction, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  DeleteRequest,
  GetRequest,
  LastResponse,
  Send,
} from '@serenity-js/rest';
import { tehranJalaliDateTimeOf } from '../common/jalali-datetime';
import { readAsTheSystemAdmin } from '../common/observer';
import { theQcRecordFiltersLookedAt } from '../common/qc-history-view-context';
import {
  intervalLabel,
  QcExecutionFilters,
  QcExecutionHistoryReadModel,
  qcExecutionsResource,
  QcInstant,
  readQcExecutionHistory,
} from './qc-api';
import { Column, RecordRow, qcRecordsOf } from './qc-execution';
import { theEquipmentNamed } from '../maintenance-management/maintenance-records';

/**
 * The plant-wide QC records — qc-execution-history.feature. `GET qc-executions` (`from`, `to`,
 * `equipmentId`, `trackingNumber`; Management and System Admin, 403 otherwise) answers the records,
 * newest first, each with `intervalMinutes` since the previous record of the same equipment and
 * activity over **all** records, and the counts per equipment and activity over the filtered ones.
 * `DELETE qc-executions/:id` is the System Admin's alone.
 *
 * Doors: the API throughout. What the interval is measured from, what the filters select and what a
 * deletion changes are backend rules; the page only renders the answer, writing the minutes as the
 * Gherkin does (`qc-api.ts#intervalLabel`). «… مشاهده می کند» reads the records as the actor and
 * notes the filters (`common/qc-history-view-context.ts`); the facts that follow read them as the
 * System Admin with those filters.
 */

export const ViewTheQcRecords = {
  /** As the actor, checked for its 200 — they may, and the page would show this answer. */
  viaApiUsing: (filters: QcExecutionFilters): Task =>
    Task.where(
      d`#actor looks at the QC records filtered by ${filters}`,
      Send.a(GetRequest.to(qcExecutionsResource(filters))),
      Ensure.that(LastResponse.status(), equals(200)),
    ),

  /** «… تلاش می کند سوابق فعالیت های QC را مشاهده کند» — the response is left to be judged. */
  attemptedViaApi: (): Task =>
    Task.where(
      '#actor tries to look at the QC records',
      Send.a(GetRequest.to(qcExecutionsResource())),
    ),
};

/**
 * «… پرونده QC تجهیز «…» را مشاهده می کند» — the equipment's QC folder as the actor (Management or
 * System Admin) reads it: its activities (`GET qc-equipment/:id`, retired equipment included) and
 * its records (`GET qc-executions?equipmentId=…`), each checked for its 200. The facts that follow
 * read the same records as the System Admin.
 */
export const ViewTheQcFolderOf = {
  viaApiUsing: (equipmentName: string): Interaction =>
    Interaction.where(
      d`#actor looks at the QC folder of ${equipmentName}`,
      async (actor) => {
        const equipmentId = theEquipmentNamed(equipmentName).id;
        for (const resource of [
          `qc-equipment/${equipmentId}`,
          qcExecutionsResource({ equipmentId }),
        ]) {
          await Send.a(GetRequest.to(resource)).performAs(actor);
          await Ensure.that(LastResponse.status(), equals(200)).performAs(
            actor,
          );
        }
      },
    ),
};

/** The records the actor last looked at — every record when nobody looked. */
const theRecordsLookedAt = (
  actor: Parameters<typeof readQcExecutionHistory>[0],
): Promise<QcExecutionHistoryReadModel> =>
  readQcExecutionHistory(actor, theQcRecordFiltersLookedAt());

const atMinute = ({ date, time }: QcInstant): string => `${date} ${time}`;

/** A row's cells in column-name order — a sort key that ignores the order the columns came in. */
const sortKeyOf = (row: RecordRow): string =>
  JSON.stringify(
    Object.keys(row)
      .sort()
      .map((column) => row[column]),
  );

const sortedRows = (rows: RecordRow[]): RecordRow[] =>
  [...rows].sort((a, b) => sortKeyOf(a).localeCompare(sortKeyOf(b)));

const INTERVAL = 'فاصله از انجام قبلی';
const COUNT = 'تعداد انجام';

/**
 * «فاصله سوابق به صورت زیر باشد» — exactly these records with these intervals, regardless of order
 * (the API is newest first, the Gherkin oldest first).
 */
export const EnsureTheIntervalsOfTheQcRecordsAre = (
  expected: RecordRow[],
): Interaction =>
  Interaction.where(
    d`#actor ensures the intervals of the QC records are ${expected}`,
    async (actor) => {
      const { executions } = await theRecordsLookedAt(actor);
      const actual = executions.map((record) => ({
        [Column.activity]: record.activityName,
        [Column.equipment]: record.equipmentName,
        [Column.recordedAt]: tehranJalaliDateTimeOf(record.performedAt),
        [INTERVAL]: intervalLabel(record.intervalMinutes),
      }));
      await Ensure.that(
        sortedRows(actual),
        equals(sortedRows(expected)),
      ).performAs(actor);
    },
  );

/** «فاصله انجام «1405/07/01 10:00» از انجام قبلی «2 ساعت» باشد» — of the one record at that minute. */
export const EnsureTheIntervalOfTheQcRecordAt = (
  at: QcInstant,
  label: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC record at ${atMinute(at)} came ${label} after the previous one`,
    async (actor) => {
      const { executions } = await theRecordsLookedAt(actor);
      const atThatMinute = executions.filter(
        (record) => tehranJalaliDateTimeOf(record.performedAt) === atMinute(at),
      );
      await Ensure.that(atThatMinute.length, equals(1)).performAs(actor);
      await Ensure.that(
        intervalLabel(atThatMinute[0].intervalMinutes),
        equals(label),
      ).performAs(actor);
    },
  );

/** «تعداد انجام فعالیت ها به صورت زیر باشد» — exactly these counts, regardless of order. */
export const EnsureTheQcRecordCountsAre = (
  expected: RecordRow[],
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC record counts are ${expected}`,
    async (actor) => {
      const { counts } = await theRecordsLookedAt(actor);
      const actual = counts.map((count) => ({
        [Column.activity]: count.activityName,
        [Column.equipment]: count.equipmentName,
        [COUNT]: String(count.count),
      }));
      await Ensure.that(
        sortedRows(actual),
        equals(sortedRows(expected)),
      ).performAs(actor);
    },
  );

/** «تعداد انجام «…» روی «…» «2» باشد». */
export const EnsureTheQcRecordCountOf = (
  activityName: string,
  equipmentName: string,
  count: number,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} on ${equipmentName} counts ${count} record(s)`,
    async (actor) => {
      const { counts } = await theRecordsLookedAt(actor);
      const ofThePair = counts.find(
        (entry) =>
          entry.activityName === activityName &&
          entry.equipmentName === equipmentName,
      );
      await Ensure.that(ofThePair?.count ?? 0, equals(count)).performAs(actor);
    },
  );

// ---------------------------------------------------------------------------------------------
// Deleting a record

/**
 * The id of the one record of the activity on the equipment at that minute — looked up by the
 * System Admin, since the actor under test may be one who cannot read the records.
 */
const theIdOfTheQcRecord = async (
  activityName: string,
  equipmentName: string,
  at: QcInstant,
): Promise<string> => {
  const equipment = (
    await readAsTheSystemAdmin<Array<{ id: string; name: string }>>('equipment')
  ).find((candidate) => candidate.name === equipmentName);
  if (!equipment) {
    throw new Error(`No equipment is named "${equipmentName}".`);
  }
  const { executions } =
    await readAsTheSystemAdmin<QcExecutionHistoryReadModel>(
      qcExecutionsResource({ equipmentId: equipment.id }),
    );
  const matching = executions.filter(
    (record) =>
      record.activityName === activityName &&
      tehranJalaliDateTimeOf(record.performedAt) === atMinute(at),
  );
  if (matching.length !== 1) {
    throw new Error(
      `Expected one QC record of "${activityName}" on "${equipmentName}" at ${atMinute(at)}, found ${matching.length}.`,
    );
  }
  return matching[0].id;
};

export const DeleteQcRecord = {
  /** `DELETE qc-executions/:id` — the response is left for the step that judges it. */
  viaApiUsing: (
    activityName: string,
    equipmentName: string,
    at: QcInstant,
  ): Interaction =>
    Interaction.where(
      d`#actor deletes the QC record of ${activityName} on ${equipmentName} at ${atMinute(at)} (via API)`,
      async (actor) => {
        const id = await theIdOfTheQcRecord(activityName, equipmentName, at);
        await Send.a(DeleteRequest.to(`qc-executions/${id}`)).performAs(actor);
      },
    ),

  /** The passive «… توسط یاشار حذف شده باشد», checked for its 204. */
  asAPrecondition: (
    activityName: string,
    equipmentName: string,
    at: QcInstant,
  ): Task =>
    Task.where(
      d`#actor has deleted the QC record of ${activityName} on ${equipmentName} at ${atMinute(at)}`,
      DeleteQcRecord.viaApiUsing(activityName, equipmentName, at),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/** «سابقه انجام «…» روی «…» در «…» ساعت «…» همچنان ثبت شده باشد». */
export const EnsureTheQcRecordStillExists = (
  activityName: string,
  equipmentName: string,
  at: QcInstant,
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC record of ${activityName} on ${equipmentName} at ${atMinute(at)} still exists`,
    async (actor) => {
      const matching = (await qcRecordsOf(actor, equipmentName)).filter(
        (record) =>
          record.activityName === activityName &&
          tehranJalaliDateTimeOf(record.performedAt) === atMinute(at),
      );
      await Ensure.that(matching.length, equals(1)).performAs(actor);
    },
  );

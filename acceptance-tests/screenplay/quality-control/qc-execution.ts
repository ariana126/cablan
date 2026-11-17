import {
  Activity,
  actorCalled,
  d,
  Interaction,
  Question,
  Task,
} from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { LetItBeNow, LetTimePass } from '../common/clock';
import { tehranJalaliDateTimeOf } from '../common/jalali-datetime';
import { LogInAsPersona, realNameFor } from '../common/personas';
import { EnsureValidationErrorFor } from '../common/problem-detail';
import { keepingTheSpotlight } from '../common/spotlight';
import { theEquipmentNamed } from '../maintenance-management/maintenance-records';
import {
  QcExecutionReadModel,
  QcInstant,
  readQcExecutionHistory,
} from './qc-api';
import { theEquipmentIdNamed, theQcActivityNamed } from './qc-records';
import { AssignQcActivity } from './qc-assignment';

/**
 * Recording a QC activity as done — recording-qc-execution.feature, and every QC feature's «…
 * انجام … را … ثبت کرده باشد / ثبت شده باشد». `POST qc-equipment/:equipmentId/activities/
 * :activityId/executions` `{ trackingNumber, notes? }` → 201 `{ id }`; performer and time come from
 * the token and the system's clock. Refusals: 400 `validation-error` (field `trackingNumber`), 409
 * `equipment-retired`, 409 `qc-activity-not-assigned`, 403 for any role but QC inspector,
 * Management and System Admin.
 *
 * Doors: the API. In the product an inspector records by scanning the equipment's QR with the
 * phone's camera, then «ثبت انجام» in the dialog it opens — a camera the suite cannot hold, and the
 * design keeps the scanner a thin adapter in front of exactly this request. Facts read `GET
 * qc-executions?equipmentId=…` for the equipment's current name.
 */

/** The tracking number of a precondition record whose Gherkin names none. */
const UNSTATED_TRACKING_NUMBER = 'TR-QC';

export interface QcExecutionDetails {
  trackingNumber: string;
  notes?: string;
}

const executionsResourceOf = (activityName: string, equipmentName: string) =>
  Question.about(
    d`the QC executions of ${activityName} on ${equipmentName}`,
    () =>
      `qc-equipment/${theEquipmentNamed(equipmentName).id}/activities/${theQcActivityNamed(activityName).id}/executions`,
  );

export const RecordQcExecution = {
  /** The response is left for the step that judges it. */
  viaApiUsing: (
    activityName: string,
    equipmentName: string,
    { trackingNumber, notes }: QcExecutionDetails,
  ): Task =>
    Task.where(
      d`#actor records ${activityName} on ${equipmentName} with tracking number ${trackingNumber} (via API)`,
      Send.a(
        PostRequest.to(executionsResourceOf(activityName, equipmentName)).with(
          notes === undefined ? { trackingNumber } : { trackingNumber, notes },
        ),
      ),
    ),

  /** A precondition's record, checked for its 201. */
  asAPrecondition: (
    activityName: string,
    equipmentName: string,
    trackingNumber: string = UNSTATED_TRACKING_NUMBER,
  ): Task =>
    Task.where(
      d`#actor has recorded ${activityName} on ${equipmentName}`,
      RecordQcExecution.viaApiUsing(activityName, equipmentName, {
        trackingNumber,
      }),
      Ensure.that(LastResponse.status(), equals(201)),
    ),
};

export interface PreconditionRecord {
  /** Tehran wall-clock minute to record at; now, when absent. */
  at?: QcInstant;
  trackingNumber?: string;
}

/**
 * «نیکروش انجام «…» روی «…» را (در «…» ساعت «…») (با شماره ردیابی «…») ثبت کرده باشد» and the
 * passive «انجام … ثبت شده باشد»: the persona records each, in order — the system's clock moved to
 * a record's minute first, the persona logged in on it (a session from before a jump has expired).
 * A record with no minute is made a minute after the one before, so «آخرین» is never a tie on the
 * frozen clock. The spotlight stays where it was; whoever acts next logs in afresh
 * (`qc-records.ts#performAsTheActor`), since the clock may have jumped past their session.
 *
 * A record implies the activity was assigned to the equipment when it was made, so the System
 * Admin assigns it first unless it is — assigning-qc-activity states records before any assignment
 * and its scenario then unassigns or retires.
 */
export const recordedAsAPrecondition = async (
  personaName: string,
  activityName: string,
  equipmentName: string,
  records: PreconditionRecord[],
): Promise<void> => {
  await keepingTheSpotlight(async () => {
    await actorCalled('یاشار').attemptsTo(
      LogInAsPersona('یاشار'),
      AssignQcActivity.unlessAssigned(activityName, equipmentName),
    );
    const persona = actorCalled(personaName);
    for (const [index, { at, trackingNumber }] of records.entries()) {
      const moveTheClock: Activity[] = at
        ? [LetItBeNow(at.date, at.time)]
        : index > 0
          ? [LetTimePass(60_000)]
          : [];
      await persona.attemptsTo(
        ...moveTheClock,
        LogInAsPersona(personaName),
        RecordQcExecution.asAPrecondition(
          activityName,
          equipmentName,
          trackingNumber,
        ),
      );
    }
  });
};

/** Who records a precondition the Gherkin states in the passive voice: the QC inspector. */
export const THE_QC_INSPECTOR = 'نیکروش';

// ---------------------------------------------------------------------------------------------
// Refusals — the attempt's own response

/** «پیغام خطای شماره ردیابی نشان داده شود» — 400 `validation-error` on `trackingNumber`. */
export const EnsureToldTheTrackingNumberIsRequired = (): Task =>
  Task.where(
    '#actor ensures they were told a tracking number is required',
    EnsureValidationErrorFor('trackingNumber'),
  );

// ---------------------------------------------------------------------------------------------
// Facts — over the API

type Reader = Parameters<typeof readQcExecutionHistory>[0];

/** Every record of the equipment the system has by that name now, newest first. */
export const qcRecordsOf = async (
  actor: Reader,
  equipmentName: string,
): Promise<QcExecutionReadModel[]> =>
  (
    await readQcExecutionHistory(actor, {
      equipmentId: await theEquipmentIdNamed(actor, equipmentName),
    })
  ).executions;

const recordsOfActivity = async (
  actor: Reader,
  activityName: string,
  equipmentName: string,
): Promise<QcExecutionReadModel[]> =>
  (await qcRecordsOf(actor, equipmentName)).filter(
    (record) => record.activityName === activityName,
  );

/** The Gherkin's columns of a record. */
export const Column = {
  activity: 'فعالیت',
  equipment: 'تجهیز',
  recordedBy: 'ثبت کننده',
  recordedAt: 'زمان ثبت',
  trackingNumber: 'شماره ردیابی',
  notes: 'توضیحات',
} as const;

export type RecordRow = Record<string, string>;

/** A record as the Gherkin writes it: the performer's stored name, Tehran time, «-» for no notes. */
const asRow = (record: QcExecutionReadModel): RecordRow => ({
  [Column.activity]: record.activityName,
  [Column.equipment]: record.equipmentName,
  [Column.recordedBy]: record.performedByName,
  [Column.recordedAt]: tehranJalaliDateTimeOf(record.performedAt),
  [Column.trackingNumber]: record.trackingNumber,
  [Column.notes]: record.notes ?? '-',
});

const inRecordOrder = (rows: RecordRow[]): RecordRow[] =>
  [...rows].sort(
    (a, b) =>
      (a[Column.recordedAt] ?? '').localeCompare(b[Column.recordedAt] ?? '') ||
      (a[Column.activity] ?? '').localeCompare(b[Column.activity] ?? ''),
  );

/**
 * «سوابق انجام QC تجهیز «…» به صورت زیر باشد» — exactly these records, compared on the columns the
 * Gherkin names, regardless of order (the API is newest first, the Gherkin oldest first). «ثبت
 * کننده» names a persona, compared with the name the backend stores (`personas.ts#realNameFor`).
 */
export const EnsureTheQcRecordsOfEquipmentAre = (
  equipmentName: string,
  expected: RecordRow[],
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC records of ${equipmentName} are ${expected}`,
    async (actor) => {
      const columns = Object.keys(expected[0] ?? {});
      const wanted = expected.map((row) =>
        row[Column.recordedBy] === undefined
          ? row
          : {
              ...row,
              [Column.recordedBy]: realNameFor(row[Column.recordedBy]),
            },
      );
      const actual = (await qcRecordsOf(actor, equipmentName)).map((record) => {
        const row = asRow(record);
        return Object.fromEntries(
          columns.map((column) => [column, row[column] ?? '']),
        );
      });
      await Ensure.that(
        inRecordOrder(actual),
        equals(inRecordOrder(wanted)),
      ).performAs(actor);
    },
  );

/**
 * «سابقه انجام «…» در «…» ساعت «…» (همچنان) در سوابق انجام QC تجهیز «…» باشد» — a record of that
 * activity at that minute, listed under the equipment's current name.
 */
export const EnsureTheQcRecordIsAmongTheRecordsOf = (
  activityName: string,
  at: QcInstant,
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} recorded at ${at} is among the QC records of ${equipmentName}`,
    async (actor) => {
      const matching = (await qcRecordsOf(actor, equipmentName)).filter(
        (record) =>
          record.activityName === activityName &&
          record.equipmentName === equipmentName &&
          tehranJalaliDateTimeOf(record.performedAt) ===
            `${at.date} ${at.time}`,
      );
      await Ensure.that(matching.length, equals(1)).performAs(actor);
    },
  );

/** «هیچ انجامی برای «…» روی «…» ثبت نشده باشد» / «N سابقه انجام «…» روی «…» ثبت شده باشد». */
export const EnsureTheNumberOfQcRecordsOf = (
  activityName: string,
  equipmentName: string,
  count: number,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} on ${equipmentName} was recorded ${count} time(s)`,
    async (actor) => {
      const records = await recordsOfActivity(
        actor,
        activityName,
        equipmentName,
      );
      await Ensure.that(records.length, equals(count)).performAs(actor);
    },
  );

/**
 * «سابقه انجام «…» روی «…» با ثبت کننده «…» / با شماره ردیابی «…» ثبت شده باشد» — some record of
 * the activity on the equipment has that performer / tracking number.
 */
export const EnsureAQcRecordOf = (
  activityName: string,
  equipmentName: string,
  description: string,
  holds: (record: QcExecutionReadModel) => boolean,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} on ${equipmentName} was recorded ${description}`,
    async (actor) => {
      const records = await recordsOfActivity(
        actor,
        activityName,
        equipmentName,
      );
      await Ensure.that(
        records.filter(holds).length,
        isGreaterThan(0),
      ).performAs(actor);
    },
  );

export const recordedBy =
  (personaName: string) =>
  (record: QcExecutionReadModel): boolean =>
    record.performedByName === realNameFor(personaName);

export const withTrackingNumber =
  (trackingNumber: string) =>
  (record: QcExecutionReadModel): boolean =>
    record.trackingNumber === trackingNumber;

/** «توضیحات آخرین سابقه انجام «…» روی «…» «…» باشد» — the newest record's notes. */
export const EnsureTheNotesOfTheLatestQcRecord = (
  activityName: string,
  equipmentName: string,
  notes: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the latest record of ${activityName} on ${equipmentName} has the notes ${notes}`,
    async (actor) => {
      const [latest] = await recordsOfActivity(
        actor,
        activityName,
        equipmentName,
      );
      await Ensure.that(latest?.notes, equals(notes)).performAs(actor);
    },
  );

/** «هر N سابقه انجام QC «…» با فعالیت «…» باشند» — N records, every one of that activity. */
export const EnsureEveryQcRecordOfEquipmentIsOf = (
  equipmentName: string,
  count: number,
  activityName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures all ${count} QC records of ${equipmentName} are of ${activityName}`,
    async (actor) => {
      const activities = (await qcRecordsOf(actor, equipmentName)).map(
        (record) => record.activityName,
      );
      await Ensure.that(
        activities,
        equals(activities.map(() => activityName)),
      ).performAs(actor);
      await Ensure.that(activities.length, equals(count)).performAs(actor);
    },
  );

/**
 * «هیچ سابقه انجام QC برای «…» در سوابق فعالیت های QC نباشد» — no record of any equipment by that
 * name in the plant-wide records. Matched by name: a deleted equipment's id is gone.
 */
export const EnsureNoQcRecordNamesTheEquipment = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures no QC record names ${equipmentName}`,
    async (actor) => {
      const { executions } = await readQcExecutionHistory(actor);
      await Ensure.that(
        executions.filter((record) => record.equipmentName === equipmentName),
        equals([]),
      ).performAs(actor);
    },
  );

/**
 * «اینکه هیچ آنالیز روزانه ای با شماره ردیابی «…» ثبت نشده باشد» — true of a fresh scenario's
 * system, so checked rather than made: `GET boms` holds no daily BOM with that tracking number. A
 * QC record's tracking number is any text, never looked up among daily BOMs.
 */
export const EnsureNoDailyBomHasTheTrackingNumber = (
  trackingNumber: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures no daily BOM has the tracking number ${trackingNumber}`,
    async (actor) => {
      await Send.a(GetRequest.to('boms')).performAs(actor);
      await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
      const boms = await actor.answer(
        LastResponse.body<Array<{ trackingNumber: string }>>(),
      );
      await Ensure.that(
        boms.filter((bom) => bom.trackingNumber === trackingNumber),
        equals([]),
      ).performAs(actor);
    },
  );

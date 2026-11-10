import { actorCalled, d, Interaction, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { DailyPmSchedulePage } from '../ui/daily-pm-schedule-page';
import { LetItBeNow, LetItBeToday } from '../common/clock';
import {
  isoDateToJalaliDate,
  jalaliDateToIsoDate,
  tehranJalaliDateTimeOf,
} from '../common/jalali-datetime';
import { LogInAsPersona, realNameFor } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import {
  LocateDailyPmSchedulePage,
  ListRow,
  WaitForTheDialogToBeAnswered,
} from './maintenance-pages';
import {
  ApiReader,
  delayAmountLabel,
  MaintenanceExecutionReadModel,
  MaintenanceHistoryEntryReadModel,
  occurrenceStatusLabels,
  operatingHoursLabel,
  readMaintenanceExecutions,
  readMaintenanceHistory,
  specialtyLabels,
} from './maintenance-api';
import { MaintenanceHistoryRange } from '../common/maintenance-history-view-context';
import {
  asPersonaOn,
  renewTheSessionInTheSpotlight,
  theEquipmentNamed,
  theMaintenanceTaskNamed,
  theMaintenanceTasksNamed,
  thePlanItemFor,
} from './maintenance-records';

/**
 * Recording that a PM job was done, and the maintenance history it builds —
 * recording-maintenance-execution.feature and the history facts planning-preventive-maintenance
 * states. A recording is always "now", by whoever is signed in
 * (`POST equipment/:id/pm-plan-items/:itemId/executions`, `{ notes?, operatingHours? }`); which
 * occurrence it lands on is the backend's rule. The history is
 * `GET equipment/:id/maintenance-history`, newest first.
 */

/**
 * What a recording carries besides who and when — both optional. Operating hours are the text the
 * Gherkin writes («1250.5», «-5», «دوازده»): typed as is into the dialog, sent as a number over
 * the API.
 */
export interface ExecutionDetails {
  notes?: string;
  operatingHours?: string;
}

export const RecordMaintenanceExecution = {
  /**
   * Through the daily list: the task's row, «ثبت انجام», the optional notes, submit. Only work
   * that is due or overdue today has a row — the reason the Gherkin's other recordings (an early
   * one, on 06/29) take the API door.
   */
  using: (
    maintenanceTask: string,
    { notes, operatingHours }: ExecutionDetails = {},
  ): Task => {
    const { activityName, equipmentName } =
      theMaintenanceTaskNamed(maintenanceTask);
    const recordButton = DailyPmSchedulePage.recordButton(
      activityName,
      equipmentName,
    );
    return Task.where(
      d`#actor records that ${maintenanceTask} was done`,
      LocateDailyPmSchedulePage(),
      Wait.until(recordButton, isVisible()),
      Click.on(recordButton),
      Wait.until(DailyPmSchedulePage.notesField(), isVisible()),
      ...(notes === undefined
        ? []
        : [Enter.theValue(notes).into(DailyPmSchedulePage.notesField())]),
      ...(operatingHours === undefined
        ? []
        : [
            Enter.theValue(operatingHours).into(
              DailyPmSchedulePage.operatingHoursField(),
            ),
          ]),
      Click.on(DailyPmSchedulePage.submitRecordButton()),
      WaitForTheDialogToBeAnswered(
        DailyPmSchedulePage.submitRecordButton(),
        DailyPmSchedulePage.recordDialogAlert(),
        DailyPmSchedulePage.operatingHoursError(),
      ),
    );
  },

  /** The API door: who may record, and which occurrence a recording lands on, are backend rules. */
  viaApiUsing: (
    maintenanceTask: string,
    { notes, operatingHours }: ExecutionDetails = {},
  ): Task => {
    const { activityName, equipmentName } =
      theMaintenanceTaskNamed(maintenanceTask);
    const item = thePlanItemFor(equipmentName, activityName);
    return Task.where(
      d`#actor records that ${maintenanceTask} was done (via API)`,
      Send.a(
        PostRequest.to(
          `equipment/${item.equipment.id}/pm-plan-items/${item.id}/executions`,
        ).with({
          ...(notes === undefined ? {} : { notes }),
          ...(operatingHours === undefined
            ? {}
            : { operatingHours: Number(operatingHours) }),
        }),
      ),
    );
  },
};

/**
 * Records and checks it was accepted. When the step names the occurrence it expects the recording
 * to land on («… برای موعد «…» …»), the backend's `201 { id, dueDate }` must say that occurrence —
 * the backend picks it, so the precondition proves what it states rather than assuming it.
 */
const RecordAsAPrecondition = (
  maintenanceTask: string,
  expectedDueDate?: string,
  details: ExecutionDetails = {},
): Task =>
  Task.where(
    d`#actor has recorded that ${maintenanceTask} was done`,
    RecordMaintenanceExecution.viaApiUsing(maintenanceTask, details),
    Ensure.that(LastResponse.status(), equals(201)),
    ...(expectedDueDate === undefined
      ? []
      : [
          Ensure.that(
            LastResponse.body<{ dueDate: string }>().dueDate,
            equals(jalaliDateToIsoDate(expectedDueDate)),
          ),
        ]),
  );

/**
 * «انجام تعویض روغن اکسترودر 1 (برای موعد «…») (در «…») ثبت شده باشد» — recorded by the system
 * admin, on the day named (the system's clock moved there first, so the recording is "now" then)
 * or today, landing on the named occurrence when there is one. Logs in after moving the clock: a
 * session from before the jump has expired.
 */
export const recordedAsAPrecondition = async (
  maintenanceTask: string,
  onDate?: string,
  forDueDate?: string,
): Promise<void> => {
  await keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(
      ...(onDate === undefined ? [] : [LetItBeToday(onDate)]),
      LogInAsPersona('یاشار'),
      RecordAsAPrecondition(maintenanceTask, forDueDate),
    ),
  );
  if (onDate !== undefined) {
    await renewTheSessionInTheSpotlight();
  }
};

/**
 * The same, for every task the text names — «انجام تعویض روغن اکسترودر 1 و تعویض روغن اکسترودر 2
 * (برای موعد «…») در «…» ثبت شده باشد» (issue #110) — one after the other, in the order named.
 */
export const recordedEachAsAPrecondition = async (
  maintenanceTasks: string,
  onDate?: string,
  forDueDate?: string,
): Promise<void> => {
  for (const maintenanceTask of theMaintenanceTasksNamed(maintenanceTasks)) {
    await recordedAsAPrecondition(maintenanceTask, onDate, forDueDate);
  }
};

/**
 * «مسلمی انجام … (برای موعد «…») را در «…» ساعت «…» ثبت کرده باشد» — by that persona, at that
 * Tehran minute, landing on the named occurrence when there is one.
 */
export const recordedByAsAPrecondition = async (
  personaName: string,
  maintenanceTask: string,
  date: string,
  time: string,
  forDueDate?: string,
): Promise<void> => {
  await keepingTheSpotlight(async () => {
    await actorCalled(personaName).attemptsTo(LetItBeNow(date, time));
    await actorCalled(personaName).attemptsTo(LogInAsPersona(personaName));
    await actorCalled(personaName).attemptsTo(
      RecordAsAPrecondition(maintenanceTask, forDueDate),
    );
  });
  await renewTheSessionInTheSpotlight();
};

/**
 * «مسلمی انجام … برای موعد «…» را در «…» (با ساعت کارکرد «…») ثبت کرده باشد» — by that persona,
 * on that day (the clock moved there first), landing on the named occurrence.
 */
export const recordedByOnAsAPrecondition = (
  personaName: string,
  maintenanceTask: string,
  forDueDate: string,
  onDate: string,
  details: ExecutionDetails = {},
): Promise<void> =>
  asPersonaOn(
    personaName,
    onDate,
    RecordAsAPrecondition(maintenanceTask, forDueDate, details),
  );

/** Every entry — recordings and missed occurrences (issue #114) — of the whole history or a range. */
const historyOf = (
  actor: ApiReader,
  equipmentName: string,
  range?: MaintenanceHistoryRange,
): Promise<MaintenanceHistoryEntryReadModel[]> =>
  readMaintenanceHistory(actor, theEquipmentNamed(equipmentName).id, range);

/** The recordings alone — what every fact phrased about «انجام» speaks of. */
const executionsOf = (
  actor: ApiReader,
  equipmentName: string,
): Promise<MaintenanceExecutionReadModel[]> =>
  readMaintenanceExecutions(actor, theEquipmentNamed(equipmentName).id);

/** What the history writes where nothing was done — a missed occurrence's performer and time. */
const NOTHING = '-';

/** One history entry as the Gherkin's history table writes it, column by column. */
const historyColumns: Record<
  string,
  (entry: MaintenanceHistoryEntryReadModel) => string
> = {
  فعالیت: (entry) => entry.activityName,
  تخصص: (entry) =>
    entry.activitySpecialty === null
      ? ''
      : specialtyLabels[entry.activitySpecialty],
  موعد: (entry) => isoDateToJalaliDate(entry.dueDate),
  'انجام دهنده': (entry) => entry.performedBy ?? NOTHING,
  'زمان انجام': (entry) =>
    entry.performedAt === null
      ? NOTHING
      : tehranJalaliDateTimeOf(entry.performedAt),
  وضعیت: (entry) => occurrenceStatusLabels[entry.status],
  توضیحات: (entry) => entry.notes ?? '',
};

/**
 * The rows in one order whatever order they came in: by due date, then activity (issue #114 — the
 * history is newest first by the day a recording was made, the Gherkin lists oldest due date
 * first), then by every other column, so equal keys cannot reorder. Jalali `YYYY/MM/DD` sorts as
 * text.
 */
const inHistoryOrder = (rows: ListRow[]): ListRow[] => {
  const key = (row: ListRow) =>
    [row['موعد'] ?? '', row['فعالیت'] ?? '', JSON.stringify(row)].join(
      '\u0000',
    );
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)));
};

/**
 * «سابقه تعمیرات اکسترودر 1 به صورت زیر باشد» — the history (of the range given, if any) holds
 * exactly the rows given, compared on the columns the Gherkin names, in any order. «انجام دهنده»
 * names a persona; the history shows the name the backend stores (`personas.ts#realNameFor`). «-»
 * under «انجام دهنده» / «زمان انجام» is a missed occurrence's nothing.
 */
export const EnsureMaintenanceHistoryIs = (
  equipmentName: string,
  expected: ListRow[],
  range?: MaintenanceHistoryRange,
): Interaction =>
  Interaction.where(
    d`#actor ensures the maintenance history of ${equipmentName} is ${expected}`,
    async (actor) => {
      const columns = Object.keys(expected[0] ?? {});
      for (const column of columns) {
        if (!historyColumns[column]) {
          throw new Error(`The maintenance history has no "${column}" column.`);
        }
      }
      const wanted = expected.map((row) =>
        Object.fromEntries(
          columns.map((column) => [
            column,
            column === 'انجام دهنده' && row[column] !== NOTHING
              ? realNameFor(row[column])
              : row[column],
          ]),
        ),
      );
      const actual = (await historyOf(actor, equipmentName, range)).map(
        (entry) =>
          Object.fromEntries(
            columns.map((column) => [column, historyColumns[column](entry)]),
          ),
      );
      await Ensure.that(
        inHistoryOrder(actual),
        equals(inHistoryOrder(wanted)),
      ).performAs(actor);
    },
  );

const entriesFor = async (
  actor: ApiReader,
  maintenanceTask: string,
): Promise<MaintenanceExecutionReadModel[]> => {
  const { activityName, equipmentName } =
    theMaintenanceTaskNamed(maintenanceTask);
  return (await executionsOf(actor, equipmentName)).filter(
    (entry) => entry.activityName === activityName,
  );
};

/**
 * «انجام تعویض روغن اکسترودر 1 برای موعد «…» (توسط «…») ثبت شده باشد» — the history holds a
 * recording for that occurrence (by that persona).
 */
export const EnsureExecutionWasRecorded = (
  maintenanceTask: string,
  dueDate: string,
  byPersona?: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${maintenanceTask} was recorded for ${dueDate}`,
    async (actor) => {
      const matching = (await entriesFor(actor, maintenanceTask)).filter(
        (entry) =>
          entry.dueDate === jalaliDateToIsoDate(dueDate) &&
          (byPersona === undefined ||
            entry.performedBy === realNameFor(byPersona)),
      );
      await Ensure.that(matching.length, equals(1)).performAs(actor);
    },
  );

/** «انجامی برای تعویض روغن اکسترودر 1 ثبت نشده باشد» — and «هیچ انجامی …», said as a precondition. */
export const EnsureNoExecutionWasRecorded = (
  maintenanceTask: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures nothing was recorded for ${maintenanceTask}`,
    async (actor) => {
      const entries = await entriesFor(actor, maintenanceTask);
      await Ensure.that(entries.length, equals(0)).performAs(actor);
    },
  );

/**
 * «سابقه انجام تعویض روغن اکسترودر 1 در «…» همچنان در سابقه تعمیرات اکسترودر 1 باشد» — a
 * recording made that (Tehran) day is still in the history after the plan changed.
 */
export const EnsureExecutionIsStillInHistory = (
  maintenanceTask: string,
  performedOn: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the recording of ${maintenanceTask} on ${performedOn} is still in the history`,
    async (actor) => {
      const sameDay = (await entriesFor(actor, maintenanceTask)).filter(
        (entry) =>
          tehranJalaliDateTimeOf(entry.performedAt).startsWith(
            `${performedOn} `,
          ),
      );
      await Ensure.that(sameDay.length, isGreaterThan(0)).performAs(actor);
    },
  );

/**
 * «انجام دهنده تعویض روغن اکسترودر 1 در «…» همچنان مسلمی باشد» (registring-user, issue #94) — the
 * recording of the task made that (Tehran) day still names the persona who made it, whatever has
 * happened to their account since. The history shows the name the backend stores
 * (`personas.ts#realNameFor`).
 */
export const EnsureExecutionPerformerIs = (
  maintenanceTask: string,
  performedOn: string,
  personaName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the recording of ${maintenanceTask} on ${performedOn} still names ${personaName}`,
    async (actor) => {
      const performers = (await entriesFor(actor, maintenanceTask))
        .filter((entry) =>
          tehranJalaliDateTimeOf(entry.performedAt).startsWith(
            `${performedOn} `,
          ),
        )
        .map((entry) => entry.performedBy);
      await Ensure.that(
        performers,
        equals([realNameFor(personaName)]),
      ).performAs(actor);
    },
  );

/**
 * «هیچ انجامی از تعویض روغن اکسترودر 1 در «…» در سابقه تعمیرات اکسترودر 1 نباشد» — the history
 * holds no recording of the task made that (Tehran) day.
 */
export const EnsureNoExecutionInHistoryOn = (
  maintenanceTask: string,
  performedOn: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures nothing of ${maintenanceTask} was recorded on ${performedOn}`,
    async (actor) => {
      const sameDay = (await entriesFor(actor, maintenanceTask)).filter(
        (entry) =>
          tehranJalaliDateTimeOf(entry.performedAt).startsWith(
            `${performedOn} `,
          ),
      );
      await Ensure.that(sameDay, equals([])).performAs(actor);
    },
  );

/**
 * «مقدار تاخیر تعویض روغن اکسترودر 1 برای موعد «…» در سابقه تعمیرات اکسترودر 1 «…» باشد» — the
 * history holds exactly one recording for that occurrence, and its `daysLate` reads as the
 * Gherkin writes it («N روز», or «-»).
 */
export const EnsureDelayAmountInHistory = (
  maintenanceTask: string,
  dueDate: string,
  delayAmount: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the history shows ${maintenanceTask} due ${dueDate} as ${delayAmount} late`,
    async (actor) => {
      const amounts = (await entriesFor(actor, maintenanceTask))
        .filter((entry) => entry.dueDate === jalaliDateToIsoDate(dueDate))
        .map((entry) => delayAmountLabel(entry.daysLate));
      await Ensure.that(amounts, equals([delayAmount])).performAs(actor);
    },
  );

/**
 * «ساعت کارکرد آن در سابقه تعمیرات اکسترودر 1 «…» باشد» — the recording just made is the
 * equipment's newest history entry (the history is newest first), and its operating hours read as
 * the history shows them: «1250.5 ساعت», or «ثبت نشده» when it gave none.
 */
export const EnsureOperatingHoursOfTheLatestRecording = (
  equipmentName: string,
  shown: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the latest recording on ${equipmentName} shows operating hours ${shown}`,
    async (actor) => {
      const [latest] = await executionsOf(actor, equipmentName);
      if (!latest) {
        throw new Error(
          `The maintenance history of "${equipmentName}" is empty.`,
        );
      }
      await Ensure.that(
        operatingHoursLabel(latest.operatingHours),
        equals(shown),
      ).performAs(actor);
    },
  );

/** «پیغام خطای ساعت کارکرد نشان داده شود» — the record dialog's operating-hours field says so. */
export const EnsureOperatingHoursErrorShown = (): Task =>
  Task.where(
    '#actor ensures the record dialog shows the operating hours error',
    Wait.until(DailyPmSchedulePage.operatingHoursError(), isVisible()),
  );

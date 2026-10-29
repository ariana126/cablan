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
  MaintenanceExecutionReadModel,
  occurrenceStatusLabels,
  readMaintenanceHistory,
} from './maintenance-api';
import {
  renewTheSessionInTheSpotlight,
  theEquipmentNamed,
  theMaintenanceTaskNamed,
  thePlanItemFor,
} from './maintenance-records';

/**
 * Recording that a PM job was done, and the maintenance history it builds —
 * recording-maintenance-execution.feature and the history facts planning-preventive-maintenance
 * states. A recording is always "now", by whoever is signed in
 * (`POST equipment/:id/pm-plan-items/:itemId/executions`, `{ notes? }`); which occurrence it lands
 * on is the backend's rule. The history is `GET equipment/:id/maintenance-history`, newest first.
 */

export const RecordMaintenanceExecution = {
  /**
   * Through the daily list: the task's row, «ثبت انجام», the optional notes, submit. Only work
   * that is due or overdue today has a row — the reason the Gherkin's other recordings (an early
   * one, on 06/29) take the API door.
   */
  using: (maintenanceTask: string, notes?: string): Task => {
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
      Click.on(DailyPmSchedulePage.submitRecordButton()),
      WaitForTheDialogToBeAnswered(
        DailyPmSchedulePage.submitRecordButton(),
        DailyPmSchedulePage.recordDialogAlert(),
      ),
    );
  },

  /** The API door: who may record, and which occurrence a recording lands on, are backend rules. */
  viaApiUsing: (maintenanceTask: string): Task => {
    const { activityName, equipmentName } =
      theMaintenanceTaskNamed(maintenanceTask);
    const item = thePlanItemFor(equipmentName, activityName);
    return Task.where(
      d`#actor records that ${maintenanceTask} was done (via API)`,
      Send.a(
        PostRequest.to(
          `equipment/${item.equipment.id}/pm-plan-items/${item.id}/executions`,
        ).with({}),
      ),
    );
  },
};

const RecordAsAPrecondition = (maintenanceTask: string): Task =>
  Task.where(
    d`#actor has recorded that ${maintenanceTask} was done`,
    RecordMaintenanceExecution.viaApiUsing(maintenanceTask),
    Ensure.that(LastResponse.status(), equals(201)),
  );

/**
 * «انجام تعویض روغن اکسترودر 1 (برای موعد «…») (در «…») ثبت شده باشد» — recorded by the system
 * admin, on the day named (the system's clock moved there first, so the recording is "now" then)
 * or today. Logs in after moving the clock: a session from before the jump has expired.
 */
export const recordedAsAPrecondition = async (
  maintenanceTask: string,
  onDate?: string,
): Promise<void> => {
  await keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(
      ...(onDate === undefined ? [] : [LetItBeToday(onDate)]),
      LogInAsPersona('یاشار'),
      RecordAsAPrecondition(maintenanceTask),
    ),
  );
  if (onDate !== undefined) {
    await renewTheSessionInTheSpotlight();
  }
};

/** «مسلمی انجام … را در «…» ساعت «…» ثبت کرده باشد» — by that persona, at that Tehran minute. */
export const recordedByAsAPrecondition = async (
  personaName: string,
  maintenanceTask: string,
  date: string,
  time: string,
): Promise<void> => {
  await keepingTheSpotlight(async () => {
    await actorCalled(personaName).attemptsTo(LetItBeNow(date, time));
    await actorCalled(personaName).attemptsTo(LogInAsPersona(personaName));
    await actorCalled(personaName).attemptsTo(
      RecordAsAPrecondition(maintenanceTask),
    );
  });
  await renewTheSessionInTheSpotlight();
};

const historyOf = (
  actor: ApiReader,
  equipmentName: string,
): Promise<MaintenanceExecutionReadModel[]> =>
  readMaintenanceHistory(actor, theEquipmentNamed(equipmentName).id);

/** One history entry as the Gherkin's history table writes it, column by column. */
const historyColumns: Record<
  string,
  (entry: MaintenanceExecutionReadModel) => string
> = {
  فعالیت: (entry) => entry.activityName,
  موعد: (entry) => isoDateToJalaliDate(entry.dueDate),
  'انجام دهنده': (entry) => entry.performedBy,
  'زمان انجام': (entry) => tehranJalaliDateTimeOf(entry.performedAt),
  وضعیت: (entry) => occurrenceStatusLabels[entry.status],
  توضیحات: (entry) => entry.notes ?? '',
};

/**
 * «سابقه تعمیرات اکسترودر 1 به صورت زیر باشد» — the history, newest first, exactly the rows
 * given, compared on the columns the Gherkin names. «انجام دهنده» names a persona; the history
 * shows the name the backend stores (`personas.ts#realNameFor`).
 */
export const EnsureMaintenanceHistoryIs = (
  equipmentName: string,
  expected: ListRow[],
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
            column === 'انجام دهنده' ? realNameFor(row[column]) : row[column],
          ]),
        ),
      );
      const actual = (await historyOf(actor, equipmentName)).map((entry) =>
        Object.fromEntries(
          columns.map((column) => [column, historyColumns[column](entry)]),
        ),
      );
      await Ensure.that(actual, equals(wanted)).performAs(actor);
    },
  );

const entriesFor = async (
  actor: ApiReader,
  maintenanceTask: string,
): Promise<MaintenanceExecutionReadModel[]> => {
  const { activityName, equipmentName } =
    theMaintenanceTaskNamed(maintenanceTask);
  return (await historyOf(actor, equipmentName)).filter(
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

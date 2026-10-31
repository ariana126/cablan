import {
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { DailyPmSchedulePage } from '../ui/daily-pm-schedule-page';
import { PmOverviewPage } from '../ui/pm-overview-page';
import { jalaliDateToIsoDate } from '../common/jalali-datetime';
import {
  ListRow,
  LocateDailyPmSchedulePage,
  LocatePmOverviewPage,
  onlyTheColumnsOf,
  TheRowsOf,
} from './maintenance-pages';
import {
  delayAmountLabel,
  occurrenceStatusLabels,
  readDailyPmSchedule,
  readPmOverview,
} from './maintenance-api';
import {
  MaintenanceTask,
  theMaintenanceTaskNamed,
} from './maintenance-records';

/**
 * The daily PM list («برنامه روزانه») and the overview («برنامه کلی تعمیرات و نگهداری») —
 * daily-pm-schedule.feature and the status facts of recording-maintenance-execution. Both are
 * computed by the backend for "today", the Tehran date of its clock: `GET pm-schedule/daily`
 * (due / overdue only) and `GET pm-schedule/overview` (every occurrence so far, with its status).
 */

/** The page columns, by the header text a visitor reads. */
const Column = {
  equipment: 'تجهیز',
  activity: 'فعالیت',
  dueDate: 'موعد',
  status: 'وضعیت',
  daysOverdue: 'روزهای تاخیر',
  /** The overview's column for a late occurrence's delay — «N روز» or «-». */
  delayAmount: 'مقدار تاخیر',
} as const;

export const ViewDailyPmSchedule = {
  using: (): Task =>
    Task.where(
      '#actor looks at the daily PM schedule',
      LocateDailyPmSchedulePage(),
    ),

  viaApiUsing: (): Task =>
    Task.where(
      '#actor looks at the daily PM schedule (via API)',
      Send.a(GetRequest.to('pm-schedule/daily')),
    ),
};

export const ViewPmOverview = {
  using: (): Task =>
    Task.where('#actor looks at the PM overview', LocatePmOverviewPage()),

  viaApiUsing: (): Task =>
    Task.where(
      '#actor looks at the PM overview (via API)',
      Send.a(GetRequest.to('pm-schedule/overview')),
    ),
};

/** «… نمایش داده نشود» after a refused «تلاش …» — the request was turned away. */
export const EnsureTheScheduleWasNotShown = (): Task =>
  Task.where(
    '#actor ensures the schedule was not shown',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

const TheDailyPmRows = (): QuestionAdapter<ListRow[]> =>
  TheRowsOf('the rows of the daily PM schedule', DailyPmSchedulePage);

const TheOverviewRows = (): QuestionAdapter<ListRow[]> =>
  TheRowsOf('the rows of the PM overview', PmOverviewPage);

const isRowOf =
  ({ activityName, equipmentName }: MaintenanceTask) =>
  (row: ListRow): boolean =>
    row[Column.equipment] === equipmentName &&
    row[Column.activity] === activityName;

/** The page's rows for one task, reduced to `columns`. */
const TheDailyPmRowsFor = (
  maintenanceTask: string,
  columns: string[],
): QuestionAdapter<ListRow[]> =>
  Question.about(d`the daily PM rows for ${maintenanceTask}`, async (actor) => {
    const task = theMaintenanceTaskNamed(maintenanceTask);
    const rows = (await actor.answer(TheDailyPmRows())).filter(isRowOf(task));
    return rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? ''])),
    );
  });

/** «برنامه روزانه به صورت زیر باشد» — the page shows exactly these rows, in this order. */
export const EnsureDailyPmScheduleShows = (expected: ListRow[]): Task =>
  Task.where(
    d`#actor ensures the daily PM schedule shows ${expected}`,
    Ensure.that(
      Question.about(
        'the daily PM schedule, as the Gherkin reads it',
        async (actor) =>
          onlyTheColumnsOf(expected, await actor.answer(TheDailyPmRows())),
      ),
      equals(expected),
    ),
  );

/** «تعویض روغن اکسترودر 1 در برنامه روزانه نباشد» — on the page the actor is looking at. */
export const EnsureNotInDailyPmSchedule = (maintenanceTask: string): Task =>
  Task.where(
    d`#actor ensures ${maintenanceTask} is not in the daily PM schedule`,
    Ensure.that(
      TheDailyPmRowsFor(maintenanceTask, [Column.dueDate]),
      equals([]),
    ),
  );

/** «تعویض روغن اکسترودر 1 با موعد «…» و «…» روز تاخیر عقب افتاده باشد». */
export const EnsureOverdueInDailyPmSchedule = (
  maintenanceTask: string,
  dueDate: string,
  daysOverdue: string,
): Task =>
  Task.where(
    d`#actor ensures ${maintenanceTask} is ${daysOverdue} days overdue since ${dueDate}`,
    Ensure.that(
      TheDailyPmRowsFor(maintenanceTask, [
        Column.dueDate,
        Column.status,
        Column.daysOverdue,
      ]),
      equals([
        {
          [Column.dueDate]: dueDate,
          [Column.status]: occurrenceStatusLabels.overdue,
          [Column.daysOverdue]: daysOverdue,
        },
      ]),
    ),
  );

/** «تعویض روغن اکسترودر 1 فقط یک بار و با موعد «…» سررسیده باشد». */
export const EnsureDueOnlyOnceInDailyPmSchedule = (
  maintenanceTask: string,
  dueDate: string,
): Task =>
  Task.where(
    d`#actor ensures ${maintenanceTask} is due once, on ${dueDate}`,
    Ensure.that(
      TheDailyPmRowsFor(maintenanceTask, [Column.dueDate, Column.status]),
      equals([
        {
          [Column.dueDate]: dueDate,
          [Column.status]: occurrenceStatusLabels.due,
        },
      ]),
    ),
  );

/**
 * «وضعیت تعویض روغن اکسترودر 1 برای موعد «…» «…» باشد» — one occurrence's status in the
 * overview: off the page the actor is looking at, or over the API by an observer.
 */
export const EnsureOccurrenceStatus = {
  onThePage: (
    maintenanceTask: string,
    dueDate: string,
    statusLabel: string,
  ): Task =>
    Task.where(
      d`#actor ensures the overview shows ${maintenanceTask} due ${dueDate} as ${statusLabel}`,
      Ensure.that(
        Question.about(
          d`the overview status of ${maintenanceTask} due ${dueDate}`,
          async (actor) => {
            const task = theMaintenanceTaskNamed(maintenanceTask);
            return (await actor.answer(TheOverviewRows()))
              .filter(isRowOf(task))
              .filter((row) => row[Column.dueDate] === dueDate)
              .map((row) => row[Column.status]);
          },
        ),
        equals([statusLabel]),
      ),
    ),

  viaApi: (
    maintenanceTask: string,
    dueDate: string,
    statusLabel: string,
  ): Interaction =>
    Interaction.where(
      d`#actor ensures the overview has ${maintenanceTask} due ${dueDate} as ${statusLabel}`,
      async (actor) => {
        const { activityName, equipmentName } =
          theMaintenanceTaskNamed(maintenanceTask);
        const statuses = (await readPmOverview(actor))
          .filter(
            (occurrence) =>
              occurrence.equipmentName === equipmentName &&
              occurrence.activityName === activityName &&
              occurrence.dueDate === jalaliDateToIsoDate(dueDate),
          )
          .map((occurrence) => occurrenceStatusLabels[occurrence.status]);
        await Ensure.that(statuses, equals([statusLabel])).performAs(actor);
      },
    ),
};

/**
 * «مقدار تاخیر تعویض روغن اکسترودر 1 برای موعد «…» در برنامه کلی تعمیرات و نگهداری «…» باشد» —
 * one occurrence's delay amount in the overview («N روز», or «-»): off the page the actor is
 * looking at (its «مقدار تاخیر» column), or over the API (`daysLate`) by an observer.
 */
export const EnsureOccurrenceDelayAmount = {
  onThePage: (
    maintenanceTask: string,
    dueDate: string,
    delayAmount: string,
  ): Task =>
    Task.where(
      d`#actor ensures the overview shows ${maintenanceTask} due ${dueDate} as ${delayAmount} late`,
      Ensure.that(
        Question.about(
          d`the overview delay amount of ${maintenanceTask} due ${dueDate}`,
          async (actor) => {
            const task = theMaintenanceTaskNamed(maintenanceTask);
            return (await actor.answer(TheOverviewRows()))
              .filter(isRowOf(task))
              .filter((row) => row[Column.dueDate] === dueDate)
              .map((row) => row[Column.delayAmount]);
          },
        ),
        equals([delayAmount]),
      ),
    ),

  viaApi: (
    maintenanceTask: string,
    dueDate: string,
    delayAmount: string,
  ): Interaction =>
    Interaction.where(
      d`#actor ensures the overview has ${maintenanceTask} due ${dueDate} as ${delayAmount} late`,
      async (actor) => {
        const { activityName, equipmentName } =
          theMaintenanceTaskNamed(maintenanceTask);
        const amounts = (await readPmOverview(actor))
          .filter(
            (occurrence) =>
              occurrence.equipmentName === equipmentName &&
              occurrence.activityName === activityName &&
              occurrence.dueDate === jalaliDateToIsoDate(dueDate),
          )
          .map((occurrence) => delayAmountLabel(occurrence.daysLate));
        await Ensure.that(amounts, equals([delayAmount])).performAs(actor);
      },
    ),
};

/**
 * «تعویض روغن اکسترودر 1 در برنامه روزانه «…» نباشد» — read over the API by an observer whose
 * system clock has been moved to that day first (`maintenance-records.ts#asTheSystemAdminOn`).
 */
export const EnsureNotInDailyPmScheduleViaApi = (
  maintenanceTask: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${maintenanceTask} is not in today's daily PM schedule`,
    async (actor) => {
      const { activityName, equipmentName } =
        theMaintenanceTaskNamed(maintenanceTask);
      const tasks = (await readDailyPmSchedule(actor)).filter(
        (task) =>
          task.equipmentName === equipmentName &&
          task.activityName === activityName,
      );
      await Ensure.that(tasks, equals([])).performAs(actor);
    },
  );

/** «هیچ کاری از اکسترودر 1 در برنامه روزانه «…» نباشد» — likewise, for any of its activities. */
export const EnsureNothingOfEquipmentInDailyPmScheduleViaApi = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures nothing of ${equipmentName} is in today's daily PM schedule`,
    async (actor) => {
      const tasks = (await readDailyPmSchedule(actor)).filter(
        (task) => task.equipmentName === equipmentName,
      );
      await Ensure.that(tasks, equals([])).performAs(actor);
    },
  );

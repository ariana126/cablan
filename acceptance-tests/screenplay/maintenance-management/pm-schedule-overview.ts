import {
  Answerable,
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  Ensure,
  equals,
  isGreaterThan,
  isPresent,
  isTrue,
  not,
} from '@serenity-js/assertions';
import { GetRequest, Send } from '@serenity-js/rest';
import {
  Attribute,
  Click,
  isVisible,
  PageElement,
  Text,
} from '@serenity-js/web';
import { PmOverviewPage } from '../ui/pm-overview-page';
import { PickJalaliDateTime } from '../common/pick-jalali-date-time';
import { EnsureProblemDetail } from '../common/problem-detail';
import { realNameFor } from '../common/personas';
import {
  asTheGherkinWritesIt,
  ListRow,
  LocatePmOverviewPage,
  onlyTheColumnsOf,
  TheRowsOf,
  WaitForTheListToLoad,
} from './maintenance-pages';
import {
  ApiReader,
  pmOverviewResource,
  PmScheduleRange,
} from './maintenance-api';
import { theMaintenanceTaskNamed } from './maintenance-records';

/**
 * «برنامه کلی تعمیرات و نگهداری» — pm-schedule-overview.feature (issue #90), and the overview
 * facts recording-maintenance-execution and daily-pm-schedule state. One page,
 * `/pm-schedule/overview` («برنامه PM»), with two views over the same filters: a **table** of the
 * occurrences whose due date lies in a range, and a Jalali month **calendar** that puts a late one
 * on the day it was done. Over the API: `GET pm-schedule/overview?from&to` (the table's read; both
 * bounds required, else 400 `invalid-pm-schedule-range`).
 */

/** The table's columns and the details dialog's labels, as a visitor reads them. */
const Column = {
  day: 'روز',
  equipment: 'تجهیز',
  activity: 'فعالیت',
  dueDate: 'موعد',
  status: 'وضعیت',
  delayAmount: 'مقدار تاخیر',
  performer: 'انجام دهنده',
  specialty: 'تخصص',
} as const;

/** The performer filter's catch-all, as the Gherkin and the page name it. */
const EVERYONE = 'همه';

/**
 * What the table is asked to show: a range and, optionally, one equipment, one performer or one
 * specialty.
 */
export interface PmOverviewChoice {
  range?: Required<PmScheduleRange>;
  equipmentName?: string;
  /** A persona's name, or «همه». */
  performer?: string;
  /** «برق», «مکانیک» or «همه» — as the Gherkin and the filter name them (issue #108). */
  specialty?: string;
}

/** A performer option is named by the name the backend stores — «همه» stays «همه». */
const performerOptionName = (performer: string): string =>
  performer === EVERYONE ? EVERYONE : realNameFor(performer);

/** Every body row of the table, keyed by column header. */
export const TheOverviewRows = (): QuestionAdapter<ListRow[]> =>
  TheRowsOf('the rows of the PM schedule table', PmOverviewPage);

/** Whether a table row is one the choice asks for — Jalali `YYYY/MM/DD` compares as text. */
const answersTheChoice =
  ({ range, equipmentName, performer, specialty }: PmOverviewChoice) =>
  (row: ListRow): boolean =>
    (range === undefined ||
      (row[Column.dueDate] >= range.from && row[Column.dueDate] <= range.to)) &&
    (equipmentName === undefined || row[Column.equipment] === equipmentName) &&
    (performer === undefined ||
      performer === EVERYONE ||
      row[Column.performer] === performerOptionName(performer)) &&
    // The table need not show a specialty column; when it does, its rows must answer the filter.
    (specialty === undefined ||
      specialty === EVERYONE ||
      row[Column.specialty] === undefined ||
      row[Column.specialty] === specialty);

/**
 * The table has had its say about the choice: nothing is loading and every row on screen is one
 * the choice asks for. The second half is what keeps a check from reading the rows of the default
 * month while the chosen range's are still on their way.
 */
const WaitForTheTableToAnswer = (choice: PmOverviewChoice): Task =>
  Task.where(
    '#actor waits for the table to answer',
    Wait.until(
      Question.about('whether the table answers the choice', async (actor) => {
        const loading = await actor.answer(PmOverviewPage.loadingIndicator());
        if (await loading.isPresent()) {
          return false;
        }
        const rows = await actor.answer(TheOverviewRows());
        return rows.every(answersTheChoice(choice));
      }),
      isTrue(),
    ),
  );

const SwitchToTheTableView = (): Task =>
  Task.where(
    '#actor switches to the table view',
    Click.on(PmOverviewPage.viewToggle('جدول PM')),
    WaitForTheListToLoad(
      PmOverviewPage.columnHeaders(),
      PmOverviewPage.loadingIndicator(),
    ),
  );

/**
 * Opens a `mat-select` and clicks the option; its overlay closes behind the click. The PM
 * dashboard's filters use it too (`pm-dashboard.ts`).
 */
export const ChooseFilter = (
  select: Answerable<PageElement>,
  option: Answerable<PageElement>,
  description: string,
): Task =>
  Task.where(
    description,
    Click.on(select),
    Wait.until(option, isPresent()),
    Click.on(option),
    Wait.until(option, not(isPresent())),
  );

/**
 * «فیلترهای بیشتر» (issue #112): «فعالیت», «وضعیت» and «انجام دهنده» are drawn only once the
 * disclosure is open, so it is opened — unless it already is — before one of them is chosen.
 */
const RevealTheMoreFilters = (): Task =>
  Task.where(
    '#actor reveals the more filters',
    Wait.until(PmOverviewPage.moreFiltersButton(), isVisible()),
    Check.whether(
      Attribute.called('aria-expanded').of(PmOverviewPage.moreFiltersButton()),
      equals('false'),
    ).andIfSo(Click.on(PmOverviewPage.moreFiltersButton())),
    Wait.until(PmOverviewPage.performerFilter(), isPresent()),
  );

export const ViewPmOverview = {
  /**
   * Through `/pm-schedule/overview`: the page, the «جدول PM» view, the filters the choice names
   * and the range from the two Jalali calendars. With no range the table keeps its default, the
   * current Jalali month by the browser's clock — which `LogIn.using` puts on the system's.
   */
  using: (choice: PmOverviewChoice = {}): Task =>
    Task.where(
      d`#actor looks at the PM schedule table for ${choice}`,
      LocatePmOverviewPage(),
      SwitchToTheTableView(),
      ...(choice.equipmentName === undefined
        ? []
        : [
            ChooseFilter(
              PmOverviewPage.equipmentFilter(),
              PmOverviewPage.equipmentOption(choice.equipmentName),
              `#actor filters the table by the equipment ${choice.equipmentName}`,
            ),
          ]),
      ...(choice.performer === undefined
        ? []
        : [
            RevealTheMoreFilters(),
            ChooseFilter(
              PmOverviewPage.performerFilter(),
              PmOverviewPage.option(performerOptionName(choice.performer)),
              `#actor filters the table by the performer ${choice.performer}`,
            ),
          ]),
      ...(choice.specialty === undefined
        ? []
        : [
            ChooseFilter(
              PmOverviewPage.specialtyFilter(),
              PmOverviewPage.option(choice.specialty),
              `#actor filters the table by the specialty ${choice.specialty}`,
            ),
          ]),
      ...(choice.range === undefined
        ? []
        : [
            PickJalaliDateTime.dateOf(choice.range.from).in(
              PmOverviewPage.fromDateField(),
            ),
            PickJalaliDateTime.dateOf(choice.range.to).in(
              PmOverviewPage.toDateField(),
            ),
          ]),
      WaitForTheTableToAnswer(choice),
    ),

  /** `GET pm-schedule/overview`, with whichever bounds are given — the «تلاش …» attempts. */
  viaApiUsing: (range: PmScheduleRange): Task =>
    Task.where(
      d`#actor looks at the PM schedule from ${range.from ?? 'no day'} to ${range.to ?? 'no day'} (via API)`,
      Send.a(GetRequest.to(pmOverviewResource(range))),
    ),
};

/** The Jalali months, as the calendar's title spells them. */
const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** How many months the calendar may be turned before the month asked for is taken as malformed. */
const MAX_MONTHS_TO_TURN = 36;

/** «دی ۱۴۰۵» → `1405/10`. */
const monthOfTitle = (title: string): string => {
  const text = asTheGherkinWritesIt(title);
  const year = /\d{4}/.exec(text)?.[0];
  const month = JALALI_MONTH_NAMES.findIndex((name) =>
    text.split(' ').includes(name),
  );
  if (!year || month < 0) {
    throw new Error(`The calendar's title "${title}" names no Jalali month.`);
  }
  return `${year}/${String(month + 1).padStart(2, '0')}`;
};

const monthIndex = (month: string): number => {
  const match = /^(\d{4})\/(\d{1,2})$/.exec(month.trim());
  if (!match) {
    throw new Error(`"${month}" is not a Jalali month — expected "YYYY/MM".`);
  }
  return Number(match[1]) * 12 + Number(match[2]) - 1;
};

/** The month the calendar shows, `YYYY/MM`. */
const TheMonthShown = (): QuestionAdapter<string> =>
  Question.about('the month the PM calendar shows', async (actor) =>
    monthOfTitle(await actor.answer(Text.of(PmOverviewPage.monthTitle()))),
  );

/**
 * Turns the calendar with «ماه بعد» / «ماه قبل» until it shows `month`. The number of clicks is
 * worked out once from the month showing and made back to back, for the same reason as
 * `pick-jalali-date-time.ts#TurnToTheYear`: each click moves the page's own state by one month,
 * however far the render lags behind.
 */
const TurnTheCalendarTo = (month: string): Interaction =>
  Interaction.where(d`#actor turns the calendar to ${month}`, async (actor) => {
    const months =
      monthIndex(month) - monthIndex(await actor.answer(TheMonthShown()));
    if (Math.abs(months) > MAX_MONTHS_TO_TURN) {
      throw new Error(
        `${month} is ${Math.abs(months)} months from the month the calendar shows; ` +
          `more than ${MAX_MONTHS_TO_TURN} is taken to mean a malformed month.`,
      );
    }
    const turn =
      months > 0
        ? PmOverviewPage.nextMonthButton()
        : PmOverviewPage.previousMonthButton();
    for (let click = 0; click < Math.abs(months); click += 1) {
      await Click.on(turn).performAs(actor);
    }
  });

export const ViewPmCalendar = {
  /**
   * Through `/pm-schedule/overview`, whose default view is the calendar: turned to the Jalali
   * month `YYYY/MM`, and waited for until that month's rows are in.
   */
  forMonth: (month: string): Task =>
    Task.where(
      d`#actor looks at the PM calendar for ${month}`,
      LocatePmOverviewPage(),
      Wait.until(PmOverviewPage.monthTitle(), isVisible()),
      TurnTheCalendarTo(month),
      Wait.until(TheMonthShown(), equals(month.trim())),
      Wait.until(PmOverviewPage.loadingIndicator(), not(isPresent())),
    ),

  /**
   * The same month, narrowed by the shared «تخصص» filter (issue #108) — «برق», «مکانیک» or «همه».
   * The filter sits above both views, so it is chosen on the calendar itself, which then reloads.
   */
  forMonthAndSpecialty: (month: string, specialty: string): Task =>
    Task.where(
      d`#actor looks at the PM calendar for ${month} and the specialty ${specialty}`,
      ViewPmCalendar.forMonth(month),
      ChooseFilter(
        PmOverviewPage.specialtyFilter(),
        PmOverviewPage.option(specialty),
        `#actor filters the calendar by the specialty ${specialty}`,
      ),
      Wait.until(TheMonthShown(), equals(month.trim())),
      Wait.until(PmOverviewPage.loadingIndicator(), not(isPresent())),
    ),
};

/** «—» (the dialog's "no value") as the Gherkin writes it, «-». */
const asAGherkinValue = (text: string): string => {
  const value = asTheGherkinWritesIt(text);
  return value === '—' ? '-' : value;
};

/** Opens an entry's details dialog, reads its facts pairwise, closes it. */
const readTheDetailsOf = async (
  actor: ApiReader,
  entry: PageElement,
): Promise<ListRow> => {
  await Click.on(entry).performAs(actor);
  await Wait.until(
    PmOverviewPage.detailLabels().count(),
    isGreaterThan(0),
  ).performAs(actor);
  const labels = (
    await actor.answer(Text.ofAll(PmOverviewPage.detailLabels()))
  ).map(asTheGherkinWritesIt);
  const values = (
    await actor.answer(Text.ofAll(PmOverviewPage.detailValues()))
  ).map(asAGherkinValue);
  await Click.on(PmOverviewPage.closeDialogButton()).performAs(actor);
  await Wait.until(PmOverviewPage.openDialog(), not(isPresent())).performAs(
    actor,
  );
  return Object.fromEntries(
    labels.map((label, index) => [label, values[index] ?? '']),
  );
};

/**
 * Every entry of the month the calendar shows, in day order: the day it sits on («روز») and what
 * its details dialog says. The chips print only equipment, activity and status, so each is opened
 * — the original due date and the delay are in the dialog alone. A day with a «+N مورد دیگر» is
 * refused rather than half read: no scenario puts more than three entries on one day yet.
 */
const readTheCalendar = async (actor: ApiReader): Promise<ListRow[]> => {
  const entries: ListRow[] = [];
  for (const day of await actor.answer(PmOverviewPage.calendarDays())) {
    const date = asTheGherkinWritesIt(
      await actor.answer(Attribute.called('aria-label').of(day)),
    );
    if (
      (await actor.answer(PmOverviewPage.dayOverflowButtons(day))).length > 0
    ) {
      throw new Error(
        `${date} has more entries than the calendar shows; reading its «+N مورد دیگر» list is not automated.`,
      );
    }
    for (const entry of await actor.answer(PmOverviewPage.dayEntries(day))) {
      entries.push({
        [Column.day]: date,
        ...(await readTheDetailsOf(actor, entry)),
      });
    }
  }
  return entries;
};

const isEntryOf =
  (maintenanceTask: string, dueDate?: string) =>
  (row: ListRow): boolean => {
    const { activityName, equipmentName } =
      theMaintenanceTaskNamed(maintenanceTask);
    return (
      row[Column.equipment] === equipmentName &&
      row[Column.activity] === activityName &&
      (dueDate === undefined || row[Column.dueDate] === dueDate)
    );
  };

/** The table's rows for one task (and one due date), reduced to `columns`. */
const TheOverviewRowsFor = (
  maintenanceTask: string,
  columns: string[],
  dueDate?: string,
): QuestionAdapter<ListRow[]> =>
  Question.about(
    d`the PM schedule rows for ${maintenanceTask}`,
    async (actor) =>
      (await actor.answer(TheOverviewRows()))
        .filter(isEntryOf(maintenanceTask, dueDate))
        .map((row) =>
          Object.fromEntries(
            columns.map((column) => [column, row[column] ?? '']),
          ),
        ),
  );

/** «برنامه کلی تعمیرات و نگهداری به صورت زیر باشد» — exactly these rows, in this order. */
export const EnsurePmOverviewShows = (expected: ListRow[]): Task =>
  Task.where(
    d`#actor ensures the PM schedule table shows ${expected}`,
    Ensure.that(
      Question.about(
        'the PM schedule table, as the Gherkin reads it',
        async (actor) =>
          onlyTheColumnsOf(expected, await actor.answer(TheOverviewRows())),
      ),
      equals(expected),
    ),
  );

/** «موعدهای تعویض روغن اکسترودر 1 در برنامه کلی … فقط «…»، «…» و «…» باشند». */
export const EnsureOverviewDueDatesOf = (
  maintenanceTask: string,
  dueDates: string[],
): Task =>
  Task.where(
    d`#actor ensures the due dates of ${maintenanceTask} in the PM schedule table are ${dueDates}`,
    Ensure.that(
      TheOverviewRowsFor(maintenanceTask, [Column.dueDate]),
      equals(dueDates.map((dueDate) => ({ [Column.dueDate]: dueDate }))),
    ),
  );

/** One due date and its status, as «1405/07/01 بموقع» writes it. */
export interface DueDateWithStatus {
  dueDate: string;
  status: string;
}

/** «1405/07/01 بموقع، 1405/07/08 انجام نشده» — due dates and statuses, «،»-separated. */
export const dueDatesWithStatusIn = (listing: string): DueDateWithStatus[] =>
  listing
    .split('،')
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .map((item) => {
      const match = /^(\d{4}\/\d{2}\/\d{2})\s+(.+)$/.exec(item);
      if (!match) {
        throw new Error(
          `"${item}" is not a due date and a status — expected "YYYY/MM/DD <وضعیت>".`,
        );
      }
      return { dueDate: match[1], status: match[2].trim() };
    });

/** «موعدهای تعویض روغن اکسترودر 1 در برنامه کلی … به صورت زیر باشند» — these, in this order. */
export const EnsureOverviewOccurrencesOf = (
  maintenanceTask: string,
  expected: DueDateWithStatus[],
): Task =>
  Task.where(
    d`#actor ensures the occurrences of ${maintenanceTask} in the PM schedule table are ${expected}`,
    Ensure.that(
      TheOverviewRowsFor(maintenanceTask, [Column.dueDate, Column.status]),
      equals(
        expected.map(({ dueDate, status }) => ({
          [Column.dueDate]: dueDate,
          [Column.status]: status,
        })),
      ),
    ),
  );

export const EnsureOverviewOccurrence = {
  /** «موعد «…» تعویض روغن اکسترودر 1 در برنامه کلی … با وضعیت «…» و تاخیر «…» باشد». */
  is: (
    maintenanceTask: string,
    dueDate: string,
    status: string,
    delayAmount: string,
  ): Task =>
    Task.where(
      d`#actor ensures the PM schedule table shows ${maintenanceTask} due ${dueDate} as ${status}, ${delayAmount} late`,
      Ensure.that(
        TheOverviewRowsFor(
          maintenanceTask,
          [Column.status, Column.delayAmount],
          dueDate,
        ),
        equals([
          { [Column.status]: status, [Column.delayAmount]: delayAmount },
        ]),
      ),
    ),

  /** «موعد «…» تعویض روغن اکسترودر 1 در برنامه کلی … نباشد». */
  isAbsent: (maintenanceTask: string, dueDate: string): Task =>
    Task.where(
      d`#actor ensures the PM schedule table has no ${maintenanceTask} due ${dueDate}`,
      Ensure.that(
        TheOverviewRowsFor(maintenanceTask, [Column.dueDate], dueDate),
        equals([]),
      ),
    ),
};

/** «تقویم برنامه کلی تعمیرات و نگهداری به صورت زیر باشد» — exactly these entries, by day. */
export const EnsurePmCalendarShows = (expected: ListRow[]): Interaction =>
  Interaction.where(
    d`#actor ensures the PM calendar shows ${expected}`,
    async (actor) => {
      const entries = onlyTheColumnsOf(expected, await readTheCalendar(actor));
      await Ensure.that(entries, equals(expected)).performAs(actor);
    },
  );

/** Where, and as what, the calendar shows one occurrence. */
export interface CalendarPlacement {
  day: string;
  status: string;
  /** Checked only when the step names one. */
  delayAmount?: string;
}

/**
 * «تعویض روغن اکسترودر 1 با موعد «…» (فقط یک بار و) در روز «…» با وضعیت «…» (و تاخیر «…») در
 * تقویم باشد» — the occurrence of that due date is in the month shown exactly once, on that day.
 */
export const EnsureInPmCalendar = (
  maintenanceTask: string,
  dueDate: string,
  { day, status, delayAmount }: CalendarPlacement,
): Interaction =>
  Interaction.where(
    d`#actor ensures the PM calendar shows ${maintenanceTask} due ${dueDate} once, on ${day} as ${status}`,
    async (actor) => {
      const columns: string[] = [Column.day, Column.status];
      const expected: ListRow = { [Column.day]: day, [Column.status]: status };
      if (delayAmount !== undefined) {
        columns.push(Column.delayAmount);
        expected[Column.delayAmount] = delayAmount;
      }
      const placements = (await readTheCalendar(actor))
        .filter(isEntryOf(maintenanceTask, dueDate))
        .map((entry) =>
          Object.fromEntries(
            columns.map((column) => [column, entry[column] ?? '']),
          ),
        );
      await Ensure.that(placements, equals([expected])).performAs(actor);
    },
  );

/** «پیغام خطای بازه نامعتبر نشان داده شود» — the 400 the backend gives a missing or reversed range. */
export const EnsureToldTheRangeIsInvalid = (): Task =>
  Task.where(
    '#actor ensures they were told the range is invalid',
    EnsureProblemDetail(400, 'invalid-pm-schedule-range'),
  );

/** Each name once, in Persian order — what «فعالیت های … فقط «…» باشند» compares. */
const distinctNames = (names: string[]): string[] =>
  [...new Set(names)].sort((a, b) => a.localeCompare(b, 'fa'));

/**
 * «فعالیت های برنامه کلی تعمیرات و نگهداری فقط «…» / «…» و «…» / هیچ باشند» — the activities the
 * table shows, each counted once, are exactly these.
 */
export const EnsurePmOverviewActivitiesAre = (activityNames: string[]): Task =>
  Task.where(
    d`#actor ensures the PM schedule table shows only the activities ${activityNames}`,
    Ensure.that(
      Question.about('the activities in the PM schedule table', async (actor) =>
        distinctNames(
          (await actor.answer(TheOverviewRows())).map(
            (row) => row[Column.activity] ?? '',
          ),
        ),
      ),
      equals(distinctNames(activityNames)),
    ),
  );

/**
 * «فعالیت های تقویم برنامه کلی تعمیرات و نگهداری فقط «…» باشند» — the activities of every entry of
 * the month the calendar shows, each counted once, are exactly these. Read from each entry's details
 * dialog, as every calendar fact is.
 */
export const EnsurePmCalendarActivitiesAre = (
  activityNames: string[],
): Interaction =>
  Interaction.where(
    d`#actor ensures the PM calendar shows only the activities ${activityNames}`,
    async (actor) => {
      const shown = distinctNames(
        (await readTheCalendar(actor)).map(
          (entry) => entry[Column.activity] ?? '',
        ),
      );
      await Ensure.that(shown, equals(distinctNames(activityNames))).performAs(
        actor,
      );
    },
  );

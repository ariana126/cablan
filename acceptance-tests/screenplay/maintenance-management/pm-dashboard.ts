import {
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
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible, PageElements, Text } from '@serenity-js/web';
import { PmDashboardPage } from '../ui/pm-dashboard-page';
import {
  ListRow,
  LocatePmDashboardPage,
  onlyTheColumnsOf,
  TheRowsOf,
} from './maintenance-pages';
import { ChooseFilter } from './pm-schedule-overview';
import { theMaintenanceTaskNamed } from './maintenance-records';

/**
 * «داشبورد مدیریتی فنی» — technical-management-dashboard.feature (issue #89). One page,
 * `/pm-dashboard`, reading one request (`GET pm-dashboard?periodDays=&equipmentId=`) for a period
 * («7/30/90 روز اخیر», 30 by default) and an equipment («همه تجهیزات» by default). Through the
 * browser, every figure is read as the page shows it; the API door is only the refused «تلاش …».
 */

/** The four current cards, by the title the Gherkin's columns give them. */
const CURRENT_CARDS = [
  'سررسید امروز',
  'عقب افتاده',
  'انجام شده امروز',
  'موعدهای ازدست رفته',
];

/** The equipment filter's catch-all, as the Gherkin and the page name it. */
const ALL_EQUIPMENT = 'همه تجهیزات';

/** The table columns this vocabulary matches rows by. */
const Column = {
  equipment: 'تجهیز',
  activity: 'فعالیت',
  dueDate: 'موعد',
} as const;

/**
 * A figure as the Gherkin writes it: bidi marks gone, whitespace collapsed, Persian digits,
 * decimal separator and percent sign Latin, no space before «%» — so «۷۰ ٪» reads «70%». Dashes
 * («—», «-») are kept as they are: they are values of their own.
 */
const asTheGherkinWritesTheFigure = (text: string): string =>
  text
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, '')
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/٪/g, '%')
    .replace(/\s+/g, ' ')
    .replace(/ %/g, '%')
    .trim();

/** A label compared without its spacing or ZWNJs — «ازدست رفته» and «از دست‌رفته» are one label. */
const labelKey = (label: string): string =>
  asTheGherkinWritesTheFigure(label).replace(/[\s‌]/g, '');

export interface PmDashboardChoice {
  /** «7 روز اخیر», «30 روز اخیر» or «90 روز اخیر»; the page's default when absent. */
  period?: string;
  /** An equipment's name, or «همه تجهیزات»; the page's default (all) when absent. */
  equipment?: string;
}

/** Whether a filter shows `value` — a `mat-select`'s text is the option it holds. */
const TheFilterShows = (
  filter: ReturnType<typeof PmDashboardPage.periodFilter>,
  value: string,
): QuestionAdapter<boolean> =>
  Question.about(d`whether the filter shows ${value}`, async (actor) =>
    labelKey(await actor.answer(Text.of(filter))).includes(labelKey(value)),
  );

/**
 * The dashboard has had its say about the choice: every filter the choice names shows it, and
 * nothing is loading. The first half keeps a check from reading the default's figures while the
 * chosen ones are still on their way.
 */
const WaitForTheDashboardToAnswer = (choice: PmDashboardChoice): Task =>
  Task.where(
    d`#actor waits for the dashboard to answer ${choice}`,
    ...(choice.equipment === undefined
      ? []
      : [
          Wait.until(
            TheFilterShows(PmDashboardPage.equipmentFilter(), choice.equipment),
            isTrue(),
          ),
        ]),
    ...(choice.period === undefined
      ? []
      : [
          Wait.until(
            TheFilterShows(PmDashboardPage.periodFilter(), choice.period),
            isTrue(),
          ),
        ]),
    Wait.until(PmDashboardPage.loadingIndicator(), not(isPresent())),
    Wait.until(PmDashboardPage.card(CURRENT_CARDS[0]), isVisible()),
  );

export const ViewPmDashboard = {
  /**
   * Through `/pm-dashboard`: the page, then «تجهیز» and «بازه زمانی» when the choice names them —
   * each a `mat-select`, each change reloading the panels — and the wait for the answer.
   */
  using: (choice: PmDashboardChoice): Task =>
    Task.where(
      d`#actor looks at the technical management dashboard for ${choice}`,
      LocatePmDashboardPage(),
      ...(choice.equipment === undefined
        ? []
        : [
            ChooseFilter(
              PmDashboardPage.equipmentFilter(),
              choice.equipment === ALL_EQUIPMENT
                ? PmDashboardPage.option(ALL_EQUIPMENT)
                : PmDashboardPage.equipmentOption(choice.equipment),
              `#actor filters the dashboard by ${choice.equipment}`,
            ),
          ]),
      ...(choice.period === undefined
        ? []
        : [
            ChooseFilter(
              PmDashboardPage.periodFilter(),
              PmDashboardPage.option(choice.period),
              `#actor chooses the period ${choice.period}`,
            ),
          ]),
      WaitForTheDashboardToAnswer(choice),
    ),

  /** `GET pm-dashboard`, the server's defaults — the «تلاش …» attempt, judged by the next steps. */
  viaApiUsing: (): Task =>
    Task.where(
      '#actor looks at the technical management dashboard (via API)',
      Send.a(GetRequest.to('pm-dashboard')),
    ),
};

/** «داشبورد مدیریتی فنی به … نشان داده شود» — the page, its cards and its panels are on screen. */
export const EnsureTheDashboardIsShown = (): Task =>
  Task.where(
    '#actor ensures the technical management dashboard is shown',
    Ensure.that(PmDashboardPage.heading(), isVisible()),
    ...CURRENT_CARDS.map((title) =>
      Ensure.that(PmDashboardPage.card(title), isVisible()),
    ),
    Ensure.that(PmDashboardPage.performancePanel(), isPresent()),
    Ensure.that(PmDashboardPage.coveragePanel(), isPresent()),
    Ensure.that(PmDashboardPage.mostOverduePanel(), isPresent()),
    Ensure.that(PmDashboardPage.upcomingPanel(), isPresent()),
  );

/** «داشبورد مدیریتی فنی نمایش داده نشود» after a refused «تلاش …» — the request was turned away. */
export const EnsureTheDashboardWasNotShown = (): Task =>
  Task.where(
    '#actor ensures the technical management dashboard was not shown',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

/**
 * A card's number: the first number in its text after the title (none of the titles has a
 * digit). The whole text, normalised, when there is none — so the mismatch says what was there.
 */
const TheCardFigure = (title: string): QuestionAdapter<string> =>
  Question.about(d`the figure of the ${title} card`, async (actor) => {
    const text = asTheGherkinWritesTheFigure(
      await actor.answer(Text.of(PmDashboardPage.card(title))),
    );
    return /\d+/.exec(text)?.[0] ?? text;
  });

/** The figures of the cards `expected` names, keyed as `expected` keys them. */
const TheCardFigures = (expected: ListRow): QuestionAdapter<ListRow> =>
  Question.about(
    d`the dashboard cards ${Object.keys(expected)}`,
    async (actor) => {
      const read: ListRow = {};
      for (const title of Object.keys(expected)) {
        read[title] = await actor.answer(TheCardFigure(title));
      }
      return read;
    },
  );

/**
 * «شاخص های وضعیت جاری به صورت زیر باشد», «تعداد موعدهای ازدست رفته … باشد», «تعداد کارهای عقب
 * افتاده … باشد» — the cards the Gherkin names show these numbers.
 */
export const EnsureCurrentStateIs = (expected: ListRow): Task =>
  Task.where(
    d`#actor ensures the dashboard's current state is ${expected}`,
    Ensure.that(TheCardFigures(expected), equals(expected)),
  );

/**
 * A panel's labelled figures (`<dt>`/`<dd>` pairs), reduced to the labels `expected` names and
 * keyed as `expected` keys them; a label the panel lacks reads as missing.
 */
const ThePanelFigures = (
  description: string,
  figures: { labels: () => PageElements; values: () => PageElements },
  expected: ListRow,
): QuestionAdapter<ListRow> =>
  Question.about(description, async (actor) => {
    const labels = (await actor.answer(Text.ofAll(figures.labels()))).map(
      labelKey,
    );
    const values = (await actor.answer(Text.ofAll(figures.values()))).map(
      asTheGherkinWritesTheFigure,
    );
    return Object.fromEntries(
      Object.keys(expected).map((label) => {
        const index = labels.indexOf(labelKey(label));
        return [label, index < 0 ? '(missing)' : (values[index] ?? '')];
      }),
    );
  });

/**
 * «درصد پایبندی … و درصد تکمیل … باشد», «عملکرد به صورت زیر باشد», «تعداد کارهای انجام شده بموقع
 * … باشد» — the «عملکرد PM» panel's figures the Gherkin names.
 */
export const EnsurePerformanceIs = (expected: ListRow): Task =>
  Task.where(
    d`#actor ensures the PM performance is ${expected}`,
    Ensure.that(
      ThePanelFigures(
        'the PM performance figures',
        PmDashboardPage.performanceFigures(),
        expected,
      ),
      equals(expected),
    ),
  );

/** «پوشش برنامه PM به صورت زیر باشد» — the «پوشش برنامه PM» panel's figures the Gherkin names. */
export const EnsureCoverageIs = (expected: ListRow): Task =>
  Task.where(
    d`#actor ensures the PM coverage is ${expected}`,
    Ensure.that(
      ThePanelFigures(
        'the PM coverage figures',
        PmDashboardPage.coverageFigures(),
        expected,
      ),
      equals(expected),
    ),
  );

/**
 * Opens the «فاقد برنامه» list unless it is already showing — clicking an open one could fold it
 * away — and waits for its first link, in the panel or in a dialog, whichever it opened in.
 */
const OpenTheListOfEquipmentWithoutAPlan = (): Interaction =>
  Interaction.where(
    '#actor opens the list of equipment without a plan',
    async (actor) => {
      const listed = async (): Promise<number> =>
        (await actor.answer(
          PmDashboardPage.withoutPlanLinksInThePanel().count(),
        )) +
        (await actor.answer(
          PmDashboardPage.withoutPlanLinksInTheDialog().count(),
        ));
      if ((await listed()) === 0) {
        await Click.on(PmDashboardPage.withoutPlanButton()).performAs(actor);
      }
      await Wait.until(
        Question.about('the equipment listed without a plan', listed),
        isGreaterThan(0),
      ).performAs(actor);
    },
  );

/** The names the «فاقد برنامه» list shows, sorted — the order is the page's business, not the rule's. */
const TheEquipmentListedWithoutAPlan = (): QuestionAdapter<string[]> =>
  Question.about('the equipment listed without a plan', async (actor) => {
    const names = [
      ...(await actor.answer(
        Text.ofAll(PmDashboardPage.withoutPlanLinksInThePanel()),
      )),
      ...(await actor.answer(
        Text.ofAll(PmDashboardPage.withoutPlanLinksInTheDialog()),
      )),
    ].map(asTheGherkinWritesTheFigure);
    return names.sort();
  });

/**
 * «تجهیزات فاقد برنامه فقط … باشد», «فهرست تجهیزات فاقد برنامه همان … تجهیز باشد» — the list
 * «فاقد برنامه» opens names exactly these equipment.
 */
export const EnsureEquipmentWithoutAPlanAre = (names: string[]): Task =>
  Task.where(
    d`#actor ensures the equipment without a plan are ${names}`,
    OpenTheListOfEquipmentWithoutAPlan(),
    Ensure.that(TheEquipmentListedWithoutAPlan(), equals([...names].sort())),
  );

const TheMostOverdueRows = (): QuestionAdapter<ListRow[]> =>
  TheRowsOf(
    'the rows of the most overdue equipment',
    PmDashboardPage.mostOverdueTable(),
  );

const TheUpcomingRows = (): QuestionAdapter<ListRow[]> =>
  TheRowsOf('the rows of the next seven days', PmDashboardPage.upcomingTable());

/** `rows` reduced to the columns `expected` names. */
const TheColumnsOf = (
  rows: QuestionAdapter<ListRow[]>,
  expected: ListRow[],
): QuestionAdapter<ListRow[]> =>
  Question.about(d`${rows}, on the columns the Gherkin names`, async (actor) =>
    onlyTheColumnsOf(expected, await actor.answer(rows)),
  );

/**
 * «تجهیزات دارای بیشترین عقب افتادگی به ترتیب زیر باشند» — the «بیشترین عقب افتادگی» table is
 * exactly these rows, in this order, on the columns the Gherkin names.
 */
export const EnsureMostOverdueEquipmentAre = (expected: ListRow[]): Task =>
  Task.where(
    d`#actor ensures the most overdue equipment are ${expected}`,
    Ensure.that(TheColumnsOf(TheMostOverdueRows(), expected), equals(expected)),
  );

/** «برنامه هفت روز آینده به صورت زیر باشد» — exactly these rows, in this order. */
export const EnsureUpcomingWorkIs = (expected: ListRow[]): Task =>
  Task.where(
    d`#actor ensures the next seven days are ${expected}`,
    Ensure.that(TheColumnsOf(TheUpcomingRows(), expected), equals(expected)),
  );

/** The next seven days' rows for one task, optionally on one due date. */
const TheUpcomingRowsFor = (
  maintenanceTask: string,
  dueDate?: string,
): QuestionAdapter<ListRow[]> =>
  Question.about(
    d`the next seven days' rows for ${maintenanceTask}`,
    async (actor) => {
      const { activityName, equipmentName } =
        theMaintenanceTaskNamed(maintenanceTask);
      return (await actor.answer(TheUpcomingRows())).filter(
        (row) =>
          row[Column.equipment] === equipmentName &&
          row[Column.activity] === activityName &&
          (dueDate === undefined || row[Column.dueDate] === dueDate),
      );
    },
  );

/** «تعویض روغن اکسترودر 1 در برنامه هفت روز آینده نباشد». */
export const EnsureUpcomingWorkLeavesOut = (maintenanceTask: string): Task =>
  Task.where(
    d`#actor ensures the next seven days leave out ${maintenanceTask}`,
    Ensure.that(TheUpcomingRowsFor(maintenanceTask).length, equals(0)),
  );

/** «تعویض روغن اکسترودر 1 با موعد «…» در برنامه هفت روز آینده باشد» — once, on that due date. */
export const EnsureUpcomingWorkIncludes = (
  maintenanceTask: string,
  dueDate: string,
): Task =>
  Task.where(
    d`#actor ensures ${maintenanceTask} is due on ${dueDate} in the next seven days`,
    Ensure.that(TheUpcomingRowsFor(maintenanceTask, dueDate).length, equals(1)),
  );

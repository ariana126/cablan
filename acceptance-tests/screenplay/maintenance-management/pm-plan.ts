import { d, Interaction, Question, Task, Wait } from '@serenity-js/core';
import {
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isPresent,
  not,
} from '@serenity-js/assertions';
import {
  DeleteRequest,
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { PmPlansPage } from '../ui/pm-plans-page';
import { ChooseRowAction } from '../common/row-actions';
import { ChooseFromSearchableSelect } from '../common/searchable-select';
import { PickJalaliDateTime } from '../common/pick-jalali-date-time';
import {
  isoDateToJalaliDate,
  jalaliDateToIsoDate,
  tehranJalaliDateTimeOf,
} from '../common/jalali-datetime';
import { LetTimePass } from '../common/clock';
import { EnsureProblemDetail } from '../common/problem-detail';
import {
  ListRow,
  LocatePmPlansPage,
  onlyTheColumnsOf,
  TheRowsOf,
  WaitForTheDialogToBeAnswered,
} from './maintenance-pages';
import {
  ApiReader,
  InactivePmPlanItemReadModel,
  PmPlanItemReadModel,
  readEquipment,
} from './maintenance-api';
import {
  rememberPlanItem,
  theActivityNamed,
  theEquipmentNamed,
  theMaintenanceTaskNamed,
  thePlanItemFor,
} from './maintenance-records';
import { RegisterMaintenanceActivityUnlessRegistered } from './maintenance-activity';

/**
 * The PM-plan vocabulary — planning-preventive-maintenance.feature, and the plan every other
 * maintenance feature states as a precondition. An equipment's plan items are read from
 * `GET equipment/:id` (`planItems`, active items only; `inactivePlanItems`, the deactivated ones —
 * issue #91); they are written through `POST/PATCH equipment/:id/pm-plan-items[/:itemId]`,
 * `POST …/:itemId/deactivation`, or the `/pm-plans` page. Nothing is ever removed from a plan.
 */

/** The first due date a step uses when the Gherkin names none — any date serves. */
export const UNSTATED_FIRST_DUE_DATE = '1405/07/01';

/** The interval a step uses when the Gherkin names none — any positive number of days serves. */
export const UNSTATED_INTERVAL_DAYS = '30';

export interface PlanItemDetails {
  equipmentName: string;
  activityName: string;
  /** Days, as the Gherkin writes them; absent when the step leaves the interval out. */
  intervalDays?: string;
  /** Jalali `YYYY/MM/DD`; absent when the step leaves the first due date out. */
  firstDueDate?: string;
}

/**
 * Opens the equipment's folder by clicking its card on the «تجهیزات فعال» board (issue #92 — every
 * active equipment has one, plan or not). The card is waited for as *present*, not visible — a
 * long board can push it below the fold, and `Click.on` scrolls it into view. The folder
 * (`/pm-plans/:equipmentId`) is ready once its heading names the equipment and its plan sheet's
 * «افزودن فعالیت» is drawn — the heading rules out reading a previous folder's sheet.
 */
const OpenTheFolderOf = (equipmentName: string): Task =>
  Task.where(
    d`#actor opens the technical folder of ${equipmentName}`,
    Wait.until(PmPlansPage.equipmentCard(equipmentName), isPresent()),
    Click.on(PmPlansPage.equipmentCard(equipmentName)),
    Wait.until(PmPlansPage.folderHeading(equipmentName), isVisible()),
    Wait.until(PmPlansPage.addItemButton(), isPresent()),
  );

const LocateThePlanOf = (equipmentName: string): Task =>
  Task.where(
    d`#actor locates the PM plan of ${equipmentName}`,
    LocatePmPlansPage(),
    OpenTheFolderOf(equipmentName),
  );

/**
 * Opens the add-item dialog for the equipment from its folder's «برنامه PM» sheet — the button is
 * there even when the plan is empty (issue #92), so the first activity takes the same route as
 * every other. The dialog then asks for the activity.
 */
const OpenTheAddItemDialogFor = (equipmentName: string): Task =>
  Task.where(
    d`#actor opens the add activity dialog for ${equipmentName}`,
    LocateThePlanOf(equipmentName),
    Click.on(PmPlansPage.addItemButton()),
  );

const SubmitThePlanItemDialog = (): Task =>
  Task.where(
    '#actor submits the plan item dialog',
    Click.on(PmPlansPage.submitButton()),
    WaitForTheDialogToBeAnswered(
      PmPlansPage.submitButton(),
      PmPlansPage.anyFieldError(),
      PmPlansPage.dialogAlert(),
    ),
  );

type ApiPlanItemDetails = Required<PlanItemDetails> & {
  intervalUnit: 'days' | 'operating_hours';
};

const addPlanItemRequest = (details: ApiPlanItemDetails) =>
  PostRequest.to(
    `equipment/${theEquipmentNamed(details.equipmentName).id}/pm-plan-items`,
  ).with({
    activityId: theActivityNamed(details.activityName).id,
    intervalValue: Number(details.intervalDays),
    intervalUnit: details.intervalUnit,
    firstDueDate: jalaliDateToIsoDate(details.firstDueDate),
  });

export const AddActivityToPmPlan = {
  /**
   * Through `/pm-plans`: the equipment's folder (its card on the board), the add-item dialog from
   * the folder's «برنامه PM» sheet, the activity, the interval in days and the first due date from
   * the Jalali calendar — each only when the step names it, so «… بدون دوره / اولین موعد …» leaves that
   * field untouched.
   */
  using: (details: PlanItemDetails): Task =>
    Task.where(
      d`#actor adds ${details.activityName} to the PM plan of ${details.equipmentName}`,
      OpenTheAddItemDialogFor(details.equipmentName),
      Wait.until(PmPlansPage.activityPicker(), isVisible()),
      ChooseFromSearchableSelect(
        PmPlansPage.activityPicker(),
        details.activityName,
        PmPlansPage.option(details.activityName),
      ),
      ...(details.intervalDays === undefined
        ? []
        : [
            Enter.theValue(details.intervalDays).into(
              PmPlansPage.intervalField(),
            ),
          ]),
      ...(details.firstDueDate === undefined
        ? []
        : [
            PickJalaliDateTime.dateOf(details.firstDueDate).in(
              PmPlansPage.firstDueDateField(),
            ),
          ]),
      SubmitThePlanItemDialog(),
    ),

  /**
   * `POST equipment/:id/pm-plan-items` — the «تلاش …» attempts, including the usage-based one
   * (`intervalUnit: 'operating_hours'`, which the backend refuses).
   */
  viaApiUsing: (details: ApiPlanItemDetails): Task =>
    Task.where(
      d`#actor adds ${details.activityName} to the PM plan of ${details.equipmentName} (via API)`,
      Send.a(addPlanItemRequest(details)),
    ),
};

/**
 * A passive precondition: the activity is in the equipment's plan with this interval and first due
 * date. Registers the activity first unless the system has it — recording-maintenance-execution's
 * background puts «تعویض روغن» in a plan without registering it anywhere else. Remembers the item,
 * so a recording can address it by id.
 */
export const PutActivityInPmPlan = (
  details: Required<PlanItemDetails>,
): Interaction =>
  Interaction.where(
    d`#actor puts ${details.activityName} in the PM plan of ${details.equipmentName}`,
    async (actor) => {
      await RegisterMaintenanceActivityUnlessRegistered(
        details.activityName,
      ).performAs(actor);
      await Send.a(
        addPlanItemRequest({ ...details, intervalUnit: 'days' }),
      ).performAs(actor);
      await Ensure.that(LastResponse.status(), equals(201)).performAs(actor);
      const { id } = await actor.answer(LastResponse.body<{ id: string }>());
      rememberPlanItem({
        id,
        equipment: theEquipmentNamed(details.equipmentName),
        activity: theActivityNamed(details.activityName),
      });
    },
  );

/**
 * «… دوره «…» در برنامه تجهیز «…» را به «…» روز تغییر می دهد» — the plan item's row menu,
 * «ویرایش», the new interval, «ثبت».
 */
export const ChangePmInterval = {
  using: (
    equipmentName: string,
    activityName: string,
    intervalDays: string,
  ): Task =>
    Task.where(
      d`#actor changes the interval of ${activityName} on ${equipmentName} to ${intervalDays} days`,
      LocateThePlanOf(equipmentName),
      ChooseRowAction(activityName, 'edit'),
      Wait.until(PmPlansPage.intervalField(), isVisible()),
      Enter.theValue(intervalDays).into(PmPlansPage.intervalField()),
      SubmitThePlanItemDialog(),
    ),

  /**
   * `PATCH equipment/:id/pm-plan-items/:itemId` `{ intervalDays }` — the «تلاش …» attempt on a
   * deactivated row (409 `pm-plan-item-deactivated`), which the deactivated row has no menu for.
   */
  viaApiUsing: (
    equipmentName: string,
    activityName: string,
    intervalDays: string,
  ): Task => {
    const item = thePlanItemFor(equipmentName, activityName);
    return Task.where(
      d`#actor changes the interval of ${activityName} on ${equipmentName} to ${intervalDays} days (via API)`,
      Send.a(
        PatchRequest.to(
          `equipment/${item.equipment.id}/pm-plan-items/${item.id}`,
        ).with({ intervalDays: Number(intervalDays) }),
      ),
    );
  },
};

/**
 * «… فعالیت «…» را در برنامه تجهیز «…» غیرفعال می کند» (issue #91 — deactivation replaced removal):
 * the plan row's menu, «غیرفعال‌سازی», the confirmation. Done once the dialog has closed; the folder
 * stays open, showing the row under «فعالیت‌های غیرفعال».
 */
export const DeactivateActivityInPmPlan = {
  using: (equipmentName: string, activityName: string): Task =>
    Task.where(
      d`#actor deactivates ${activityName} in the PM plan of ${equipmentName}`,
      LocateThePlanOf(equipmentName),
      ChooseRowAction(activityName, 'deactivate'),
      Wait.until(PmPlansPage.deactivationDialogHeading(), isVisible()),
      Click.on(PmPlansPage.confirmDeactivationButton()),
      Wait.until(PmPlansPage.deactivationDialogHeading(), not(isPresent())),
    ),

  /**
   * `POST equipment/:id/pm-plan-items/:itemId/deactivation`, no body — the «تلاش …» attempt, whose
   * refusal (403) the following steps judge, so it is not checked here.
   *
   * The plan item is looked up when the request is sent, not when the task is built: «… بوده و
   * غیرفعال شده باشد» builds this in the same task that first puts the item in the plan, and a
   * second round for the same activity must address the newest row (`rememberPlanItem` keeps the
   * latest per equipment and activity).
   */
  viaApiUsing: (equipmentName: string, activityName: string): Task =>
    Task.where(
      d`#actor deactivates ${activityName} in the PM plan of ${equipmentName} (via API)`,
      Send.a(
        PostRequest.to(
          Question.about(
            `the deactivation of ${activityName} in the PM plan of ${equipmentName}`,
            () => {
              const item = thePlanItemFor(equipmentName, activityName);
              return `equipment/${item.equipment.id}/pm-plan-items/${item.id}/deactivation`;
            },
          ),
        ),
      ),
    ),

  /**
   * The passive «… غیرفعال شده باشد» / «… را در «…» از برنامه تجهیز «…» حذف کرده باشد»
   * (pm-schedule-overview, whose removal is now carried out by deactivating). Checks the 204: it is
   * a precondition, and a refused one would make every following fact meaningless.
   */
  asAPrecondition: (equipmentName: string, activityName: string): Task =>
    Task.where(
      d`#actor has deactivated ${activityName} in the PM plan of ${equipmentName}`,
      DeactivateActivityInPmPlan.viaApiUsing(equipmentName, activityName),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

const ONE_MINUTE = 60_000;

/**
 * «… در برنامه تجهیز «…» بوده و غیرفعال شده باشد» — the activity was put in the plan with this
 * interval and first due date and then deactivated. A minute passes afterwards, so a second such
 * precondition is deactivated strictly later and the inactive list's order (`deactivatedAt`
 * ascending) is the order the Gherkin states them in.
 */
export const PutActivityInPmPlanAndDeactivateIt = (
  details: Required<PlanItemDetails>,
): Task =>
  Task.where(
    d`#actor has put ${details.activityName} in the PM plan of ${details.equipmentName} and deactivated it`,
    PutActivityInPmPlan(details),
    DeactivateActivityInPmPlan.asAPrecondition(
      details.equipmentName,
      details.activityName,
    ),
    LetTimePass(ONE_MINUTE),
  );

/**
 * «… تلاش می کند فعالیت غیرفعال شده «…» تجهیز «…» را دوباره فعال کند». The system offers no way to
 * reactivate a row (issue #91), so the attempt is the one a client would guess — undoing the
 * deactivation, `DELETE equipment/:id/pm-plan-items/:itemId/deactivation` — which the backend
 * answers 404. The following `Then`s judge the outcome by reading the plan, not this response.
 */
export const ReactivateActivityInPmPlan = {
  viaApiUsing: (equipmentName: string, activityName: string): Task => {
    const item = thePlanItemFor(equipmentName, activityName);
    return Task.where(
      d`#actor tries to reactivate ${activityName} in the PM plan of ${equipmentName} (via API)`,
      Send.a(
        DeleteRequest.to(
          `equipment/${item.equipment.id}/pm-plan-items/${item.id}/deactivation`,
        ),
      ),
    );
  },
};

const planItemsOf = async (
  actor: ApiReader,
  equipmentName: string,
  activityName: string,
): Promise<PmPlanItemReadModel[]> =>
  (
    await readEquipment(actor, theEquipmentNamed(equipmentName).id)
  ).planItems.filter((item) => item.activityName === activityName);

/** The plan item the last «… در برنامه تجهیز … باشد» spoke of — what «اولین موعد آن» refers to. */
let planItemInFocus: PmPlanItemReadModel | undefined;

/**
 * «فعالیت «…» (فقط یک بار و) با دوره «…» روز در برنامه تجهیز «…» باشد» and «دوره «…» در برنامه
 * «…» برابر «…» روز باشد» — the activity is in the plan exactly once, with that interval.
 */
export const EnsureActivityIsInPmPlanWithInterval = (
  equipmentName: string,
  activityName: string,
  intervalDays: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} is in the PM plan of ${equipmentName} every ${intervalDays} days`,
    async (actor) => {
      const items = await planItemsOf(actor, equipmentName, activityName);
      await Ensure.that(items.length, equals(1)).performAs(actor);
      await Ensure.that(
        items[0].intervalDays,
        equals(Number(intervalDays)),
      ).performAs(actor);
      planItemInFocus = items[0];
    },
  );

/** «و اولین موعد آن «…» باشد». */
export const EnsureFirstDueDateOfThatPlanItem = (
  firstDueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures that plan item's first due date is ${firstDueDate}`,
    async (actor) => {
      if (!planItemInFocus) {
        throw new Error('No plan item was spoken of before «اولین موعد آن».');
      }
      await Ensure.that(
        planItemInFocus.firstDueDate,
        equals(jalaliDateToIsoDate(firstDueDate)),
      ).performAs(actor);
    },
  );

/** «فعالیت «…» در برنامه تجهیز «…» نباشد» — no active item for the activity. */
export const EnsureActivityIsNotInPmPlan = (
  equipmentName: string,
  activityName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} is not in the PM plan of ${equipmentName}`,
    async (actor) => {
      const items = await planItemsOf(actor, equipmentName, activityName);
      await Ensure.that(items.length, equals(0)).performAs(actor);
    },
  );

/** «موعد بعدی تعویض روغن اکسترودر 1 «…» باشد» — the plan item's `nextDueDate`. */
export const EnsureNextDueDate = (
  maintenanceTask: string,
  nextDueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the next due date of ${maintenanceTask} is ${nextDueDate}`,
    async (actor) => {
      const { equipmentName, activityName } =
        theMaintenanceTaskNamed(maintenanceTask);
      const items = await planItemsOf(actor, equipmentName, activityName);
      await Ensure.that(items.length, equals(1)).performAs(actor);
      await Ensure.that(
        items[0].nextDueDate,
        equals(jalaliDateToIsoDate(nextDueDate)),
      ).performAs(actor);
    },
  );

/** «پیغام خطای دوره / اولین موعد نشان داده شود» — the add dialog's field says it is required. */
export const EnsurePlanItemFieldErrorShown = (
  field: 'interval' | 'firstDueDate',
): Task =>
  Task.where(
    `#actor ensures the plan item dialog shows the ${field} error`,
    Wait.until(
      field === 'interval'
        ? PmPlansPage.intervalError()
        : PmPlansPage.firstDueDateError(),
      isVisible(),
    ),
  );

/** «پیغام خطای تکراری بودن فعالیت در برنامه تجهیز نشان داده شود» — the dialog's alert. */
export const EnsureDuplicatePlanItemErrorShown = (): Task =>
  Task.where(
    '#actor ensures the plan item dialog says the activity is already in the plan',
    Wait.until(PmPlansPage.dialogAlert(), isVisible()),
  );

/** «به او گفته شود که برنامه فقط بر اساس روز قابل تعریف است» — 400 on a usage-based interval. */
export const EnsureToldPlansAreDayBasedOnly = (): Task =>
  Task.where(
    '#actor ensures they were told a plan can only be defined in days',
    EnsureProblemDetail(400, 'usage-based-interval-not-supported'),
  );

// The active plan and the inactive list (issue #91)

const activePlanItemsOf = async (
  actor: ApiReader,
  equipmentName: string,
): Promise<PmPlanItemReadModel[]> =>
  (await readEquipment(actor, theEquipmentNamed(equipmentName).id)).planItems;

/**
 * «فعالیت «…» همچنان در برنامه فعال تجهیز «…» باشد» — the activity still has its one active row:
 * the refused deactivation left it where it was.
 */
export const EnsureActivityIsStillActiveInPmPlan = (
  equipmentName: string,
  activityName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} is still active in the PM plan of ${equipmentName}`,
    async (actor) => {
      const items = await planItemsOf(actor, equipmentName, activityName);
      await Ensure.that(items.length, equals(1)).performAs(actor);
    },
  );

/**
 * «فعالیت «…» با دوره «…» روز و اولین موعد «…» در برنامه فعال تجهیز «…» باشد» — exactly one active
 * row of the activity, with that interval and first due date.
 */
export const EnsureActivityIsActiveInPmPlanWith = (
  equipmentName: string,
  activityName: string,
  intervalDays: string,
  firstDueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} is active in the PM plan of ${equipmentName} every ${intervalDays} days from ${firstDueDate}`,
    async (actor) => {
      const items = (await planItemsOf(actor, equipmentName, activityName)).map(
        (item) => ({
          intervalDays: item.intervalDays,
          firstDueDate: item.firstDueDate,
        }),
      );
      await Ensure.that(
        items,
        equals([
          {
            intervalDays: Number(intervalDays),
            firstDueDate: jalaliDateToIsoDate(firstDueDate),
          },
        ]),
      ).performAs(actor);
    },
  );

/** «فقط فعالیت «…» در برنامه فعال تجهیز «…» باشد» — the active plan is that one activity. */
export const EnsureOnlyActivityActiveInPmPlan = (
  equipmentName: string,
  activityName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures only ${activityName} is active in the PM plan of ${equipmentName}`,
    async (actor) => {
      const names = (await activePlanItemsOf(actor, equipmentName)).map(
        (item) => item.activityName,
      );
      await Ensure.that(names, equals([activityName])).performAs(actor);
    },
  );

/** «هیچ فعالیت فعالی در برنامه تجهیز «…» نباشد» — no active row at all. */
export const EnsureNoActivityIsActiveInPmPlan = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures no activity is active in the PM plan of ${equipmentName}`,
    async (actor) => {
      const items = await activePlanItemsOf(actor, equipmentName);
      await Ensure.that(items, equals([])).performAs(actor);
    },
  );

/** One inactive row as the Gherkin's (and the folder's) columns write it. */
const inactiveColumns: Record<
  string,
  (item: InactivePmPlanItemReadModel) => string
> = {
  فعالیت: (item) => item.activityName,
  'دوره (روز)': (item) => String(item.intervalDays),
  'اولین موعد': (item) => isoDateToJalaliDate(item.firstDueDate),
  'زمان غیرفعال شدن': (item) => tehranJalaliDateTimeOf(item.deactivatedAt),
};

const inactiveRowsOverTheApi = async (
  actor: ApiReader,
  equipmentName: string,
): Promise<ListRow[]> =>
  (
    await readEquipment(actor, theEquipmentNamed(equipmentName).id)
  ).inactivePlanItems.map((item) =>
    Object.fromEntries(
      Object.entries(inactiveColumns).map(([column, read]) => [
        column,
        read(item),
      ]),
    ),
  );

/** The folder's «فعالیت‌های غیرفعال» sheet, row by row, keyed by its column headers. */
const InactiveRowsOnThePage = () =>
  TheRowsOf('the inactive plan items shown in the folder', {
    columnHeaders: PmPlansPage.inactiveItemsColumnHeaders,
    rows: PmPlansPage.inactiveItemsRows,
    rowCells: PmPlansPage.inactiveItemsRowCells,
  });

const checkInactiveColumns = (expected: ListRow[]): void => {
  for (const column of Object.keys(expected[0] ?? {})) {
    if (!inactiveColumns[column]) {
      throw new Error(`The inactive plan items have no "${column}" column.`);
    }
  }
};

/**
 * «فعالیت های غیرفعال تجهیز «…» به صورت زیر باشد» — exactly the rows given, in the order given
 * (first deactivated first), compared on the columns the Gherkin names. Read off the open folder
 * after an action through it — waiting until the sheet shows them, since it refreshes after the
 * dialog closes — and from `GET equipment/:id` otherwise (`common/pm-plan-folder-context.ts`).
 */
export const EnsureInactivePlanItemsAre = {
  onThePage: (equipmentName: string, expected: ListRow[]): Task => {
    checkInactiveColumns(expected);
    return Task.where(
      d`#actor ensures the folder of ${equipmentName} lists the inactive plan items ${expected}`,
      Wait.until(PmPlansPage.folderHeading(equipmentName), isVisible()),
      Wait.until(PmPlansPage.inactiveItemsSheet(), isPresent()),
      Wait.until(
        InactiveRowsOnThePage().as((rows) => onlyTheColumnsOf(expected, rows)),
        equals(expected),
      ),
    );
  },

  viaApi: (equipmentName: string, expected: ListRow[]): Interaction => {
    checkInactiveColumns(expected);
    return Interaction.where(
      d`#actor ensures the inactive plan items of ${equipmentName} are ${expected}`,
      async (actor) => {
        const rows = await inactiveRowsOverTheApi(actor, equipmentName);
        await Ensure.that(
          onlyTheColumnsOf(expected, rows),
          equals(expected),
        ).performAs(actor);
      },
    );
  },
};

/**
 * «فعالیت «…» (با دوره «…» روز (و اولین موعد «…»)) همچنان در فعالیت های غیرفعال تجهیز «…» باشد» —
 * among the inactive rows there is one of the activity with the values named (only the activity
 * when none is). Page or API as for `EnsureInactivePlanItemsAre`.
 */
export const EnsureActivityIsAmongInactivePlanItems = {
  onThePage: (equipmentName: string, expected: ListRow): Task =>
    Task.where(
      d`#actor ensures the folder of ${equipmentName} lists ${expected} as inactive`,
      Wait.until(PmPlansPage.folderHeading(equipmentName), isVisible()),
      Wait.until(PmPlansPage.inactiveItemsSheet(), isPresent()),
      Wait.until(
        InactiveRowsOnThePage().as((rows) =>
          onlyTheColumnsOf([expected], rows),
        ),
        containAtLeastOneItemThat(equals(expected)),
      ),
    ),

  viaApi: (equipmentName: string, expected: ListRow): Interaction =>
    Interaction.where(
      d`#actor ensures ${expected} is among the inactive plan items of ${equipmentName}`,
      async (actor) => {
        const rows = await inactiveRowsOverTheApi(actor, equipmentName);
        await Ensure.that(
          onlyTheColumnsOf([expected], rows),
          containAtLeastOneItemThat(equals(expected)),
        ).performAs(actor);
      },
    ),
};

/** An inactive row as the Gherkin names it, in the inactive list's columns. */
export const inactivePlanItem = (
  activityName: string,
  intervalDays?: string,
  firstDueDate?: string,
): ListRow => ({
  فعالیت: activityName,
  ...(intervalDays === undefined ? {} : { 'دوره (روز)': intervalDays }),
  ...(firstDueDate === undefined ? {} : { 'اولین موعد': firstDueDate }),
});

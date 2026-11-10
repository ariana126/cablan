import { d, Interaction, Question, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { PmPlansPage } from '../ui/pm-plans-page';
import { ChooseRowAction } from '../common/row-actions';
import { readAsTheSystemAdmin } from '../common/observer';
import {
  isoDateToJalaliDate,
  jalaliDateToIsoDate,
  tehranJalaliDateTimeOf,
} from '../common/jalali-datetime';
import {
  ClickInTheRowWhere,
  WaitForTheDialogToBeAnswered,
} from './maintenance-pages';
import {
  ApiReader,
  EquipmentDetailsReadModel,
  isAnExecution,
  MaintenanceExecutionReadModel,
  MaintenanceHistoryEntryReadModel,
  maintenanceHistoryResource,
  readEquipment,
  readMaintenanceExecutions,
  readMaintenanceHistory,
  readTheEquipmentNamed,
} from './maintenance-api';
import { MaintenanceHistoryRange } from '../common/maintenance-history-view-context';
import {
  theEquipmentNamed,
  theMaintenanceTaskNamed,
} from './maintenance-records';
import { LocateThePlanOf } from './pm-plan';

/**
 * Issue #110: the System Admin deletes PM execution records for good — one
 * (`DELETE equipment/:id/pm-plan-items/:itemId/executions/:executionId`) or every one of a plan
 * row (`DELETE …/pm-plan-items/:itemId/executions`). Nothing else changes: statuses are computed,
 * so the occurrence simply has no execution again. The history rows carry `id` and `planItemId`,
 * which is how an execution is addressed.
 *
 * Doors: «… سابقه انجام … را حذف می کند» is the folder's «سابقه PM» row's «حذف سابقه» and «… همه
 * سوابق ردیف فعال … را حذف می کند» the plan row's menu item «حذف همه سوابق», each confirmed; the
 * «تلاش …» attempts (403 for everyone else) and the passive «… حذف شده باشد / … حذف کرده باشد» go
 * through the API. Facts are the history over the API.
 */

/**
 * The recordings in the history — every fact here but «خالی» is phrased about «انجام» / «سابقه
 * انجام», and since issue #114 the history also lists the occurrences nobody recorded.
 */
const historyOf = (
  actor: ApiReader,
  equipmentId: string,
): Promise<MaintenanceExecutionReadModel[]> =>
  readMaintenanceExecutions(actor, equipmentId);

/** The one recording of `maintenanceTask` for `dueDate`, as the history lists it. */
const theOneExecution = (
  history: MaintenanceExecutionReadModel[],
  maintenanceTask: string,
  dueDate: string,
): MaintenanceExecutionReadModel => {
  const { activityName } = theMaintenanceTaskNamed(maintenanceTask);
  const matching = history.filter(
    (entry) =>
      entry.activityName === activityName &&
      entry.dueDate === jalaliDateToIsoDate(dueDate),
  );
  if (matching.length !== 1) {
    throw new Error(
      `Expected exactly one recording of ${maintenanceTask} for ${dueDate}, found ${matching.length}.`,
    );
  }
  return matching[0];
};

/** The route of one execution — found in the history as the system admin, since it is setup. */
const TheExecutionRoute = (maintenanceTask: string, dueDate: string) =>
  Question.about(
    d`the execution of ${maintenanceTask} for ${dueDate}`,
    async () => {
      const { equipmentName } = theMaintenanceTaskNamed(maintenanceTask);
      const { id: equipmentId } = theEquipmentNamed(equipmentName);
      const history = await readAsTheSystemAdmin<
        MaintenanceHistoryEntryReadModel[]
      >(maintenanceHistoryResource(equipmentId));
      const execution = theOneExecution(
        history.filter(isAnExecution),
        maintenanceTask,
        dueDate,
      );
      return `equipment/${equipmentId}/pm-plan-items/${execution.planItemId}/executions/${execution.id}`;
    },
  );

export const DeleteMaintenanceExecution = {
  /**
   * The folder's «سابقه PM» sheet: the row of the activity due that day, its «حذف سابقه», the
   * confirmation; done once the confirmation has closed or told what went wrong.
   */
  using: (maintenanceTask: string, dueDate: string): Task => {
    const { activityName, equipmentName } =
      theMaintenanceTaskNamed(maintenanceTask);
    return Task.where(
      d`#actor deletes the recording of ${maintenanceTask} for ${dueDate}`,
      LocateThePlanOf(equipmentName),
      ClickInTheRowWhere(
        `#actor chooses to delete the recording of ${activityName} due ${dueDate}`,
        {
          tables: PmPlansPage.historyTables,
          columnHeadersOf: PmPlansPage.historyColumnHeadersOf,
          rowsOf: PmPlansPage.historyRowsOf,
          rowCells: PmPlansPage.historyRowCells,
        },
        (row) => row['فعالیت'] === activityName && row['موعد'] === dueDate,
        PmPlansPage.deleteExecutionButton,
      ),
      Wait.until(PmPlansPage.confirmExecutionDeletionButton(), isVisible()),
      Click.on(PmPlansPage.confirmExecutionDeletionButton()),
      WaitForTheDialogToBeAnswered(
        PmPlansPage.confirmExecutionDeletionButton(),
        PmPlansPage.openDialogAlert(),
      ),
    );
  },

  /** `DELETE …/executions/:executionId` — the «تلاش …» attempts, whose answer a later step judges. */
  viaApiUsing: (maintenanceTask: string, dueDate: string): Task =>
    Task.where(
      d`#actor deletes the recording of ${maintenanceTask} for ${dueDate} (via API)`,
      Send.a(DeleteRequest.to(TheExecutionRoute(maintenanceTask, dueDate))),
    ),

  /** The passive «… حذف شده باشد»: the same, checked for its 204. */
  asAPrecondition: (maintenanceTask: string, dueDate: string): Task =>
    Task.where(
      d`#actor has deleted the recording of ${maintenanceTask} for ${dueDate}`,
      DeleteMaintenanceExecution.viaApiUsing(maintenanceTask, dueDate),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/**
 * «… همه سوابق ردیف فعال … را حذف می کند» — the active plan row's menu in the folder, «حذف همه
 * سوابق», the confirmation.
 */
export const DeleteAllExecutionsOfTheActivePlanItem = {
  using: (maintenanceTask: string): Task => {
    const { activityName, equipmentName } =
      theMaintenanceTaskNamed(maintenanceTask);
    return Task.where(
      d`#actor deletes every recording of the active plan row of ${maintenanceTask}`,
      LocateThePlanOf(equipmentName),
      ChooseRowAction(activityName, 'delete-all-executions'),
      Wait.until(
        PmPlansPage.confirmDeletionOfAllExecutionsButton(),
        isVisible(),
      ),
      Click.on(PmPlansPage.confirmDeletionOfAllExecutionsButton()),
      WaitForTheDialogToBeAnswered(
        PmPlansPage.confirmDeletionOfAllExecutionsButton(),
        PmPlansPage.openDialogAlert(),
      ),
    );
  },
};

// ---------------------------------------------------------------------------------------------
// Facts — the history over the API

const entriesOf = async (
  actor: ApiReader,
  maintenanceTask: string,
): Promise<{
  equipment: EquipmentDetailsReadModel;
  entries: MaintenanceExecutionReadModel[];
}> => {
  const { activityName, equipmentName } =
    theMaintenanceTaskNamed(maintenanceTask);
  const { id } = theEquipmentNamed(equipmentName);
  const equipment = await readEquipment(actor, id);
  const entries = (await historyOf(actor, id)).filter(
    (entry) => entry.activityName === activityName,
  );
  return { equipment, entries };
};

/** «سابقه تعمیرات … فقط انجام موعد «…» را داشته باشد» — every entry, and only that due date. */
export const EnsureTheHistoryHoldsOnlyTheDueDate = (
  equipmentName: string,
  dueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the maintenance history of ${equipmentName} holds only the recording for ${dueDate}`,
    async (actor) => {
      const dueDates = (
        await historyOf(actor, theEquipmentNamed(equipmentName).id)
      ).map((entry) => isoDateToJalaliDate(entry.dueDate));
      await Ensure.that(dueDates, equals([dueDate])).performAs(actor);
    },
  );

/** «سابقه انجام … برای موعد «…» همچنان در سابقه تعمیرات … باشد» — the refused deletion left it. */
export const EnsureTheExecutionForTheDueDateIsStillInHistory = (
  maintenanceTask: string,
  dueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the recording of ${maintenanceTask} for ${dueDate} is still in the history`,
    async (actor) => {
      const { entries } = await entriesOf(actor, maintenanceTask);
      const forTheDueDate = entries.filter(
        (entry) => entry.dueDate === jalaliDateToIsoDate(dueDate),
      );
      await Ensure.that(forTheDueDate.length, equals(1)).performAs(actor);
    },
  );

/** «هیچ انجامی از ردیف فعال … در سابقه تعمیرات … نباشد» — none recorded against the active row. */
export const EnsureNoExecutionOfTheActivePlanItem = (
  maintenanceTask: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures nothing recorded against the active plan row of ${maintenanceTask} is left`,
    async (actor) => {
      const { activityName } = theMaintenanceTaskNamed(maintenanceTask);
      const { equipment, entries } = await entriesOf(actor, maintenanceTask);
      const activeIds = equipment.planItems
        .filter((item) => item.activityName === activityName)
        .map((item) => item.id);
      await Ensure.that(activeIds.length, equals(1)).performAs(actor);
      await Ensure.that(
        entries.filter((entry) => activeIds.includes(entry.planItemId)),
        equals([]),
      ).performAs(actor);
    },
  );

/**
 * «سابقه انجام ردیف غیرفعال … در «…» همچنان در سابقه تعمیرات … باشد» — a recording made that
 * (Tehran) day against one of the activity's deactivated rows is still there.
 */
export const EnsureAnExecutionOfAnInactivePlanItemIsStillInHistory = (
  maintenanceTask: string,
  performedOn: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the recording of an inactive row of ${maintenanceTask} on ${performedOn} is still in the history`,
    async (actor) => {
      const { activityName } = theMaintenanceTaskNamed(maintenanceTask);
      const { equipment, entries } = await entriesOf(actor, maintenanceTask);
      const inactiveIds = equipment.inactivePlanItems
        .filter((item) => item.activityName === activityName)
        .map((item) => item.id);
      const sameDay = entries.filter(
        (entry) =>
          inactiveIds.includes(entry.planItemId) &&
          tehranJalaliDateTimeOf(entry.performedAt).startsWith(
            `${performedOn} `,
          ),
      );
      await Ensure.that(sameDay.length, isGreaterThan(0)).performAs(actor);
    },
  );

/**
 * «سابقه انجام «فعالیت» برای موعد «…» در سابقه تعمیرات «تجهیز» باشد» — said of equipment whose name
 * was just corrected, so the equipment is found by its name now, over the API.
 */
export const EnsureTheHistoryOfTheEquipmentNamedHolds = (
  equipmentName: string,
  activityName: string,
  dueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the maintenance history of ${equipmentName} holds ${activityName} for ${dueDate}`,
    async (actor) => {
      const { id } = await readTheEquipmentNamed(actor, equipmentName);
      const matching = (await historyOf(actor, id)).filter(
        (entry) =>
          entry.activityName === activityName &&
          entry.dueDate === jalaliDateToIsoDate(dueDate),
      );
      await Ensure.that(matching.length, equals(1)).performAs(actor);
    },
  );

/**
 * «سابقه تعمیرات … خالی باشد» — of the equipment the system has by that name now: no entry at all,
 * neither a recording nor a missed occurrence (issue #114) — of the range given, if any.
 */
export const EnsureTheHistoryOfTheEquipmentNamedIsEmpty = (
  equipmentName: string,
  range?: MaintenanceHistoryRange,
): Interaction =>
  Interaction.where(
    d`#actor ensures the maintenance history of ${equipmentName} is empty`,
    async (actor) => {
      const { id } = await readTheEquipmentNamed(actor, equipmentName);
      await Ensure.that(
        await readMaintenanceHistory(actor, id, range),
        equals([]),
      ).performAs(actor);
    },
  );

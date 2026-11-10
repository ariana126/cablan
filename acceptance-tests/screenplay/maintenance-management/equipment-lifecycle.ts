import {
  actorCalled,
  d,
  Interaction,
  Question,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isPresent } from '@serenity-js/assertions';
import {
  DeleteRequest,
  LastResponse,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { EquipmentPage } from '../ui/equipment-page';
import { PmPlansPage } from '../ui/pm-plans-page';
import { RowActions } from '../common/row-actions';
import { PickJalaliDateTime } from '../common/pick-jalali-date-time';
import { EnsureProblemDetail } from '../common/problem-detail';
import {
  isoDateToJalaliDate,
  jalaliDateToIsoDate,
  tehranJalaliDateOf,
} from '../common/jalali-datetime';
import { FreezeTimeAt, LetTimePass } from '../common/clock';
import { realNameFor } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import { systemClock } from '../../support/system-clock';
import {
  ClickInTheRowWhere,
  LocateEquipmentPage,
  WaitForTheDialogToBeAnswered,
} from './maintenance-pages';
import {
  MaintenanceExecutionReadModel,
  PmPlanItemReadModel,
  readEquipment,
  readEquipmentList,
  readMaintenanceExecutions,
  readPmOverview,
  readTheEquipmentNamed,
} from './maintenance-api';
import {
  asTheSystemAdmin,
  asTheSystemAdminOn,
  renewTheSessionInTheSpotlight,
  theEquipmentNamed,
  theMaintenanceTaskNamed,
  thePlanItemFor,
} from './maintenance-records';
import {
  DeactivateActivityInPmPlan,
  EnsureNextDueDate,
  LocateThePlanOf,
  PutActivityInPmPlan,
  ShowTheInactivePlanItems,
} from './pm-plan';
import { recordedAsAPrecondition } from './pm-executions';

/**
 * Issue #110's System Admin exceptions on equipment and its plan rows: deleting a deactivated
 * plan row with its executions (`DELETE equipment/:id/pm-plan-items/:itemId`, 409
 * `pm-plan-item-active` on an active one), deleting retired equipment with everything under it
 * (`DELETE equipment/:id`, 409 `equipment-not-retired` on an active one) and reactivating retired
 * equipment (`POST equipment/:id/reactivation` `{ rescheduledItems?: [{ planItemId, firstDueDate }]
 * }` — a row not listed continues its previous calendar; a first due date before today is 400
 * `reactivation-first-due-date-in-past`). Everyone else gets 403.
 *
 * Doors: the plain «… حذف می کند / … دوباره فعال می کند» drive `/equipment` (the retired row's
 * menu) and the folder's «فعالیت‌های غیرفعال» sheet; every «تلاش …» and every passive «… کرده باشد
 * / … شده باشد» go through the API. Facts are read over the API.
 */

// ---------------------------------------------------------------------------------------------
// Deleting retired equipment

const OpenTheRowMenuOf = (equipmentName: string): Task =>
  Task.where(
    d`#actor opens the actions menu of ${equipmentName}`,
    LocateEquipmentPage(),
    Wait.until(RowActions.menuButton(equipmentName), isVisible()),
    Click.on(RowActions.menuButton(equipmentName)),
  );

export const DeleteEquipment = {
  /** `/equipment`: the retired row's menu, «حذف تجهیز», the confirmation. */
  using: (equipmentName: string): Task =>
    Task.where(
      d`#actor deletes the equipment ${equipmentName}`,
      OpenTheRowMenuOf(equipmentName),
      Wait.until(EquipmentPage.deleteMenuItem(), isVisible()),
      Click.on(EquipmentPage.deleteMenuItem()),
      Wait.until(EquipmentPage.confirmDeletionButton(), isVisible()),
      Click.on(EquipmentPage.confirmDeletionButton()),
      WaitForTheDialogToBeAnswered(
        EquipmentPage.confirmDeletionButton(),
        EquipmentPage.dialogAlert(),
      ),
    ),

  /** `DELETE equipment/:id` — the «تلاش …» attempts (409 on active equipment, 403 for others). */
  viaApiUsing: (equipmentName: string): Task =>
    Task.where(
      d`#actor deletes the equipment ${equipmentName} (via API)`,
      Send.a(
        DeleteRequest.to(`equipment/${theEquipmentNamed(equipmentName).id}`),
      ),
    ),

  /** The passive «… حذف شده باشد / … حذف کرده باشد», checked for its 204. */
  asAPrecondition: (equipmentName: string): Task =>
    Task.where(
      d`#actor has deleted the equipment ${equipmentName}`,
      DeleteEquipment.viaApiUsing(equipmentName),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

// ---------------------------------------------------------------------------------------------
// Reactivating retired equipment

/** A plan row restarted from a new first due date, its interval kept. */
export interface NewFirstDueDate {
  activityName: string;
  /** Jalali `YYYY/MM/DD`. */
  firstDueDate: string;
}

/**
 * How each active row resumes. `continued` names the rows said to continue their previous
 * calendar; a row named in neither list continues too (the route's default, and the dialog's).
 */
export interface ReactivationChoices {
  continued: string[];
  rescheduled: NewFirstDueDate[];
}

const CONTINUE = 'ادامه برنامه قبلی';
const RESTART = /^اولین موعد تازه "([^"]+)" برای (.+)$/;

/**
 * The Gherkin's clause after «را با …» — «ادامه برنامه قبلی (تعویض روغن)», «اولین موعد تازه
 * «1405/07/25» برای تعویض روغن», or several joined by «و» — as the choices it states.
 */
export const reactivationChoicesIn = (clause: string): ReactivationChoices => {
  const choices: ReactivationChoices = { continued: [], rescheduled: [] };
  for (const part of clause
    .trim()
    .split(/ و (?=ادامه برنامه قبلی|اولین موعد تازه)/)) {
    const restart = RESTART.exec(part);
    if (restart) {
      choices.rescheduled.push({
        firstDueDate: restart[1],
        activityName: restart[2].trim(),
      });
    } else if (part === CONTINUE) {
      continue;
    } else if (part.startsWith(`${CONTINUE} `)) {
      choices.continued.push(part.slice(CONTINUE.length + 1).trim());
    } else {
      throw new Error(`"${part}" is not a way to resume a plan row.`);
    }
  }
  return choices;
};

const rescheduledItemsFor = (
  equipmentName: string,
  rescheduled: NewFirstDueDate[],
) =>
  rescheduled.map(({ activityName, firstDueDate }) => ({
    planItemId: thePlanItemFor(equipmentName, activityName).id,
    firstDueDate: jalaliDateToIsoDate(firstDueDate),
  }));

export const ReactivateEquipment = {
  /**
   * `/equipment`: the retired row's menu, «فعال سازی دوباره», then per active row the choice the
   * step states — «ادامه برنامه قبلی», or «تعیین اولین موعد تازه» and the date — and submit. A row
   * the step does not name is left on the dialog's default.
   */
  using: (
    equipmentName: string,
    { continued, rescheduled }: ReactivationChoices,
  ): Task =>
    Task.where(
      d`#actor reactivates the equipment ${equipmentName}`,
      OpenTheRowMenuOf(equipmentName),
      Wait.until(EquipmentPage.reactivateMenuItem(), isVisible()),
      Click.on(EquipmentPage.reactivateMenuItem()),
      Wait.until(EquipmentPage.confirmReactivationButton(), isVisible()),
      ...continued.map((activityName) =>
        Click.on(EquipmentPage.continueThePreviousCalendarOption(activityName)),
      ),
      ...rescheduled.flatMap(({ activityName, firstDueDate }) => [
        Click.on(EquipmentPage.setANewFirstDueDateOption(activityName)),
        PickJalaliDateTime.dateOf(firstDueDate).in(
          EquipmentPage.newFirstDueDateField(activityName),
        ),
      ]),
      Click.on(EquipmentPage.confirmReactivationButton()),
      WaitForTheDialogToBeAnswered(
        EquipmentPage.confirmReactivationButton(),
        EquipmentPage.dialogAlert(),
      ),
    ),

  /** `POST equipment/:id/reactivation` — the «تلاش …» attempts; `rescheduledItems` only when any. */
  viaApiUsing: (
    equipmentName: string,
    rescheduled: NewFirstDueDate[] = [],
  ): Task =>
    Task.where(
      d`#actor reactivates the equipment ${equipmentName} (via API)`,
      Send.a(
        PostRequest.to(
          `equipment/${theEquipmentNamed(equipmentName).id}/reactivation`,
        ).with(
          Question.about('the reactivation request', () =>
            rescheduled.length === 0
              ? {}
              : {
                  rescheduledItems: rescheduledItemsFor(
                    equipmentName,
                    rescheduled,
                  ),
                },
          ),
        ),
      ),
    ),

  /**
   * The passive «… (با ادامه برنامه قبلی …) دوباره فعال شده باشد / … فعال کرده باشد», 204 checked;
   * every row not `rescheduled` continues its previous calendar.
   */
  asAPrecondition: (
    equipmentName: string,
    rescheduled: NewFirstDueDate[] = [],
  ): Task =>
    Task.where(
      d`#actor has reactivated the equipment ${equipmentName}`,
      ReactivateEquipment.viaApiUsing(equipmentName, rescheduled),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/** «به او گفته شود که اولین موعد تازه نمی تواند پیش از روز فعال سازی باشد» — the 400. */
export const EnsureToldANewFirstDueDateCannotPrecedeTheReactivation =
  (): Task =>
    Task.where(
      '#actor ensures they were told a new first due date cannot precede the reactivation day',
      EnsureProblemDetail(400, 'reactivation-first-due-date-in-past'),
    );

// ---------------------------------------------------------------------------------------------
// Deleting a plan row

export const DeletePlanItem = {
  /**
   * The folder's «فعالیت‌های غیرفعال» sheet: the deactivated row of the activity with that
   * interval, its «حذف ردیف», the confirmation. The folder stays open afterwards.
   */
  using: (
    equipmentName: string,
    activityName: string,
    intervalDays: string,
  ): Task =>
    Task.where(
      d`#actor deletes the inactive ${intervalDays}-day row of ${activityName} from the PM plan of ${equipmentName}`,
      LocateThePlanOf(equipmentName),
      Wait.until(PmPlansPage.inactiveItemsSheet(), isPresent()),
      ShowTheInactivePlanItems(),
      ClickInTheRowWhere(
        `#actor chooses to delete the inactive ${intervalDays}-day row of ${activityName}`,
        {
          tables: PmPlansPage.inactiveItemsTables,
          columnHeadersOf: PmPlansPage.inactiveItemsColumnHeadersOf,
          rowsOf: PmPlansPage.inactiveItemsRowsOf,
          rowCells: PmPlansPage.inactiveItemsRowCells,
        },
        (row) =>
          row['فعالیت'] === activityName && row['دوره (روز)'] === intervalDays,
        PmPlansPage.deleteInactiveItemButton,
      ),
      Wait.until(PmPlansPage.confirmInactiveItemDeletionButton(), isVisible()),
      Click.on(PmPlansPage.confirmInactiveItemDeletionButton()),
      WaitForTheDialogToBeAnswered(
        PmPlansPage.confirmInactiveItemDeletionButton(),
        PmPlansPage.openDialogAlert(),
      ),
    ),

  /**
   * `DELETE equipment/:id/pm-plan-items/:itemId` of the activity's latest row — the deactivated one
   * after «… غیرفعال شده باشد», the active one otherwise — for the «تلاش …» attempts.
   */
  viaApiUsing: (equipmentName: string, activityName: string): Task =>
    Task.where(
      d`#actor deletes the row of ${activityName} from the PM plan of ${equipmentName} (via API)`,
      Send.a(
        DeleteRequest.to(
          Question.about(
            `the row of ${activityName} in the PM plan of ${equipmentName}`,
            () => {
              const item = thePlanItemFor(equipmentName, activityName);
              return `equipment/${item.equipment.id}/pm-plan-items/${item.id}`;
            },
          ),
        ),
      ),
    ),

  /** The passive «… را از برنامه تجهیز … حذف کرده باشد», checked for its 204. */
  asAPrecondition: (equipmentName: string, activityName: string): Task =>
    Task.where(
      d`#actor has deleted the inactive row of ${activityName} from the PM plan of ${equipmentName}`,
      DeletePlanItem.viaApiUsing(equipmentName, activityName),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

// ---------------------------------------------------------------------------------------------
// Facts — over the API

/** «تجهیز «…» در سیستم ثبت نشده باشد» — no equipment by that name. */
export const EnsureNoEquipmentIsNamed = (equipmentName: string): Interaction =>
  Interaction.where(
    d`#actor ensures no equipment is named ${equipmentName}`,
    async (actor) => {
      const named = (await readEquipmentList(actor)).filter(
        (equipment) => equipment.name === equipmentName,
      );
      await Ensure.that(named, equals([])).performAs(actor);
    },
  );

/**
 * «تجهیز «…» (همچنان) فعال باشد / در تجهیزات فعال باشد / (همچنان) کنار گذاشته شده باشد» — the one
 * equipment by that name is (not) retired.
 */
export const EnsureEquipmentIsRetired = (
  equipmentName: string,
  retired: boolean,
): Interaction =>
  Interaction.where(
    d`#actor ensures the equipment ${equipmentName} is ${retired ? 'retired' : 'active'}`,
    async (actor) => {
      const equipment = await readTheEquipmentNamed(actor, equipmentName);
      await Ensure.that(equipment.retired, equals(retired)).performAs(actor);
    },
  );

/** «هیچ فعالیتی در برنامه تجهیز «…» نباشد» — neither an active nor a deactivated row. */
export const EnsureThePlanOfTheEquipmentNamedIsEmpty = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the PM plan of ${equipmentName} is empty`,
    async (actor) => {
      const { id } = await readTheEquipmentNamed(actor, equipmentName);
      const { planItems, inactivePlanItems } = await readEquipment(actor, id);
      await Ensure.that(
        [...planItems, ...inactivePlanItems],
        equals([]),
      ).performAs(actor);
    },
  );

/**
 * The due dates a fact about deleted equipment looks across: every scenario stating it plans from
 * 1405/07/01 and acts within that month.
 */
const THE_SCENARIO_MONTH = { from: '1405/07/01', to: '1405/07/30' };

/**
 * «هیچ موعد یا سابقه ای از … در برنامه کلی تعمیرات و نگهداری نباشد» — no occurrence of the
 * equipment, recorded or not, in the overview of the scenario's month. Matched by name: a deleted
 * equipment's id is gone.
 */
export const EnsureNothingOfTheEquipmentInTheOverview = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures nothing of ${equipmentName} is in the PM overview`,
    async (actor) => {
      const ofTheEquipment = (
        await readPmOverview(actor, THE_SCENARIO_MONTH)
      ).filter((occurrence) => occurrence.equipmentName === equipmentName);
      await Ensure.that(ofTheEquipment, equals([])).performAs(actor);
    },
  );

const dueDatesOf = async (
  actor: Parameters<typeof readPmOverview>[0],
  maintenanceTask: string,
  range: { from: string; to: string },
): Promise<string[]> => {
  const { activityName, equipmentName } =
    theMaintenanceTaskNamed(maintenanceTask);
  return (await readPmOverview(actor, range))
    .filter(
      (occurrence) =>
        occurrence.equipmentName === equipmentName &&
        occurrence.activityName === activityName,
    )
    .map((occurrence) => occurrence.dueDate)
    .sort();
};

/**
 * «موعد «…» … جزو تعهد PM نباشد» — a due date inside a retirement gap is not generated at all: the
 * overview has no occurrence of the task due that day.
 */
export const EnsureTheDueDateIsNotACommitment = (
  maintenanceTask: string,
  dueDate: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${maintenanceTask} due ${dueDate} is not a PM commitment`,
    async (actor) => {
      await Ensure.that(
        await dueDatesOf(actor, maintenanceTask, {
          from: dueDate,
          to: dueDate,
        }),
        equals([]),
      ).performAs(actor);
    },
  );

/**
 * «موعدهای بعدی … «…» و «…» باشند» — the next due date is the first, and the overview from it to
 * the second holds exactly those two due dates.
 */
export const EnsureTheNextDueDatesAre = (
  maintenanceTask: string,
  first: string,
  second: string,
): Task =>
  Task.where(
    d`#actor ensures the next due dates of ${maintenanceTask} are ${first} and ${second}`,
    EnsureNextDueDate(maintenanceTask, first),
    Interaction.where(
      d`#actor ensures ${maintenanceTask} falls due on ${first} and ${second}`,
      async (actor) => {
        await Ensure.that(
          await dueDatesOf(actor, maintenanceTask, { from: first, to: second }),
          equals([jalaliDateToIsoDate(first), jalaliDateToIsoDate(second)]),
        ).performAs(actor);
      },
    ),
  );

// ---------------------------------------------------------------------------------------------
// An earlier row, set up after the current one

export interface EarlierPlanItem {
  equipmentName: string;
  activityName: string;
  intervalDays: string;
  /** Jalali `YYYY/MM/DD` — the row's first due date and the day its one execution was recorded. */
  performedOn: string;
}

/**
 * «پیش از ردیف فعلی، ردیف دیگری از … بوده که انجامش در … ثبت شده و غیرفعال شده باشد»
 * (recording-maintenance-execution, issue #110). The current active row was put in the plan by the
 * background — and recorded by an earlier step — before this precondition runs, while an activity
 * has one active row at a time, so an *earlier* row cannot simply be added. The System Admin's own
 * row deletion makes the order true through the public API instead:
 *
 * 1. the current row (and its executions) is noted, deactivated and deleted — the deletion takes
 *    its executions with it;
 * 2. on `performedOn` the earlier row is added (first due that day), recorded and deactivated;
 * 3. the current row is added again with its interval and first due date, and each noted execution
 *    is recorded again on its own day for its own due date — by یاشار, who is the only performer
 *    the stating scenario uses (checked, not assumed);
 *
 * then the system's clock is put back where it was and the spotlight's session renewed.
 */
export const putAnEarlierInactiveRowBeforeTheActiveOne = async ({
  equipmentName,
  activityName,
  intervalDays,
  performedOn,
}: EarlierPlanItem): Promise<void> => {
  const restoreTo = systemClock.now();
  const maintenanceTask = `${activityName} ${equipmentName}`;
  let current: PmPlanItemReadModel | undefined;
  let executions: MaintenanceExecutionReadModel[] = [];

  await asTheSystemAdmin(
    Interaction.where(
      d`#actor notes the active row of ${activityName} on ${equipmentName} and its executions`,
      async (actor) => {
        const { id } = theEquipmentNamed(equipmentName);
        const active = (await readEquipment(actor, id)).planItems.filter(
          (item) => item.activityName === activityName,
        );
        if (active.length !== 1) {
          throw new Error(
            `Expected one active row of "${activityName}" on "${equipmentName}", found ${active.length}.`,
          );
        }
        current = active[0];
        const rowId = active[0].id;
        executions = (await readMaintenanceExecutions(actor, id)).filter(
          (entry) => entry.planItemId === rowId,
        );
        await Ensure.that(
          executions.map((entry) => entry.performedBy),
          equals(executions.map(() => realNameFor('یاشار'))),
        ).performAs(actor);
      },
    ),
    DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    DeletePlanItem.asAPrecondition(equipmentName, activityName),
  );
  if (!current) {
    throw new Error(`The active row of "${activityName}" was not noted.`);
  }
  const theCurrentRow = current;

  await asTheSystemAdminOn(
    performedOn,
    PutActivityInPmPlan({
      equipmentName,
      activityName,
      intervalDays,
      firstDueDate: performedOn,
    }),
  );
  await recordedAsAPrecondition(maintenanceTask, performedOn, performedOn);
  await asTheSystemAdmin(
    DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    LetTimePass(60_000),
    PutActivityInPmPlan({
      equipmentName,
      activityName,
      intervalDays: String(theCurrentRow.intervalDays),
      firstDueDate: isoDateToJalaliDate(theCurrentRow.firstDueDate),
    }),
  );
  for (const execution of executions) {
    await recordedAsAPrecondition(
      maintenanceTask,
      tehranJalaliDateOf(execution.performedAt),
      isoDateToJalaliDate(execution.dueDate),
    );
  }

  await keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(FreezeTimeAt(restoreTo)),
  );
  await renewTheSessionInTheSpotlight();
};

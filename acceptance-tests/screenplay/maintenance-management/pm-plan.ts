import { d, Interaction, Question, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isPresent, not } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { PmPlansPage } from '../ui/pm-plans-page';
import { ChooseRowAction } from '../common/row-actions';
import { ChooseFromSearchableSelect } from '../common/searchable-select';
import { PickJalaliDateTime } from '../common/pick-jalali-date-time';
import { jalaliDateToIsoDate } from '../common/jalali-datetime';
import { EnsureProblemDetail } from '../common/problem-detail';
import { taskDependingOn } from '../common/task-depending-on';
import {
  LocatePmPlansPage,
  WaitForTheDialogToBeAnswered,
} from './maintenance-pages';
import {
  ApiReader,
  PmPlanItemReadModel,
  readEquipment,
} from './maintenance-api';
import {
  rememberPlanItem,
  theActivityNamed,
  theEquipmentNamed,
  theMaintenanceTaskNamed,
} from './maintenance-records';
import { RegisterMaintenanceActivityUnlessRegistered } from './maintenance-activity';

/**
 * The PM-plan vocabulary — planning-preventive-maintenance.feature, and the plan every other
 * maintenance feature states as a precondition. An equipment's plan items are read from
 * `GET equipment/:id` (`planItems`, active items only); they are written through
 * `POST/PATCH/DELETE equipment/:id/pm-plan-items[/:itemId]` or the `/pm-plans` page.
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
 * Clicks the equipment's card on the board (issue #81). The card is waited for as *present*, not
 * visible — a long board can push it below the fold, and `Click.on` scrolls it into view. The plan
 * sheet below is ready once its «افزودن فعالیت» is drawn.
 */
const ChooseTheEquipment = (equipmentName: string): Task =>
  Task.where(
    d`#actor chooses the equipment ${equipmentName}`,
    Wait.until(PmPlansPage.equipmentCard(equipmentName), isPresent()),
    Click.on(PmPlansPage.equipmentCard(equipmentName)),
    Wait.until(PmPlansPage.addItemButton(), isPresent()),
  );

const LocateThePlanOf = (equipmentName: string): Task =>
  Task.where(
    d`#actor locates the PM plan of ${equipmentName}`,
    LocatePmPlansPage(),
    ChooseTheEquipment(equipmentName),
  );

/**
 * Equipment has a card on the board only while it has an active plan item (and is not retired) —
 * the rule the page draws its board by. Asked of the actor's own API session (`GET equipment/:id`,
 * whose `planItems` are the active ones) rather than read off the board, because an empty board
 * cannot be told from one still loading.
 */
const HasACardOnTheBoard = (equipmentName: string) =>
  Question.about<boolean>(
    d`whether ${equipmentName} has a card on the PM plans board`,
    async (actor) => {
      // A question is typed for the narrower `AnswersQuestions & UsesAbilities`, but whoever answers
      // it here is a full `Actor`, which also collects the request's artifacts.
      const equipment = await readEquipment(
        actor as unknown as ApiReader,
        theEquipmentNamed(equipmentName).id,
      );
      return !equipment.retired && equipment.planItems.length > 0;
    },
  );

/**
 * Opens the add-item dialog for the equipment: through its card's «افزودن فعالیت» when it has a
 * card, otherwise through «تعریف برنامه برای تجهیز», choosing the equipment in the dialog's own
 * «تجهیز» picker (issue #81). Either way the dialog then asks for the activity.
 */
const OpenTheAddItemDialogFor = (equipmentName: string): Task =>
  taskDependingOn(
    `#actor opens the add activity dialog for ${equipmentName}`,
    HasACardOnTheBoard(equipmentName),
    (hasACard) =>
      hasACard
        ? [
            LocateThePlanOf(equipmentName),
            Click.on(PmPlansPage.addItemButton()),
          ]
        : [
            LocatePmPlansPage(),
            Click.on(PmPlansPage.definePlanButton()),
            Wait.until(PmPlansPage.dialogEquipmentPicker(), isVisible()),
            ChooseFromSearchableSelect(
              PmPlansPage.dialogEquipmentPicker(),
              equipmentName,
              PmPlansPage.option(equipmentName),
            ),
          ],
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
   * Through `/pm-plans`: the add-item dialog (from the equipment's card, or «تعریف برنامه برای
   * تجهیز» when it has none), the activity, the interval in days and the first due date from the
   * Jalali calendar — each only when the step names it, so «… بدون دوره / اولین موعد …» leaves that
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
};

/** «… فعالیت «…» را از برنامه تجهیز «…» حذف می کند» — the row menu, «حذف», the confirmation. */
export const RemoveActivityFromPmPlan = {
  using: (equipmentName: string, activityName: string): Task =>
    Task.where(
      d`#actor removes ${activityName} from the PM plan of ${equipmentName}`,
      LocateThePlanOf(equipmentName),
      ChooseRowAction(activityName, 'delete'),
      Wait.until(PmPlansPage.confirmRemovalButton(), isVisible()),
      Click.on(PmPlansPage.confirmRemovalButton()),
      Wait.until(PmPlansPage.confirmRemovalButton(), not(isPresent())),
    ),
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

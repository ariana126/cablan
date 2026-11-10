import { Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  asAMaintenanceObserver,
  asTheSystemAdmin,
  asTheSystemAdminOn,
} from '../../screenplay/maintenance-management/maintenance-records';
import {
  EnsureEquipmentIsRegistered,
  RegisterEquipmentUnlessRegistered,
  RetireEquipment,
} from '../../screenplay/maintenance-management/equipment';
import {
  EnsureMaintenanceActivityIsRegistered,
  RegisterMaintenanceActivityUnlessRegistered,
} from '../../screenplay/maintenance-management/maintenance-activity';
import {
  DeleteEquipment,
  DeletePlanItem,
  EnsureEquipmentIsRetired,
  EnsureNoEquipmentIsNamed,
  EnsureNothingOfTheEquipmentInTheOverview,
  EnsureTheDueDateIsNotACommitment,
  EnsureTheNextDueDatesAre,
  EnsureToldANewFirstDueDateCannotPrecedeTheReactivation,
  ReactivateEquipment,
  reactivationChoicesIn,
} from '../../screenplay/maintenance-management/equipment-lifecycle';
import { EnsureAnExecutionOfAnInactivePlanItemIsStillInHistory } from '../../screenplay/maintenance-management/pm-execution-deletion';
import { LetTimePass } from '../../screenplay/common/clock';
import {
  AddActivityToPmPlan,
  ChangePmInterval,
  EnsureActivityIsInPmPlanWithInterval,
  EnsureActivityIsNotInPmPlan,
  EnsureDuplicatePlanItemErrorShown,
  EnsureFirstDueDateOfThatPlanItem,
  EnsureNextDueDate,
  EnsurePlanItemFieldErrorShown,
  EnsureToldPlansAreDayBasedOnly,
  PutActivityInPmPlan,
  DeactivateActivityInPmPlan,
  EnsureActivityIsActiveInPmPlanWith,
  EnsureActivityIsAmongInactivePlanItems,
  EnsureActivityIsStillActiveInPmPlan,
  EnsureInactivePlanItemsAre,
  EnsureNoActivityIsActiveInPmPlan,
  EnsureOnlyActivityActiveInPmPlan,
  inactivePlanItem,
  PutActivityInPmPlanAndDeactivateIt,
  ReactivateActivityInPmPlan,
  UNSTATED_FIRST_DUE_DATE,
  UNSTATED_INTERVAL_DAYS,
} from '../../screenplay/maintenance-management/pm-plan';
import {
  EnsureMaintenanceHistoryIs,
  EnsureExecutionIsStillInHistory,
  EnsureNoExecutionInHistoryOn,
  recordedEachAsAPrecondition,
  recordedByAsAPrecondition,
} from '../../screenplay/maintenance-management/pm-executions';
import {
  EnsureInDailyPmScheduleViaApi,
  EnsureNothingOfEquipmentInDailyPmScheduleViaApi,
  EnsureNotInDailyPmScheduleViaApi,
} from '../../screenplay/maintenance-management/pm-schedule';
import { ListRow } from '../../screenplay/maintenance-management/maintenance-pages';
import {
  lastPmPlanFolderView,
  lookedAtPmPlanFolder,
} from '../../screenplay/common/pm-plan-folder-context';
import { theMaintenanceHistoryRangeLookedAt } from '../../screenplay/common/maintenance-history-view-context';
import { DataTable } from '@cucumber/cucumber';

// planning-preventive-maintenance.feature. The plain-voice actions — adding to a plan, changing an
// interval, deactivating an item (issue #91: nothing is removed from a plan any more), retiring
// equipment — drive `/pm-plans` and `/equipment`; the «تلاش …» attempts (403, the usage-based 400,
// and the refusals on a deactivated row) go through the API, as do every precondition and every
// fact (read by the system admin: the plan from `GET equipment/:id` — `planItems` active,
// `inactivePlanItems` deactivated — the history from `GET equipment/:id/maintenance-history`, the
// daily list of a named day from `GET pm-schedule/daily` with the clock moved to that day). The one
// exception is the inactive list right after an action through the folder: it is read off the
// folder's «فعالیت‌های غیرفعال» sheet (`common/pm-plan-folder-context.ts`). The «اینکه فعالیت … و
// اولین موعد …» precondition lives in ./common.steps.ts.

/** «… در فعالیت های غیرفعال تجهیز …»: off the open folder, or over the API. */
const ensureAmongInactivePlanItems = (
  equipmentName: string,
  expected: ListRow,
) =>
  lastPmPlanFolderView() === 'folder-page'
    ? actorInTheSpotlight().attemptsTo(
        EnsureActivityIsAmongInactivePlanItems.onThePage(
          equipmentName,
          expected,
        ),
      )
    : asTheSystemAdmin(
        EnsureActivityIsAmongInactivePlanItems.viaApi(equipmentName, expected),
      );

Given(
  'اینکه تجهیزهای {string} و {string} در سیستم ثبت شده باشند',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterEquipmentUnlessRegistered(first),
      RegisterEquipmentUnlessRegistered(second),
    ),
);

Given(
  'فعالیت های {string} و {string} در سیستم ثبت شده باشند',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterMaintenanceActivityUnlessRegistered(first),
      RegisterMaintenanceActivityUnlessRegistered(second),
    ),
);

When(
  '{actor} فعالیت {string} را با دوره {string} روز و اولین موعد {string} به برنامه تجهیز {string} اضافه می کند',
  (
    actor: Actor,
    activityName: string,
    intervalDays: string,
    firstDueDate: string,
    equipmentName: string,
  ) => {
    // The add goes through the folder, which stays open afterwards (re-adding a deactivated
    // activity reads the folder's inactive sheet next).
    lookedAtPmPlanFolder('folder-page');
    return actor.attemptsTo(
      AddActivityToPmPlan.using({
        equipmentName,
        activityName,
        intervalDays,
        firstDueDate,
      }),
    );
  },
);

Then(
  'فعالیت {string} با دوره {string} روز در برنامه تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

Then('اولین موعد آن {string} باشد', (firstDueDate: string) =>
  asTheSystemAdmin(EnsureFirstDueDateOfThatPlanItem(firstDueDate)),
);

// قانون: فقط مدیر فنی و مدیر سیستم مجاز به تعریف و تغییر برنامه تجهیزات هستند
// («پیغام خطای عدم دسترسی نشان داده شود» — step-definitions/common.steps.ts)

When(
  '{actor} تلاش می کند فعالیت {string} را به برنامه تجهیز {string} اضافه کند',
  (actor: Actor, activityName: string, equipmentName: string) =>
    actor.attemptsTo(
      AddActivityToPmPlan.viaApiUsing({
        equipmentName,
        activityName,
        intervalDays: UNSTATED_INTERVAL_DAYS,
        intervalUnit: 'days',
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
);

Then(
  'فعالیت {string} در برنامه تجهیز {string} نباشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(EnsureActivityIsNotInPmPlan(equipmentName, activityName)),
);

When(
  '{actor} تلاش می کند فعالیت {string} را در برنامه تجهیز {string} غیرفعال کند',
  (actor: Actor, activityName: string, equipmentName: string) => {
    lookedAtPmPlanFolder('none');
    return actor.attemptsTo(
      DeactivateActivityInPmPlan.viaApiUsing(equipmentName, activityName),
    );
  },
);

Then(
  'فعالیت {string} همچنان در برنامه فعال تجهیز {string} باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsStillActiveInPmPlan(equipmentName, activityName),
    ),
);

// قانون: دوره و اولین موعد هر فعالیت در برنامه تجهیز الزامی است
//
// «<مورد>» is «دوره» or the two-word «اولین موعد», which a Cucumber-expression alternative cannot
// hold — so these two are regular expressions, and the actor is summoned by name.

const MISSING_FIELD: Record<string, 'interval' | 'firstDueDate'> = {
  دوره: 'interval',
  'اولین موعد': 'firstDueDate',
};

When(
  /^(\S+) فعالیت "([^"]*)" را بدون (دوره|اولین موعد) به برنامه تجهیز "([^"]*)" اضافه می کند$/,
  (
    actorName: string,
    activityName: string,
    missing: string,
    equipmentName: string,
  ) =>
    actorCalled(actorName).attemptsTo(
      AddActivityToPmPlan.using({
        equipmentName,
        activityName,
        ...(MISSING_FIELD[missing] === 'interval'
          ? { firstDueDate: UNSTATED_FIRST_DUE_DATE }
          : { intervalDays: UNSTATED_INTERVAL_DAYS }),
      }),
    ),
);

Then(/^پیغام خطای (دوره|اولین موعد) نشان داده شود$/, (missing: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePlanItemFieldErrorShown(MISSING_FIELD[missing]),
  ),
);

// قانون: یک فعالیت می تواند برای تجهیزات مختلف دوره های متفاوت داشته باشد

const addWithoutAFirstDueDate = (
  actor: Actor,
  activityName: string,
  intervalDays: string,
  equipmentName: string,
) =>
  actor.attemptsTo(
    AddActivityToPmPlan.using({
      equipmentName,
      activityName,
      intervalDays,
      firstDueDate: UNSTATED_FIRST_DUE_DATE,
    }),
  );

When(
  '{actor} فعالیت {string} را با دوره {string} روز به برنامه تجهیز {string} اضافه می کند',
  addWithoutAFirstDueDate,
);

// The same, continuing with «و» and no subject: whoever acted last.
When(
  'فعالیت {string} را با دوره {string} روز به برنامه تجهیز {string} اضافه می کند',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    addWithoutAFirstDueDate(
      actorInTheSpotlight(),
      activityName,
      intervalDays,
      equipmentName,
    ),
);

Then(
  'دوره {string} در برنامه {string} برابر {string} روز باشد',
  (activityName: string, equipmentName: string, intervalDays: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

// قانون: در هر لحظه فقط یک ردیف فعال از هر فعالیت در برنامه یک تجهیز می آید

Given(
  'اینکه فعالیت {string} با دوره {string} روز در برنامه تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      PutActivityInPmPlan({
        equipmentName,
        activityName,
        intervalDays,
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
);

Then(
  'فعالیت {string} فقط یک بار و با دوره {string} روز در برنامه تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

Then('پیغام خطای تکراری بودن فعالیت در برنامه تجهیز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicatePlanItemErrorShown()),
);

Given(
  'فعالیت {string} در برنامه تجهیز {string} غیرفعال شده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    ),
);

Then(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه فعال تجهیز {string} باشد',
  (
    activityName: string,
    intervalDays: string,
    firstDueDate: string,
    equipmentName: string,
  ) =>
    asTheSystemAdmin(
      EnsureActivityIsActiveInPmPlanWith(
        equipmentName,
        activityName,
        intervalDays,
        firstDueDate,
      ),
    ),
);

Then(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} همچنان در فعالیت های غیرفعال تجهیز {string} باشد',
  (
    activityName: string,
    intervalDays: string,
    firstDueDate: string,
    equipmentName: string,
  ) =>
    ensureAmongInactivePlanItems(
      equipmentName,
      inactivePlanItem(activityName, intervalDays, firstDueDate),
    ),
);

const putInThePlanAndDeactivated = (
  activityName: string,
  intervalDays: string,
  firstDueDate: string,
  equipmentName: string,
) =>
  asTheSystemAdmin(
    // The equipment too, when no background registered it — registring-equipment and
    // registring-maintenance-activity state this precondition with nothing before it (issue #94).
    RegisterEquipmentUnlessRegistered(equipmentName),
    PutActivityInPmPlanAndDeactivateIt({
      equipmentName,
      activityName,
      intervalDays,
      firstDueDate,
    }),
  );

Given(
  'اینکه فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیز {string} بوده و غیرفعال شده باشد',
  putInThePlanAndDeactivated,
);

Given(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیز {string} بوده و غیرفعال شده باشد',
  putInThePlanAndDeactivated,
);

// قانون: برنامه فقط بر اساس گذشت روزها تعریف می شود و برنامه بر اساس ساعت کارکرد پذیرفته نمی شود

When(
  '{actor} تلاش می کند فعالیت {string} را با دوره {string} ساعت کارکرد به برنامه تجهیز {string} اضافه کند',
  (
    actor: Actor,
    activityName: string,
    operatingHours: string,
    equipmentName: string,
  ) =>
    actor.attemptsTo(
      AddActivityToPmPlan.viaApiUsing({
        equipmentName,
        activityName,
        intervalDays: operatingHours,
        intervalUnit: 'operating_hours',
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
);

Then('به او گفته شود که برنامه فقط بر اساس روز قابل تعریف است', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldPlansAreDayBasedOnly()),
);

// قانون: موعدها از اولین موعد و با فاصله دوره پشت سر هم می آیند و روز انجام، موعد بعدی را جابجا نمی کند
//
// «… برای موعد «…» در «…» ثبت شده باشد» names the occurrence it expects the recording to land on.
// The backend picks the occurrence, so the due date is not sent; the precondition checks that the
// 201's `dueDate` is the one named. Issue #110 states several tasks at once («تعویض روغن اکسترودر
// 1 و تعویض روغن اکسترودر 2»): each is recorded in turn (`recordedEachAsAPrecondition`).

Given(
  'انجام {maintenanceTask} برای موعد {string} در {string} ثبت شده باشد',
  (maintenanceTask: string, dueDate: string, performedOn: string) =>
    recordedEachAsAPrecondition(maintenanceTask, performedOn, dueDate),
);

Given(
  'انجام {maintenanceTask} در {string} ثبت شده باشد',
  (maintenanceTask: string, performedOn: string) =>
    recordedEachAsAPrecondition(maintenanceTask, performedOn),
);

Then(
  'موعد بعدی {maintenanceTask} {string} باشد',
  (maintenanceTask: string, nextDueDate: string) =>
    asTheSystemAdmin(EnsureNextDueDate(maintenanceTask, nextDueDate)),
);

// قانون: تغییر دوره، موعد بعدی را از آخرین موعد و با دوره جدید حساب می کند

When(
  '{actor} دوره {string} در برنامه تجهیز {string} را به {string} روز تغییر می دهد',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    intervalDays: string,
  ) =>
    actor.attemptsTo(
      ChangePmInterval.using(equipmentName, activityName, intervalDays),
    ),
);

// قانون: تغییر برنامه، سوابق انجام قبلی را تغییر نمی دهد

Given(
  '{actorName} انجام {maintenanceTask} را در {string} ساعت {string} ثبت کرده باشد',
  (personaName: string, maintenanceTask: string, date: string, time: string) =>
    recordedByAsAPrecondition(personaName, maintenanceTask, date, time),
);

// Every entry — recordings and, since issue #114, missed occurrences — compared regardless of order
// on the columns the table names; for the range the actor last looked at the history for, if any
// (recording-maintenance-execution's «… سابقه تعمیرات … را با بازه … مشاهده می کند»,
// `common/maintenance-history-view-context.ts`), the whole history otherwise.
Then(
  'سابقه تعمیرات {equipmentName} به صورت زیر باشد',
  (equipmentName: string, table: DataTable) =>
    asTheSystemAdmin(
      EnsureMaintenanceHistoryIs(
        equipmentName,
        table.hashes(),
        theMaintenanceHistoryRangeLookedAt(),
      ),
    ),
);

// قانون: فعالیتی که از برنامه غیرفعال شده یا تجهیزی که کنار گذاشته شده، دیگر در برنامه روزانه نمی آید ولی سوابقش باقی می ماند
//
// The deactivation goes through the folder, which then stays open — so a following «فعالیت های
// غیرفعال …» reads its «فعالیت‌های غیرفعال» sheet (`common/pm-plan-folder-context.ts`).

When(
  '{actor} فعالیت {string} را در برنامه تجهیز {string} غیرفعال می کند',
  (actor: Actor, activityName: string, equipmentName: string) => {
    lookedAtPmPlanFolder('folder-page');
    return actor.attemptsTo(
      DeactivateActivityInPmPlan.using(equipmentName, activityName),
    );
  },
);

When('{actor} تجهیز {string} را کنار می گذارد', (actor: Actor, name: string) =>
  actor.attemptsTo(RetireEquipment.using(name)),
);

// «تعویض روغن اکسترودر 1 در برنامه روزانه «…» نباشد» and «هیچ کاری از اکسترودر 1 در برنامه روزانه
// «…» نباشد» are one Cucumber expression — the unquoted `{maintenanceTask}` matches «هیچ کاری از
// اکسترودر 1» as well — so this one definition tells them apart by that opening.
const NOTHING_OF = 'هیچ کاری از ';

Then(
  '{maintenanceTask} در برنامه روزانه {string} نباشد',
  (subject: string, date: string) =>
    asTheSystemAdminOn(
      date,
      subject.startsWith(NOTHING_OF)
        ? EnsureNothingOfEquipmentInDailyPmScheduleViaApi(
            subject.slice(NOTHING_OF.length),
          )
        : EnsureNotInDailyPmScheduleViaApi(subject),
    ),
);

// recording-maintenance-execution's issue #110 «سابقه انجام ردیف غیرفعال تعویض روغن اکسترودر 1 در
// «…» همچنان …» is this same expression — the unquoted `{maintenanceTask}` takes «ردیف غیرفعال …»
// too — so the definition tells it apart by that opening: a recording against a deactivated row.
const OF_AN_INACTIVE_ROW = 'ردیف غیرفعال ';

Then(
  'سابقه انجام {maintenanceTask} در {string} همچنان در سابقه تعمیرات {equipmentName} باشد',
  (subject: string, performedOn: string, _equipmentName: string) =>
    asTheSystemAdmin(
      subject.startsWith(OF_AN_INACTIVE_ROW)
        ? EnsureAnExecutionOfAnInactivePlanItemIsStillInHistory(
            subject.slice(OF_AN_INACTIVE_ROW.length),
            performedOn,
          )
        : EnsureExecutionIsStillInHistory(subject, performedOn),
    ),
);

Then(
  '{maintenanceTask} در برنامه روزانه {string} باشد',
  (maintenanceTask: string, date: string) =>
    asTheSystemAdminOn(date, EnsureInDailyPmScheduleViaApi(maintenanceTask)),
);

// قانون: فعالیت های غیرفعال هر تجهیز با زمان غیرفعال شدنشان دیده می شوند
// («اکنون «…» ساعت «…» باشد» — step-definitions/common.steps.ts)

Then(
  'فقط فعالیت {string} در برنامه فعال تجهیز {string} باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureOnlyActivityActiveInPmPlan(equipmentName, activityName),
    ),
);

Then(
  'فعالیت های غیرفعال تجهیز {string} به صورت زیر باشد',
  (equipmentName: string, table: DataTable) =>
    lastPmPlanFolderView() === 'folder-page'
      ? actorInTheSpotlight().attemptsTo(
          EnsureInactivePlanItemsAre.onThePage(equipmentName, table.hashes()),
        )
      : asTheSystemAdmin(
          EnsureInactivePlanItemsAre.viaApi(equipmentName, table.hashes()),
        ),
);

Then(
  'هیچ فعالیت فعالی در برنامه تجهیز {string} نباشد',
  (equipmentName: string) =>
    asTheSystemAdmin(EnsureNoActivityIsActiveInPmPlan(equipmentName)),
);

// قانون: فعالیت غیرفعال شده یک سابقه است و دیگر تغییر نمی کند و دوباره فعال نمی شود
//
// The «تلاش …» attempts go through the API — the deactivated row offers no action on the page —
// and say nothing about the response; their `Then`s read the plan.

When(
  '{actor} تلاش می کند فعالیت غیرفعال شده {string} تجهیز {string} را دوباره فعال کند',
  (actor: Actor, activityName: string, equipmentName: string) => {
    lookedAtPmPlanFolder('none');
    return actor.attemptsTo(
      ReactivateActivityInPmPlan.viaApiUsing(equipmentName, activityName),
    );
  },
);

Then(
  'فعالیت {string} همچنان در فعالیت های غیرفعال تجهیز {string} باشد',
  (activityName: string, equipmentName: string) =>
    ensureAmongInactivePlanItems(equipmentName, inactivePlanItem(activityName)),
);

When(
  '{actor} تلاش می کند دوره فعالیت غیرفعال شده {string} تجهیز {string} را به {string} روز تغییر دهد',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    intervalDays: string,
  ) => {
    lookedAtPmPlanFolder('none');
    return actor.attemptsTo(
      ChangePmInterval.viaApiUsing(equipmentName, activityName, intervalDays),
    );
  },
);

Then(
  'فعالیت {string} با دوره {string} روز در فعالیت های غیرفعال تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    ensureAmongInactivePlanItems(
      equipmentName,
      inactivePlanItem(activityName, intervalDays),
    ),
);

// «مسلمی تلاش می کند انجام … را ثبت کند» — ./recording-maintenance-execution.steps.ts.

Then(
  'هیچ انجامی از {maintenanceTask} در {string} در سابقه تعمیرات {equipmentName} نباشد',
  (maintenanceTask: string, performedOn: string, _equipmentName: string) =>
    asTheSystemAdmin(
      EnsureNoExecutionInHistoryOn(maintenanceTask, performedOn),
    ),
);

// قانون: مدیر سیستم ردیف غیرفعال برنامه یک تجهیز را همراه همه سوابق انجامش برای همیشه حذف می کند
// (issue #110)
//
// The plain deletion drives the folder's «فعالیت‌های غیرفعال» sheet (the row's «حذف ردیف», then the
// confirmation), and the folder stays open — so «فعالیت های غیرفعال … به صورت زیر باشد» reads that
// sheet next (`common/pm-plan-folder-context.ts`). The «تلاش …» on an active row is
// `DELETE …/pm-plan-items/:itemId` (409 `pm-plan-item-active`); its `Then` reads the plan.

const putInThePlanRecordedAndDeactivated = async (
  activityName: string,
  intervalDays: string,
  firstDueDate: string,
  equipmentName: string,
  performedOn: string,
) => {
  await asTheSystemAdmin(
    RegisterEquipmentUnlessRegistered(equipmentName),
    PutActivityInPmPlan({
      equipmentName,
      activityName,
      intervalDays,
      firstDueDate,
    }),
  );
  await recordedEachAsAPrecondition(
    `${activityName} ${equipmentName}`,
    performedOn,
  );
  await asTheSystemAdmin(
    DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    // So a second such row is deactivated strictly later — the inactive list's order.
    LetTimePass(60_000),
  );
};

Given(
  'اینکه فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیز {string} بوده که انجامش در {string} ثبت شده و غیرفعال شده باشد',
  putInThePlanRecordedAndDeactivated,
);

Given(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیز {string} بوده که انجامش در {string} ثبت شده و غیرفعال شده باشد',
  putInThePlanRecordedAndDeactivated,
);

When(
  '{actor} ردیف غیرفعال {int} روزه {string} را از برنامه تجهیز {string} حذف می کند',
  (
    actor: Actor,
    intervalDays: number,
    activityName: string,
    equipmentName: string,
  ) => {
    lookedAtPmPlanFolder('folder-page');
    return actor.attemptsTo(
      DeletePlanItem.using(equipmentName, activityName, String(intervalDays)),
    );
  },
);

Then(
  'سابقه انجام {maintenanceTask} در {string} در سابقه تعمیرات {equipmentName} نباشد',
  (maintenanceTask: string, performedOn: string, _equipmentName: string) =>
    asTheSystemAdmin(
      EnsureNoExecutionInHistoryOn(maintenanceTask, performedOn),
    ),
);

Then(
  'فعالیت {string} با دوره {string} روز همچنان در برنامه فعال تجهیزهای {string} و {string} باشد',
  (activityName: string, intervalDays: string, first: string, second: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(first, activityName, intervalDays),
      EnsureActivityIsInPmPlanWithInterval(second, activityName, intervalDays),
    ),
);

Then('فعالیت {string} همچنان در سیستم ثبت شده باشد', (activityName: string) =>
  asTheSystemAdmin(EnsureMaintenanceActivityIsRegistered(activityName)),
);

When(
  '{actor} تلاش می کند ردیف {string} را از برنامه تجهیز {string} حذف کند',
  (actor: Actor, activityName: string, equipmentName: string) => {
    lookedAtPmPlanFolder('none');
    return actor.attemptsTo(
      DeletePlanItem.viaApiUsing(equipmentName, activityName),
    );
  },
);

// قانون: مدیر سیستم تجهیز کنار گذاشته شده را همراه همه برنامه ها و سوابقش برای همیشه حذف می کند
// (issue #110)
//
// The plain deletion drives `/equipment` (the retired row's menu, «حذف تجهیز», the confirmation);
// the «تلاش …» on active equipment is `DELETE equipment/:id` (409 `equipment-not-retired`). The
// facts are read over the API — a deleted equipment by name, since its id is gone.

When('{actor} تجهیز {string} را حذف می کند', (actor: Actor, name: string) =>
  actor.attemptsTo(DeleteEquipment.using(name)),
);

Then('تجهیز {string} در سیستم ثبت نشده باشد', (name: string) =>
  asTheSystemAdmin(EnsureNoEquipmentIsNamed(name)),
);

Then(
  'هیچ موعد یا سابقه ای از {equipmentName} در برنامه کلی تعمیرات و نگهداری نباشد',
  (equipmentName: string) =>
    asTheSystemAdmin(EnsureNothingOfTheEquipmentInTheOverview(equipmentName)),
);

When(
  '{actor} تلاش می کند تجهیز {string} را حذف کند',
  (actor: Actor, name: string) =>
    actor.attemptsTo(DeleteEquipment.viaApiUsing(name)),
);

// Read by the maintenance observer — رضازاده when یاشار just tried, so a following «پیغام خطای …»
// would still find his response.
Then('تجهیز {string} همچنان در سیستم ثبت شده باشد', (name: string) =>
  asAMaintenanceObserver(EnsureEquipmentIsRegistered(name)),
);

// قانون: تجهیز کنار گذاشته شده دوباره فعال می شود و موعدهای دوره کنار گذاشته شدن از تعهد PM خارج اند
// (issue #110)
//
// The plain reactivations drive `/equipment`: the retired row's menu, «فعال سازی دوباره», a choice
// per active row («ادامه برنامه قبلی» / «تعیین اولین موعد تازه» and the date), submit. How each row
// resumes is stated after «را با …», one clause or several joined by «و» — which no Cucumber
// expression can take apart (an unquoted activity would swallow the «و …» after it), so these are
// regular expressions over that clause (`equipment-lifecycle.ts#reactivationChoicesIn`). The
// «تلاش …» attempts are `POST equipment/:id/reactivation` (400 / 403). Facts are read over the
// API; «موعد بعدی …», «وضعیت … برای موعد …» and «سابقه انجام … همچنان …» are above or in
// ./common.steps.ts.

When(
  /^(\S+) تجهیز "([^"]*)" را با (.+) دوباره فعال می کند$/,
  (actorName: string, equipmentName: string, choices: string) =>
    actorCalled(actorName).attemptsTo(
      ReactivateEquipment.using(equipmentName, reactivationChoicesIn(choices)),
    ),
);

When(
  /^(\S+) تلاش می کند تجهیز "([^"]*)" را با (.+) دوباره فعال کند$/,
  (actorName: string, equipmentName: string, choices: string) =>
    actorCalled(actorName).attemptsTo(
      ReactivateEquipment.viaApiUsing(
        equipmentName,
        reactivationChoicesIn(choices).rescheduled,
      ),
    ),
);

Then('تجهیز {string} در تجهیزات فعال باشد', (name: string) =>
  asTheSystemAdmin(EnsureEquipmentIsRetired(name, false)),
);

Then(
  'موعد {string} {maintenanceTask} جزو تعهد PM نباشد',
  (dueDate: string, maintenanceTask: string) =>
    asTheSystemAdmin(
      EnsureTheDueDateIsNotACommitment(maintenanceTask, dueDate),
    ),
);

Then(
  'موعدهای بعدی {maintenanceTask} {string} و {string} باشند',
  (maintenanceTask: string, first: string, second: string) =>
    asTheSystemAdmin(EnsureTheNextDueDatesAre(maintenanceTask, first, second)),
);

Then(
  'به او گفته شود که اولین موعد تازه نمی تواند پیش از روز فعال سازی باشد',
  () =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldANewFirstDueDateCannotPrecedeTheReactivation(),
    ),
);

// قانون: فقط مدیر سیستم ردیف غیرفعال یا تجهیز کنار گذاشته شده را حذف می کند و تجهیز کنار گذاشته شده را دوباره فعال می کند
// (issue #110 — «پیغام خطای عدم دسترسی نشان داده شود» is step-definitions/common.steps.ts; «تلاش …
// تجهیز … را حذف کند» and «… همچنان …» are above)

When(
  '{actor} تلاش می کند ردیف غیرفعال {string} را از برنامه تجهیز {string} حذف کند',
  (actor: Actor, activityName: string, equipmentName: string) => {
    lookedAtPmPlanFolder('none');
    return actor.attemptsTo(
      DeletePlanItem.viaApiUsing(equipmentName, activityName),
    );
  },
);

When(
  '{actor} تلاش می کند تجهیز {string} را دوباره فعال کند',
  (actor: Actor, name: string) =>
    actor.attemptsTo(ReactivateEquipment.viaApiUsing(name)),
);

import { Before, Given, Then } from '@cucumber/cucumber';
import { actorInTheSpotlight } from '@serenity-js/core';
import {
  asTheSystemAdmin,
  forgetMaintenanceRecords,
  letItBeToday,
} from '../../screenplay/maintenance-management/maintenance-records';
import { RegisterEquipmentUnlessRegistered } from '../../screenplay/maintenance-management/equipment';
import { PutActivityInPmPlan } from '../../screenplay/maintenance-management/pm-plan';
import { EnsureOccurrenceStatus } from '../../screenplay/maintenance-management/pm-schedule';
import {
  lastPmScheduleLookedAt,
  lookedAtPmSchedule,
} from '../../screenplay/common/pm-schedule-view-context';

// Steps more than one maintenance-management feature states. Each feature's own steps live in its
// own file; «اکنون «…» ساعت «…» باشد» (and its «اینکه» form) in step-definitions/common.steps.ts.

Before(() => {
  forgetMaintenanceRecords();
  lookedAtPmSchedule('none');
});

// «امروز» is the Tehran calendar date of the system's clock. Opening a `Given` («اینکه …»,
// recording-maintenance-execution) or continuing one («و …», daily-pm-schedule and
// planning-preventive-maintenance).
Given('اینکه امروز {string} باشد', letItBeToday);
Given('امروز {string} باشد', letItBeToday);

// daily-pm-schedule's and recording-maintenance-execution's background.
Given('اینکه تجهیز {string} در سیستم ثبت شده باشد', (name: string) =>
  asTheSystemAdmin(RegisterEquipmentUnlessRegistered(name)),
);

// The plan item every scheduling feature starts from: planning-preventive-maintenance and
// daily-pm-schedule open a `Given` with it, recording-maintenance-execution's background continues
// one. Registers the activity if no background did.
const activityIsInThePlan = (
  activityName: string,
  intervalDays: string,
  firstDueDate: string,
  equipmentName: string,
) =>
  asTheSystemAdmin(
    PutActivityInPmPlan({
      equipmentName,
      activityName,
      intervalDays,
      firstDueDate,
    }),
  );

Given(
  'اینکه فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیز {string} باشد',
  activityIsInThePlan,
);

Given(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیز {string} باشد',
  activityIsInThePlan,
);

// «وضعیت تعویض روغن اکسترودر 1 برای موعد «…» «…» باشد» — after the daily list (daily-pm-schedule),
// read from the overview over the API; after the overview page (recording-maintenance-execution),
// off that page. `pm-schedule-view-context.ts`, set by both «… را مشاهده می کند» steps.
Then(
  'وضعیت {maintenanceTask} برای موعد {string} {string} باشد',
  (maintenanceTask: string, dueDate: string, status: string) =>
    lastPmScheduleLookedAt() === 'overview-page'
      ? actorInTheSpotlight().attemptsTo(
          EnsureOccurrenceStatus.onThePage(maintenanceTask, dueDate, status),
        )
      : asTheSystemAdmin(
          EnsureOccurrenceStatus.viaApi(maintenanceTask, dueDate, status),
        ),
);

/**
 * Which maintenance list the actor last looked at in this scenario — the one fact that tells
 * «وضعیت … برای موعد …» readings apart. «وضعیت تعویض روغن اکسترودر 1 برای موعد «…» «انجام
 * نشده» باشد» is byte-identical in daily-pm-schedule.feature, right after the actor looked at the
 * **daily** list (which never shows a missed occurrence, so the fact is read from the overview over
 * the API), and in recording-maintenance-execution.feature, right after they looked at the
 * **overview** page (so it is read off that page, as the visitor sees it).
 *
 * Set explicitly by both «… را مشاهده می کند» steps
 * (`step-definitions/maintenance-management/common.steps.ts`), and reset before every scenario
 * there, so no scenario inherits another's.
 */
export type PmScheduleView = 'none' | 'daily-list' | 'overview-page';

let current: PmScheduleView = 'none';

export const lookedAtPmSchedule = (view: PmScheduleView): void => {
  current = view;
};

export const lastPmScheduleLookedAt = (): PmScheduleView => current;

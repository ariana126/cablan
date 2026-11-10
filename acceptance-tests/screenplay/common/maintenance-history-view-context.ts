/**
 * The date range the actor last looked at an equipment's maintenance history for, in this
 * scenario (issue #114) — the one fact that tells the readings of «سابقه تعمیرات … به صورت زیر
 * باشد / خالی باشد» and their siblings apart. After «… سابقه تعمیرات … را با بازه «…» تا «…»
 * مشاهده می کند» they are facts about the history **of that range**; after the plain «… را مشاهده
 * می کند», or when nobody looked at all (every scenario written before issue #114), about the whole
 * history.
 *
 * Set explicitly by both «… مشاهده می کند» steps
 * (`step-definitions/maintenance-management/recording-maintenance-execution.steps.ts`), and reset
 * before every scenario (`step-definitions/maintenance-management/common.steps.ts`), so no scenario
 * inherits another's.
 */

/** Both bounds inclusive, Jalali `YYYY/MM/DD` as the Gherkin writes them. */
export interface MaintenanceHistoryRange {
  from: string;
  to: string;
}

let current: MaintenanceHistoryRange | undefined;

/** `undefined` — the whole history. */
export const lookedAtTheMaintenanceHistoryFor = (
  range: MaintenanceHistoryRange | undefined,
): void => {
  current = range;
};

export const theMaintenanceHistoryRangeLookedAt = ():
  MaintenanceHistoryRange | undefined => current;

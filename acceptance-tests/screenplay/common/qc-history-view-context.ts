import type { QcExecutionFilters } from '../quality-control/qc-api';

/**
 * The filters the actor last looked at the plant-wide QC records with, in this scenario (issue
 * #119) — the one fact that tells the readings of «فاصله سوابق …», «فاصله انجام … از انجام قبلی …»
 * and «تعداد انجام فعالیت ها …» apart. After «… سوابق فعالیت های QC را با بازه «…» تا «…» (و شماره
 * ردیابی «…») مشاهده می کند» they are facts about the records **those filters** select; after the
 * plain «… را مشاهده می کند», or when nobody looked (a deletion's scenario), about every record.
 *
 * Set explicitly by every «… مشاهده می کند» step (`step-definitions/quality-control/
 * qc-execution-history.steps.ts`) and reset before every scenario
 * (`step-definitions/quality-control/common.steps.ts`), so no scenario inherits another's.
 */

let current: QcExecutionFilters = {};

export const lookedAtTheQcRecordsWith = (filters: QcExecutionFilters): void => {
  current = filters;
};

export const theQcRecordFiltersLookedAt = (): QcExecutionFilters => current;

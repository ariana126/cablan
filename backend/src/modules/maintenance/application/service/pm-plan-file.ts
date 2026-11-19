import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { PmPlanImportCheck } from '@maintenance/domain/service/pm-plan-import-check';

import { PmPlanImportFileUnreadable } from '../exceptions/pm-plan-import-file-unreadable.exception';
import { PmPlanImportPreview } from './pm-plan-import-result';
import {
  PmPlanWorkbookReader,
  PmPlanWorkbookSheet,
} from './pm-plan-workbook-reader';

const PM_SHEET_NAME = 'pm';

/** A PM plan file's sheet, checked against the current state. */
export interface CheckedPmPlanSheet {
  readonly check: PmPlanImportCheck;
  readonly preview: PmPlanImportPreview;
}

/**
 * The PM plan sheet of an uploaded workbook (issue #127): the one named `pm`
 * (trimmed, any case), else the first. Throws `PmPlanImportFileUnreadable`
 * for a file that is not a readable `.xlsx` or holds no sheet.
 */
export async function pmPlanSheetOf(
  file: Buffer,
  reader: PmPlanWorkbookReader,
): Promise<PmPlanWorkbookSheet> {
  const sheets = await reader.sheetsOf(file);
  if (sheets.length === 0) {
    throw PmPlanImportFileUnreadable.withoutSheets();
  }
  return (
    sheets.find((sheet) => sheet.name.trim().toLowerCase() === PM_SHEET_NAME) ??
    sheets[0]
  );
}

/**
 * The sheet checked against every piece of equipment, the whole activity
 * catalog and their plans as they stand now — each loaded once.
 */
export async function checkPmPlanSheet(
  sheet: PmPlanWorkbookSheet,
  equipmentRepository: EquipmentRepository,
  activityRepository: MaintenanceActivityRepository,
): Promise<CheckedPmPlanSheet> {
  const equipment = await equipmentRepository.list();
  const activities = await activityRepository.list();
  const check = PmPlanImportCheck.of(sheet.cells, equipment, activities);
  return { check, preview: PmPlanImportPreview.of(sheet.name, check) };
}

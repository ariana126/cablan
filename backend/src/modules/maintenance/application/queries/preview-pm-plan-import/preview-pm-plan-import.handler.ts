import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { checkPmPlanSheet, pmPlanSheetOf } from '../../service/pm-plan-file';
import { PmPlanImportPreview } from '../../service/pm-plan-import-result';
import { PmPlanWorkbookReader } from '../../service/pm-plan-workbook-reader';
import { PreviewPmPlanImportQuery } from './preview-pm-plan-import.query';

/**
 * Checks an uploaded PM plan file against the current state and describes
 * what confirming it would add, already finds in force, or finds differing
 * (issue #127). Nothing is stored; the confirmation re-sends the file.
 */
@QueryHandler(PreviewPmPlanImportQuery)
export class PreviewPmPlanImportHandler implements IQueryHandler<
  PreviewPmPlanImportQuery,
  PmPlanImportPreview
> {
  constructor(
    private readonly reader: PmPlanWorkbookReader,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(query: PreviewPmPlanImportQuery): Promise<PmPlanImportPreview> {
    const sheet = await pmPlanSheetOf(query.file, this.reader);
    const { preview } = await checkPmPlanSheet(
      sheet,
      this.equipmentRepository,
      this.activityRepository,
    );
    return preview;
  }
}

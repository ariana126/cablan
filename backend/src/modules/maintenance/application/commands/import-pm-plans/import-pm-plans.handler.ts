import { UnitOfWork } from '@framework/application';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { PmPlanImportCheck } from '@maintenance/domain/service/pm-plan-import-check';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PmPlanImportHasErrors } from '../../exceptions/pm-plan-import-has-errors.exception';
import { pmPlanSheetOf } from '../../service/pm-plan-file';
import { PM_PLAN_IMPORT_LOCK } from '../../service/pm-plan-import-lock';
import { PmPlanImportPreview } from '../../service/pm-plan-import-result';
import { PmPlanWorkbookReader } from '../../service/pm-plan-workbook-reader';
import { PM_SNAPSHOT_NAMES_LOCK } from '../../service/pm-snapshot-names-lock';
import { ImportPmPlansCommand } from './import-pm-plans.command';

/**
 * Confirms a PM plan import (issue #127): all of its new items or none.
 *
 * It holds `PM_PLAN_IMPORT_LOCK`, then `PM_SNAPSHOT_NAMES_LOCK` — each new
 * item snapshots its activity's name, so no name correction may run
 * meanwhile (nothing takes the two the other way round). The file is checked
 * against the plans as they stand; any error refuses the whole file. Then
 * every piece of equipment holding a valid `+` is locked and loaded fresh
 * (`EquipmentRepository.loadLocked`) and the file checked again against
 * those, so a retirement, deactivation, interval change or new item another
 * request committed since the first read is seen, never saved over. Every
 * item to create is added through `Equipment.addPlanItem` — the same events,
 * so the same audit entries, as adding each by hand — and each piece of
 * equipment changed is saved once, all in one unit of work. Items already in
 * force and those differing from an active item are left as they are.
 */
@CommandHandler(ImportPmPlansCommand)
export class ImportPmPlansHandler implements ICommandHandler<
  ImportPmPlansCommand,
  PmPlanImportPreview
> {
  constructor(
    private readonly reader: PmPlanWorkbookReader,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ImportPmPlansCommand): Promise<PmPlanImportPreview> {
    const sheet = await pmPlanSheetOf(command.file, this.reader);
    return this.unitOfWork.runExclusively(PM_PLAN_IMPORT_LOCK, () =>
      this.unitOfWork.runExclusively(PM_SNAPSHOT_NAMES_LOCK, async () => {
        const equipment = await this.equipmentRepository.list();
        const activities = await this.activityRepository.list();
        const firstCheck = PmPlanImportCheck.of(
          sheet.cells,
          equipment,
          activities,
        );
        refuseErrorsOf(firstCheck, sheet.name);

        const marked = equipmentMarkedIn(firstCheck);
        const locked = await this.equipmentRepository.loadLocked(
          marked.map((item) => item.id),
        );
        const markedIds = new Set(marked.map((item) => item.id.asString()));
        const check = PmPlanImportCheck.of(
          sheet.cells,
          [
            ...equipment.filter((item) => !markedIds.has(item.id.asString())),
            ...locked,
          ],
          activities,
        );
        refuseErrorsOf(check, sheet.name);

        const changed = new Set<Equipment>();
        for (const item of check.toCreate) {
          item.equipment.addPlanItem(
            item.activity,
            item.intervalDays,
            item.firstDueDate,
          );
          changed.add(item.equipment);
        }
        for (const each of changed) {
          await this.equipmentRepository.save(each);
        }
        return PmPlanImportPreview.of(sheet.name, check);
      }),
    );
  }
}

function refuseErrorsOf(check: PmPlanImportCheck, sheetName: string): void {
  if (check.hasErrors()) {
    throw PmPlanImportHasErrors.withErrors([
      ...PmPlanImportPreview.of(sheetName, check).errors,
    ]);
  }
}

/** The equipment of every valid `+` — each piece once, in file order. */
function equipmentMarkedIn(check: PmPlanImportCheck): Equipment[] {
  const items = [
    ...check.toCreate,
    ...check.alreadyExisting,
    ...check.conflicts,
  ];
  return [...new Set(items.map((item) => item.equipment))];
}

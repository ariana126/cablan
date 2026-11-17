import { UnitOfWork } from '@framework/application';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteEquipmentCommand } from './delete-equipment.command';

/**
 * Issue #110's one cascade: retired equipment, every row of its plan and
 * every execution of them go together, in one unit of work. Its
 * `EquipmentDeleted` is the only record of the PM side; the executions
 * record nothing of their own.
 *
 * Issue #119 adds production QC: its QC assignments go with it (they are
 * the equipment's), and so does every QC record made on it, each recording
 * its `QcExecutionDeleted` under the activity's current name.
 */
@CommandHandler(DeleteEquipmentCommand)
export class DeleteEquipmentHandler implements ICommandHandler<DeleteEquipmentCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly qcActivityRepository: QcActivityRepository,
    private readonly qcExecutionRepository: QcExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeleteEquipmentCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      equipment.delete();
      // By equipment, so an execution recorded meanwhile on a row this load
      // did not see goes too.
      await this.executionRepository.deleteOfEquipment(equipment.id);
      const records = await this.qcExecutionRepository.ofEquipment(
        equipment.id,
      );
      const activityNames = await this.qcActivityNames();
      for (const record of records) {
        record.delete({
          equipmentName: equipment.name().asString(),
          activityName: nameOf(activityNames, record.activityId().asString()),
        });
        await this.qcExecutionRepository.delete(record);
      }
      await this.equipmentRepository.delete(equipment);
    });
  }

  /** Every QC activity's current name by id, read once for all the records. */
  private async qcActivityNames(): Promise<Map<string, string>> {
    const activities = await this.qcActivityRepository.list();
    return new Map(
      activities.map((activity) => [
        activity.id.asString(),
        activity.name().asString(),
      ]),
    );
  }
}

/** A recorded activity's name; the foreign key keeps a recorded activity from going. */
function nameOf(namesById: ReadonlyMap<string, string>, id: string): string {
  const name = namesById.get(id);
  if (name === undefined) {
    throw new Error(`QC activity ${id} is recorded but does not exist`);
  }
  return name;
}

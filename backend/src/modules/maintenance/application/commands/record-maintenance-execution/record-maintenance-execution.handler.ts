import { UnitOfWork } from '@framework/application';
import { Clock, DisplayNameProvider } from '@framework/domain';
import { PM_SNAPSHOT_NAMES_LOCK } from '@maintenance/application/service/pm-snapshot-names-lock';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RecordMaintenanceExecutionCommand } from './record-maintenance-execution.command';

@CommandHandler(RecordMaintenanceExecutionCommand)
export class RecordMaintenanceExecutionHandler implements ICommandHandler<
  RecordMaintenanceExecutionCommand,
  { id: string; dueDate: string }
> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly clock: Clock,
    private readonly displayNameProvider: DisplayNameProvider,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    command: RecordMaintenanceExecutionCommand,
  ): Promise<{ id: string; dueDate: string }> {
    // The names snapshotted below are read under the lock a name correction
    // holds while it rewrites the history's snapshots (issue #110).
    return this.unitOfWork.runExclusively(PM_SNAPSHOT_NAMES_LOCK, async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      const item = equipment.activePlanItem(command.planItemId);
      const activity = await this.activityRepository.get(item.activityId());
      const executions = await this.executionRepository.forPlanItem(item.id);
      const performerName = await this.displayNameProvider.getName(
        command.performedById,
      );

      const execution = equipment.recordExecutionOf(
        item.id,
        activity.name(),
        executions,
        this.clock.now(),
        { id: command.performedById, name: performerName },
        {
          notes: command.notes ?? null,
          operatingHours: command.operatingHours,
        },
      );
      await this.executionRepository.save(execution);

      return {
        id: execution.id.asString(),
        dueDate: execution.dueDate().asString(),
      };
    });
  }
}

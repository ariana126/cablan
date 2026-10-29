import { Clock, DisplayNameProvider } from '@framework/domain';
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
  ) {}

  async execute(
    command: RecordMaintenanceExecutionCommand,
  ): Promise<{ id: string; dueDate: string }> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    const item = equipment.activePlanItem(command.planItemId);
    const activity = await this.activityRepository.get(item.activityId());
    const executions = await this.executionRepository.forPlanItem(item.id);
    const performerName = await this.displayNameProvider.getName(
      command.performedById,
    );

    const execution = equipment.recordExecutionOf(
      item.id,
      activity,
      executions,
      this.clock.now(),
      { id: command.performedById, name: performerName },
      command.notes ?? null,
    );
    await this.executionRepository.save(execution);

    return {
      id: execution.id.asString(),
      dueDate: execution.dueDate().asString(),
    };
  }
}

import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AddPmPlanItemCommand } from './add-pm-plan-item.command';

@CommandHandler(AddPmPlanItemCommand)
export class AddPmPlanItemHandler implements ICommandHandler<
  AddPmPlanItemCommand,
  { id: string }
> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(command: AddPmPlanItemCommand): Promise<{ id: string }> {
    const intervalDays = IntervalDays.fromInterval(
      command.intervalValue,
      command.intervalUnit,
    );
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    const activity = await this.activityRepository.get(command.activityId);

    const item = equipment.addPlanItem(
      activity,
      intervalDays,
      command.firstDueDate,
    );
    await this.equipmentRepository.save(equipment);

    return { id: item.id.asString() };
  }
}

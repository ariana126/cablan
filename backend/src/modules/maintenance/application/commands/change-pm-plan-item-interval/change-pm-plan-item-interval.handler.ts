import { Clock } from '@framework/domain';
import { PmOccurrences } from '@maintenance/domain/pm-occurrences';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ChangePmPlanItemIntervalCommand } from './change-pm-plan-item-interval.command';

@CommandHandler(ChangePmPlanItemIntervalCommand)
export class ChangePmPlanItemIntervalHandler implements ICommandHandler<ChangePmPlanItemIntervalCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ChangePmPlanItemIntervalCommand): Promise<void> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    const item = equipment.activePlanItem(command.planItemId);
    const executions = await this.executionRepository.forPlanItem(item.id);

    const effectiveFrom = new PmOccurrences(
      item.schedule(),
      executions,
    ).intervalChangeStart(CalendarDate.inTehranOf(this.clock.now()));

    equipment.changePlanItemInterval(
      item.id,
      IntervalDays.of(command.intervalDays),
      effectiveFrom,
    );
    await this.equipmentRepository.save(equipment);
  }
}

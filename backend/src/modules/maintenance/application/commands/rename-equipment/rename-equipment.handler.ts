import { RecordDependencies, UnitOfWork } from '@framework/application';
import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { PM_SNAPSHOT_NAMES_LOCK } from '@maintenance/application/service/pm-snapshot-names-lock';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RenameEquipmentCommand } from './rename-equipment.command';

@CommandHandler(RenameEquipmentCommand)
export class RenameEquipmentHandler implements ICommandHandler<RenameEquipmentCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RenameEquipmentCommand): Promise<void> {
    // Under the lock execution recording holds, so no execution recorded
    // meanwhile keeps the old name a correction rewrites (issue #110).
    await this.unitOfWork.runExclusively(PM_SNAPSHOT_NAMES_LOCK, async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      const correcting = command.applyToRelatedRecords.isGranted();
      // A record another record references can be neither edited nor
      // deleted (issue #94) — unless it is the System Admin's correction of
      // its name (issue #110), carried into the history.
      await this.recordDependencies.editRecordInUse(
        { type: 'Equipment', id: equipment.id.asString() },
        {
          applyToRelatedRecords: command.applyToRelatedRecords,
          changesOnlyCorrectableFields:
            equipment.changesOnlyCorrectableFields(),
          before: { name: equipment.name().asString() },
          after: { name: command.name.asString() },
        },
        async () => {
          const namesake = await this.equipmentRepository.findByName(
            command.name,
          );
          if (namesake && !namesake.id.equals(equipment.id)) {
            throw EquipmentNameTaken.withName(command.name);
          }
          // A correction skips `equipment-retired`, leaving it retired.
          if (correcting) {
            equipment.correctName(command.name);
          } else {
            equipment.rename(command.name);
          }
          await this.equipmentRepository.save(equipment);
        },
      );
    });
  }
}

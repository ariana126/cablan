import { RecordDependencies, UnitOfWork } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ComponentNameAlreadyExists } from '@products/application/exceptions';
import { ComponentRepository } from '@products/domain/service/component.repository';

import { EditComponentCommand } from './edit-component.command';

@CommandHandler(EditComponentCommand)
export class EditComponentHandler implements ICommandHandler<EditComponentCommand> {
  constructor(
    private readonly componentRepository: ComponentRepository,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EditComponentCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const component = await this.componentRepository.get(command.componentId);
      // A record another record references can be neither edited nor
      // deleted (issue #94) — unless it is the System Admin's correction of
      // its name (issue #110), carried into every related record.
      await this.recordDependencies.editRecordInUse(
        { type: 'Component', id: component.id.asString() },
        {
          applyToRelatedRecords: command.applyToRelatedRecords,
          changesOnlyCorrectableFields:
            component.changesOnlyCorrectableFields(),
          before: { name: component.name().asString() },
          after: { name: command.name.asString() },
        },
        async () => {
          const existingComponent = await this.componentRepository.findByName(
            command.name,
          );
          if (existingComponent && !existingComponent.id.equals(component.id)) {
            throw ComponentNameAlreadyExists.withName(command.name);
          }
          component.rename(command.name);
          await this.componentRepository.save(component);
        },
      );
    });
  }
}

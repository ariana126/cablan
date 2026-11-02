import { RecordDependencies } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ComponentNameAlreadyExists } from '@products/application/exceptions';
import { ComponentRepository } from '@products/domain/service/component.repository';

import { EditComponentCommand } from './edit-component.command';

@CommandHandler(EditComponentCommand)
export class EditComponentHandler implements ICommandHandler<EditComponentCommand> {
  constructor(
    private readonly componentRepository: ComponentRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: EditComponentCommand): Promise<void> {
    const component = await this.componentRepository.get(command.componentId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Component',
      id: component.id.asString(),
    });

    const existingComponent = await this.componentRepository.findByName(
      command.name,
    );
    if (existingComponent && !existingComponent.id.equals(component.id)) {
      throw ComponentNameAlreadyExists.withName(command.name);
    }

    component.rename(command.name);
    await this.componentRepository.save(component);
  }
}

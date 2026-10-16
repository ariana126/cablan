import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ComponentNameAlreadyExists } from '@products/application/exceptions';
import { ComponentRepository } from '@products/domain/service/component.repository';

import { EditComponentCommand } from './edit-component.command';

@CommandHandler(EditComponentCommand)
export class EditComponentHandler implements ICommandHandler<EditComponentCommand> {
  constructor(private readonly componentRepository: ComponentRepository) {}

  async execute(command: EditComponentCommand): Promise<void> {
    const component = await this.componentRepository.get(command.componentId);

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

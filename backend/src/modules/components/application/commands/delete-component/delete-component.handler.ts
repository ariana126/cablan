import { ComponentRepository } from '@components/domain/service/component.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteComponentCommand } from './delete-component.command';

@CommandHandler(DeleteComponentCommand)
export class DeleteComponentHandler implements ICommandHandler<DeleteComponentCommand> {
  constructor(private readonly componentRepository: ComponentRepository) {}

  async execute(command: DeleteComponentCommand): Promise<void> {
    const component = await this.componentRepository.get(command.componentId);
    component.delete();
    // Hard delete: nothing yet references a component, so the row is
    // removed outright rather than upserted behind a flag.
    await this.componentRepository.delete(component);
  }
}

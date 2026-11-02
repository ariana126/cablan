import { RecordDependencies } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ComponentRepository } from '@products/domain/service/component.repository';

import { DeleteComponentCommand } from './delete-component.command';

@CommandHandler(DeleteComponentCommand)
export class DeleteComponentHandler implements ICommandHandler<DeleteComponentCommand> {
  constructor(
    private readonly componentRepository: ComponentRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: DeleteComponentCommand): Promise<void> {
    const component = await this.componentRepository.get(command.componentId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Component',
      id: component.id.asString(),
    });
    component.delete();
    // Hard delete: nothing references the component any more, so the row is
    // removed outright rather than upserted behind a flag. Nothing else is
    // deleted with it.
    await this.componentRepository.delete(component);
  }
}

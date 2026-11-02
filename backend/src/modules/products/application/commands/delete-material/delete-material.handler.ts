import { RecordDependencies } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MaterialRepository } from '@products/domain/service/material.repository';

import { DeleteMaterialCommand } from './delete-material.command';

@CommandHandler(DeleteMaterialCommand)
export class DeleteMaterialHandler implements ICommandHandler<DeleteMaterialCommand> {
  constructor(
    private readonly materialRepository: MaterialRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: DeleteMaterialCommand): Promise<void> {
    const material = await this.materialRepository.get(command.materialId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Material',
      id: material.id.asString(),
    });
    material.delete();
    // Hard delete: nothing references the material any more, so the row is
    // removed outright rather than upserted behind a flag. Nothing else is
    // deleted with it.
    await this.materialRepository.delete(material);
  }
}

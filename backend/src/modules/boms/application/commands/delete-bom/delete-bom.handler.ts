import { BomRepository } from '@boms/domain/service/bom.repository';
import { RecordDependencies } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteBomCommand } from './delete-bom.command';

@CommandHandler(DeleteBomCommand)
export class DeleteBomHandler implements ICommandHandler<DeleteBomCommand> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: DeleteBomCommand): Promise<void> {
    const bom = await this.bomRepository.get(command.bomId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Bom',
      id: bom.id.asString(),
    });
    bom.delete();
    // Hard delete: no re-sample references the daily BOM, so the row is
    // removed outright rather than upserted behind a flag. Nothing else is
    // deleted with it.
    await this.bomRepository.delete(bom);
  }
}

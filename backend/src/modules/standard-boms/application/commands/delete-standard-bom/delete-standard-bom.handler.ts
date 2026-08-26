import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';

import { DeleteStandardBomCommand } from './delete-standard-bom.command';

@CommandHandler(DeleteStandardBomCommand)
export class DeleteStandardBomHandler implements ICommandHandler<DeleteStandardBomCommand> {
  constructor(private readonly standardBomRepository: StandardBomRepository) {}

  async execute(command: DeleteStandardBomCommand): Promise<void> {
    const standardBom = await this.standardBomRepository.get(
      command.standardBomId,
    );
    standardBom.delete();
    // Hard delete: nothing yet references a standard BOM, so the row is
    // removed outright rather than upserted behind a flag.
    await this.standardBomRepository.delete(standardBom);
  }
}

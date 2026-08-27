import { BomRepository } from '@boms/domain/service/bom.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteBomCommand } from './delete-bom.command';

@CommandHandler(DeleteBomCommand)
export class DeleteBomHandler implements ICommandHandler<DeleteBomCommand> {
  constructor(private readonly bomRepository: BomRepository) {}

  async execute(command: DeleteBomCommand): Promise<void> {
    const bom = await this.bomRepository.get(command.bomId);
    bom.delete();
    // Hard delete: nothing yet references a daily BOM, so the row is
    // removed outright rather than upserted behind a flag.
    await this.bomRepository.delete(bom);
  }
}

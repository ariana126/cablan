import { BomRepository } from '@boms/domain/service/bom.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ApproveBomCommand } from './approve-bom.command';

// `Bom.approve()` refuses a BOM that is not pending (`BomAlreadyReviewed`),
// so a refused approval writes nothing. `modify()` serialises it against a
// concurrent review or edit of the same BOM, so the pending check always
// sees the latest state.
@CommandHandler(ApproveBomCommand)
export class ApproveBomHandler implements ICommandHandler<ApproveBomCommand> {
  constructor(private readonly bomRepository: BomRepository) {}

  async execute(command: ApproveBomCommand): Promise<void> {
    await this.bomRepository.modify(command.bomId, (bom) =>
      bom.approve(command.reviewerName),
    );
  }
}

import { BomRepository } from '@boms/domain/service/bom.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RejectBomCommand } from './reject-bom.command';

// `Bom.reject()` refuses a blank reason (`RejectionReasonRequired`) and a BOM
// that is not pending (`BomAlreadyReviewed`); either way nothing is written.
// `modify()` serialises it against a concurrent review or edit of the BOM.
@CommandHandler(RejectBomCommand)
export class RejectBomHandler implements ICommandHandler<RejectBomCommand> {
  constructor(private readonly bomRepository: BomRepository) {}

  async execute(command: RejectBomCommand): Promise<void> {
    await this.bomRepository.modify(command.bomId, (bom) =>
      bom.reject(command.reviewerName, command.reason ?? ''),
    );
  }
}

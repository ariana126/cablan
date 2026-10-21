import { BomRepository } from '@boms/domain/service/bom.repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ApproveBomCommand } from './approve-bom.command';

@CommandHandler(ApproveBomCommand)
export class ApproveBomHandler implements ICommandHandler<ApproveBomCommand> {
  constructor(private readonly bomRepository: BomRepository) {}

  async execute(command: ApproveBomCommand): Promise<void> {
    const bom = await this.bomRepository.get(command.bomId);
    // Approving an approved BOM changes nothing, so nothing is written — a
    // save here could overwrite an edit that committed meanwhile.
    if (bom.approvalStatus() === ApprovalStatus.Approved) {
      return;
    }
    bom.approve(command.approverName);
    await this.bomRepository.save(bom);
  }
}

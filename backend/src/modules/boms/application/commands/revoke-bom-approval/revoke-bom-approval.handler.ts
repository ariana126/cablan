import { BomRepository } from '@boms/domain/service/bom.repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RevokeBomApprovalCommand } from './revoke-bom-approval.command';

@CommandHandler(RevokeBomApprovalCommand)
export class RevokeBomApprovalHandler implements ICommandHandler<RevokeBomApprovalCommand> {
  constructor(private readonly bomRepository: BomRepository) {}

  async execute(command: RevokeBomApprovalCommand): Promise<void> {
    const bom = await this.bomRepository.get(command.bomId);
    // Revoking an unapproved BOM changes nothing, so nothing is written — a
    // save here could overwrite an edit that committed meanwhile.
    if (bom.approvalStatus() === ApprovalStatus.Unapproved) {
      return;
    }
    bom.revokeApproval();
    await this.bomRepository.save(bom);
  }
}

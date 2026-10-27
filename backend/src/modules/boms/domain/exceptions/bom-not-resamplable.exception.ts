import { DomainException } from '@framework/domain';

import { ResamplingRefusal } from '../service/resampling.policy';
import { ApprovalStatus } from '../value/approval-status';

// Thrown by `Bom.resample()` when the daily BOM is not rejected, or is not
// the latest of its tracking number (`resamplingRefusal`): a conflict with
// its current state, like `BomAlreadyReviewed`. Nothing is registered.
export class BomNotResamplable extends DomainException {
  private constructor(
    message: string,
    public readonly bomId: string,
    public readonly approvalStatus: ApprovalStatus,
    public readonly reason: ResamplingRefusal,
  ) {
    super(message);
  }

  public static because(
    reason: ResamplingRefusal,
    bomId: string,
    approvalStatus: ApprovalStatus,
  ): BomNotResamplable {
    const why =
      reason === 'not-rejected'
        ? `it is ${approvalStatus}, not rejected`
        : 'another daily BOM of its tracking number was registered after it';
    return new BomNotResamplable(
      `Daily BOM ${bomId} cannot be re-sampled: ${why}`,
      bomId,
      approvalStatus,
      reason,
    );
  }
}

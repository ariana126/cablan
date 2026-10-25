import { DomainException } from '@framework/domain';

import { ApprovalStatus } from '../value/approval-status';

// Thrown by `Bom.approve()`/`Bom.reject()` on a daily BOM that is already
// approved or rejected: a review's outcome never changes directly — only an
// edit sends the BOM back to pending, where it can be reviewed again.
export class BomAlreadyReviewed extends DomainException {
  private constructor(
    message: string,
    public readonly bomId: string,
    public readonly approvalStatus: ApprovalStatus,
  ) {
    super(message);
  }

  public static withStatus(
    bomId: string,
    approvalStatus: ApprovalStatus,
  ): BomAlreadyReviewed {
    return new BomAlreadyReviewed(
      `Daily BOM ${bomId} is already ${approvalStatus}; edit it to send it back to pending before reviewing it again`,
      bomId,
      approvalStatus,
    );
  }
}

import { ValueObject } from '@framework/domain';

import { ApprovalStatus } from './approval-status';

// Whether a daily BOM is approved, and by whom. The two travel together
// because they are one fact: an approved BOM always names its approver, and
// an unapproved one never does. `approvedBy` is the approver's display name
// at the moment of approval, cloned like `Bom.registeredBy()` — a later
// rename never rewrites who approved it.
export class BomApproval extends ValueObject {
  private constructor(
    private readonly _status: ApprovalStatus,
    private readonly _approvedBy: string | null,
  ) {
    super();
  }

  static unapproved(): BomApproval {
    return new BomApproval(ApprovalStatus.Unapproved, null);
  }

  static by(approverName: string): BomApproval {
    if (!approverName.trim()) {
      throw new Error('An approval must name its approver');
    }
    return new BomApproval(ApprovalStatus.Approved, approverName);
  }

  // For rehydrating a stored approval (`BomMapper`) — checks the stored pair
  // still states one consistent fact.
  static restore(
    status: ApprovalStatus,
    approvedBy: string | null,
  ): BomApproval {
    if (status === ApprovalStatus.Unapproved) {
      if (approvedBy !== null) {
        throw new Error('An unapproved BOM cannot have an approver');
      }
      return BomApproval.unapproved();
    }
    if (approvedBy === null) {
      throw new Error('An approved BOM must have an approver');
    }
    return BomApproval.by(approvedBy);
  }

  public isApproved(): boolean {
    return this._status === ApprovalStatus.Approved;
  }

  public status(): ApprovalStatus {
    return this._status;
  }

  public approvedBy(): string | null {
    return this._approvedBy;
  }
}

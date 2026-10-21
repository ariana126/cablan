import { ApprovalStatus } from './approval-status';
import { BomApproval } from './bom-approval.vo';

describe('BomApproval', () => {
  it('an approval by an empty approver name is rejected', () => {
    expect(() => BomApproval.by(' ')).toThrow();
  });

  it('an approved status restored without an approver is rejected', () => {
    expect(() => BomApproval.restore(ApprovalStatus.Approved, null)).toThrow();
  });

  it('an unapproved status restored with an approver is rejected', () => {
    expect(() =>
      BomApproval.restore(ApprovalStatus.Unapproved, 'مصطفی'),
    ).toThrow();
  });
});

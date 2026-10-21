import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { toApprovalStatus } from './approval-status.column';

describe('toApprovalStatus', () => {
  it('reads a stored approved status', () => {
    expect(toApprovalStatus('approved')).toBe(ApprovalStatus.Approved);
  });

  it('reads a stored unapproved status', () => {
    expect(toApprovalStatus('unapproved')).toBe(ApprovalStatus.Unapproved);
  });

  it('rejects a stored value outside the known statuses', () => {
    expect(() => toApprovalStatus('pending')).toThrow('pending');
  });
});

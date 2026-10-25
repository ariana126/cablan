import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { toApprovalStatus } from './approval-status.column';

describe('toApprovalStatus', () => {
  it.each([
    ['pending', ApprovalStatus.Pending],
    ['approved', ApprovalStatus.Approved],
    ['rejected', ApprovalStatus.Rejected],
  ])('reads a stored %p status', (column, status) => {
    expect(toApprovalStatus(column)).toBe(status);
  });

  it('rejects the retired unapproved status, which the review migration rewrote to pending', () => {
    expect(() => toApprovalStatus('unapproved')).toThrow('unapproved');
  });
});

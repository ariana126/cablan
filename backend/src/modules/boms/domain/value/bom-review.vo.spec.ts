import { ApprovalStatus } from './approval-status';
import { BomReview } from './bom-review.vo';

describe('BomReview', () => {
  it('an approval by an empty reviewer name is rejected', () => {
    expect(() => BomReview.approvedBy(' ', null)).toThrow();
  });

  it('a rejection by an empty reviewer name is rejected', () => {
    expect(() =>
      BomReview.rejectedBy(' ', 'وزن مس خارج از محدوده است'),
    ).toThrow();
  });

  it('a rejection without a reason is rejected', () => {
    expect(() => BomReview.rejectedBy('مصطفی', '  ')).toThrow();
  });

  it('an approved status restored without a reviewer is rejected', () => {
    expect(() =>
      BomReview.restore(ApprovalStatus.Approved, null, null),
    ).toThrow();
  });

  it('a rejected status restored without a reviewer is rejected', () => {
    expect(() =>
      BomReview.restore(ApprovalStatus.Rejected, null, 'دلیل'),
    ).toThrow();
  });

  it('a rejected status restored without a management note is rejected', () => {
    expect(() =>
      BomReview.restore(ApprovalStatus.Rejected, 'مصطفی', null),
    ).toThrow();
  });

  it('a pending status restored with a reviewer is rejected', () => {
    expect(() =>
      BomReview.restore(ApprovalStatus.Pending, 'مصطفی', null),
    ).toThrow();
  });

  it('a pending status restored with a management note is rejected', () => {
    expect(() =>
      BomReview.restore(ApprovalStatus.Pending, null, 'یادداشت'),
    ).toThrow();
  });

  it('an approved status restored without a management note keeps it absent', () => {
    const sut = BomReview.restore(ApprovalStatus.Approved, 'مصطفی', null);

    expect(sut.managementNote()).toBeNull();
  });
});

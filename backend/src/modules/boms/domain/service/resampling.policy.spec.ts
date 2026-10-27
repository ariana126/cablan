import { ApprovalStatus } from '../value/approval-status';
import { isResamplable, resamplingRefusal } from './resampling.policy';

describe('re-sampling a daily BOM («نمونه گیری مجدد»)', () => {
  it('is possible for the latest daily BOM of its tracking number when it was rejected', () => {
    expect(resamplingRefusal(ApprovalStatus.Rejected, true)).toBeNull();
    expect(isResamplable(ApprovalStatus.Rejected, true)).toBe(true);
  });

  it('is refused as not the latest for a rejected daily BOM registered again afterwards', () => {
    expect(resamplingRefusal(ApprovalStatus.Rejected, false)).toBe(
      'not-latest',
    );
    expect(isResamplable(ApprovalStatus.Rejected, false)).toBe(false);
  });

  it.each([
    [ApprovalStatus.Approved, true],
    [ApprovalStatus.Pending, true],
    [ApprovalStatus.Approved, false],
  ])(
    'is refused as not rejected for a daily BOM that is %s (latest: %p)',
    (status, isLatestOfTrackingNumber) => {
      expect(resamplingRefusal(status, isLatestOfTrackingNumber)).toBe(
        'not-rejected',
      );
      expect(isResamplable(status, isLatestOfTrackingNumber)).toBe(false);
    },
  );
});

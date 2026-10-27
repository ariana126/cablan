import { ApprovalStatus } from '../value/approval-status';

/** Why a daily BOM cannot be re-sampled — the 409's `reason`. */
export type ResamplingRefusal = 'not-rejected' | 'not-latest';

/**
 * Re-sampling («نمونه گیری مجدد») is possible only for the **latest** daily
 * BOM of its tracking number, once it is **rejected**. "Latest" is
 * registration order: `createdAt`, then the order of registration among BOMs
 * registered at the same instant (`registration_sequence` in storage), over
 * the BOMs that carry that tracking number now. Not being rejected is
 * reported first.
 *
 * The one statement of the rule: `Bom.resample()` enforces it, and the read
 * side computes the `resamplable` flag the report row and the detail carry
 * with `isResamplable`, so a client never re-derives it.
 */
export function resamplingRefusal(
  approvalStatus: ApprovalStatus,
  isLatestOfTrackingNumber: boolean,
): ResamplingRefusal | null {
  if (approvalStatus !== ApprovalStatus.Rejected) {
    return 'not-rejected';
  }
  if (!isLatestOfTrackingNumber) {
    return 'not-latest';
  }
  return null;
}

export function isResamplable(
  approvalStatus: ApprovalStatus,
  isLatestOfTrackingNumber: boolean,
): boolean {
  return resamplingRefusal(approvalStatus, isLatestOfTrackingNumber) === null;
}

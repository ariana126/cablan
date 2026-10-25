// Where a daily BOM stands in its review: waiting for one ("در انتظار تایید"),
// approved ("تایید") or rejected ("عدم تایید"). The enum values are also the
// wire values and the stored column values.
export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

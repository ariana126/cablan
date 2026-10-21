// Whether a daily BOM has been reviewed and approved ("تایید شده") or not
// ("تایید نشده"). The enum values are also the wire values and the stored
// column values.
export enum ApprovalStatus {
  Approved = 'approved',
  Unapproved = 'unapproved',
}

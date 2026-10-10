/** The Persian label for a standard BOM's `active` flag — «بله» / «خیر» — shared by the standard BOMs
 * page's فعال filter and the audit log's change detail, so the two always read the same. */
export const ACTIVE_LABELS: ReadonlyMap<boolean, string> = new Map<boolean, string>([
  [true, 'بله'],
  [false, 'خیر'],
]);

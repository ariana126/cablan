/**
 * `AuditLogGateway.changes`'s `field` values are the technical DTO keys the backend edited — e.g.
 * `standardLength`, `brand`, `trackingNumber` — one vocabulary shared across every record type this
 * audit log covers (`User`, `Product`, `Component`, `Material`, `StandardBom`, `Bom`). This is a
 * **best-effort** map, not an exhaustive one: `fieldLabel` falls back to the raw key for anything not
 * listed here, so a field this map hasn't caught up with still renders — just untranslated — rather
 * than disappearing or throwing.
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  // Shared / User
  name: 'نام',
  username: 'نام کاربری',
  role: 'نقش',
  // StandardBom
  miCode: 'کد MI',
  brand: 'برند',
  standardLength: 'متراژ استاندارد',
  active: 'فعال',
  productId: 'محصول',
  // Bom
  orderNumber: 'شماره سفارش',
  trackingNumber: 'شماره ردیابی',
  standardBomId: 'آنالیز استاندارد',
  standardBomMiCode: 'کد MI آنالیز استاندارد',
  // Shared free text
  description: 'توضیحات',
  weight: 'وزن',
};

/** Translates a technical field key into its Persian label, or returns the key itself when this map
 * has no translation for it yet. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

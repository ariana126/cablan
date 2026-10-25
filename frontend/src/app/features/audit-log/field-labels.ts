import { Role } from '../../api/model';
import { ACTIVE_LABELS } from '../../core/i18n/active-labels';
import {
  approvalStatusLabel,
  NO_MANAGEMENT_NOTE,
  NO_REVIEWER,
} from '../../core/i18n/approval-labels';
import { ROLE_LABELS } from '../../core/i18n/role-labels';

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
  // Material
  code: 'کد',
  // StandardBom
  miCode: 'کد MI',
  brand: 'برند',
  standardLength: 'متراژ استاندارد',
  active: 'فعال',
  productId: 'محصول',
  // StandardBom / Bom — the product's name, as both BOM pages head that column
  productName: 'نام محصول',
  // Bom
  orderNumber: 'شماره سفارش',
  trackingNumber: 'شماره ردیابی',
  standardBomId: 'آنالیز استاندارد',
  standardBomMiCode: 'کد MI آنالیز استاندارد',
  // Who registered a daily BOM — /boms heads that column «کنترلگر»
  registeredBy: 'کنترلگر',
  // Product / StandardBom / Bom composition — one line per component, "<component>: <materials>"
  component: 'جز',
  // A daily BOM's review — the dashboard and the report head these columns the same way
  approvalStatus: 'وضعیت تایید',
  reviewedBy: 'تایید/رد کننده',
  managementNote: 'توضیحات مدیریت',
  // The reviewer's key before the review could reject; entries recorded then still carry it.
  approvedBy: 'تایید/رد کننده',
  // Shared free text
  description: 'توضیحات',
  weight: 'وزن',
};

/** `materialWeight:<component>:<material>` — a daily BOM edit that only moved existing lines'
 * weights is recorded one line per material. The component name is everything up to the first
 * colon after the prefix; the material keeps any colon of its own. */
const MATERIAL_WEIGHT_FIELD = /^materialWeight:([^:]*):(.*)$/;

/** Translates a technical field key into its Persian label, or returns the key itself when this map
 * has no translation for it yet. A material-weight line reads «وزن جز {component} مواد اولیه
 * {material}». */
export function fieldLabel(field: string): string {
  const weight = MATERIAL_WEIGHT_FIELD.exec(field);
  if (weight) {
    return `وزن جز ${weight[1]} مواد اولیه ${weight[2]}`;
  }
  return FIELD_LABELS[field] ?? field;
}

/** The app's usual placeholder for a value that isn't there — the side a `Registered` entry has
 * nothing before, a `Deleted` one nothing after, and an edit's added/removed component line. */
const EMPTY_VALUE = '—';

/**
 * Per-field vocabularies for the handful of fields whose *values* are technical too — a role's enum
 * key, a boolean flag serialised as `'true'`/`'false'`. Each reuses the label its own page already
 * shows, so the audit log never names a value differently from where it was set. Like
 * `FIELD_LABELS`, best-effort: a value missing from its field's map passes through untranslated.
 */
const VALUE_LABELS: Readonly<Record<string, ReadonlyMap<string, string>>> = {
  role: new Map(Object.entries(ROLE_LABELS) as [Role, string][]),
  active: new Map([...ACTIVE_LABELS].map(([flag, label]) => [String(flag), label])),
  approvalStatus: new Map([
    ...(['pending', 'approved', 'rejected'] as const).map(
      (status) => [status, approvalStatusLabel(status)] as const,
    ),
    // Pending's stored value before the review could reject; older entries still carry it.
    ['unapproved', approvalStatusLabel('pending')],
  ]),
};

/**
 * Fields whose empty side reads differently from `EMPTY_VALUE`. A missing reviewer or management
 * note is a hyphen on every surface that shows one (the report, the dashboard, the export), so the
 * audit log says it the same way.
 */
const EMPTY_VALUES: Readonly<Record<string, string>> = {
  reviewedBy: NO_REVIEWER,
  approvedBy: NO_REVIEWER,
  managementNote: NO_MANAGEMENT_NOTE,
};

/** Renders one side of a change for display: `—` (or the field's own placeholder) when that side is
 * empty, the field's Persian value label when it has one, and the raw value otherwise. */
export function fieldValue(field: string, value: string): string {
  if (value === '') {
    return EMPTY_VALUES[field] ?? EMPTY_VALUE;
  }
  return VALUE_LABELS[field]?.get(value) ?? value;
}

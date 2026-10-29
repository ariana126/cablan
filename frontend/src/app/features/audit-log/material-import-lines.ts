import { AppAuditLogChange } from '../../core/audit-log/audit-log-gateway';

/** The three line keys a bulk import's entries carry. Everything after the first colon is the
 * name or code itself, colons and all. */
const IMPORTED_MATERIAL = /^importedMaterial:(.*)$/s;
const MATERIAL_CODE = /^materialCode:(.*)$/s;
const MATERIAL_NAME = /^materialName:(.*)$/s;

/**
 * One line of a `MaterialImport` entry as a sentence, the way `viewing-audit-log.feature` reads it:
 *
 * - `importedMaterial:<code>` — `''` → name: «ثبت مواد اولیه جدید با نام "…" و کد "…"»; on a
 *   reversion it runs name → `''`, the material's removal: «حذف مواد اولیه "…" با کد "…"»;
 * - `materialCode:<name>` — old → new code: «تغییر کد مواد اولیه "…" از "…" به "…"»;
 * - `materialName:<code>` — old → new name: «تغییر نام مواد اولیه با کد "…" از "…" به "…"».
 *
 * A reversion swaps each line's two sides, so the same sentences read it backwards. A key this
 * doesn't know still shows, as the key and its two values.
 */
export function materialImportLine({ field, previousValue, newValue }: AppAuditLogChange): string {
  const imported = IMPORTED_MATERIAL.exec(field);
  if (imported) {
    const code = imported[1];
    return newValue === ''
      ? `حذف مواد اولیه "${previousValue}" با کد "${code}"`
      : `ثبت مواد اولیه جدید با نام "${newValue}" و کد "${code}"`;
  }

  const codeChange = MATERIAL_CODE.exec(field);
  if (codeChange) {
    return `تغییر کد مواد اولیه "${codeChange[1]}" از "${previousValue}" به "${newValue}"`;
  }

  const rename = MATERIAL_NAME.exec(field);
  if (rename) {
    return `تغییر نام مواد اولیه با کد "${rename[1]}" از "${previousValue}" به "${newValue}"`;
  }

  return `${field}: "${previousValue}" به "${newValue}"`;
}

import { AuditChange } from '@audit-logging/application/service/audit-log.repository';
import { MaterialImportChangeSnapshot } from '@products/domain/events/material-import-change.snapshot';

/**
 * One audit line per change of a material import, in file order. The field
 * key names the change and the material it concerns:
 *
 * - `importedMaterial:<code>` — a registration: `''` → name;
 * - `materialCode:<name>` — a code change: old code → new code;
 * - `materialName:<code>` — a rename: old name → new name.
 *
 * Lives beside the two handlers rather than in `application/service/`: it
 * reads `products`' event snapshot type, which only this directory may
 * import (`audit-logging-event-handlers-reuse-is-narrow`).
 */
export function materialImportLines(
  changes: readonly MaterialImportChangeSnapshot[],
): AuditChange[] {
  return changes.map((change) => {
    switch (change.kind) {
      case 'register': {
        return {
          field: `importedMaterial:${change.code}`,
          previousValue: '',
          newValue: change.name,
        };
      }
      case 'changeCode': {
        return {
          field: `materialCode:${change.name}`,
          previousValue: change.previousCode ?? '',
          newValue: change.code,
        };
      }
      case 'rename': {
        return {
          field: `materialName:${change.code}`,
          previousValue: change.previousName ?? '',
          newValue: change.name,
        };
      }
    }
  });
}

/** A reversion's lines: the import's own, each read backwards. */
export function materialImportReversionLines(
  changes: readonly MaterialImportChangeSnapshot[],
): AuditChange[] {
  return materialImportLines(changes).map((line) => ({
    field: line.field,
    previousValue: line.newValue,
    newValue: line.previousValue,
  }));
}

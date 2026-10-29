import { Material } from '../material.aggregate';
import { MaterialCode } from '../value/material-code.vo';
import { MaterialImportChangeKind } from '../value/material-import-change.vo';
import { MaterialName } from '../value/material-name.vo';

/**
 * One item row of the accounting software's export, or one row the visitor
 * kept in the change list: raw text, as read or as sent. `row` is the
 * spreadsheet row number (1-based, as Excel shows it), only ever echoed back.
 */
export interface MaterialImportRow {
  readonly row: number;
  readonly name: string;
  readonly code: string;
}

/** What a row would do: one of the three changes, nothing, or nothing it can. */
export type MaterialImportRowKind =
  | MaterialImportChangeKind
  | 'unchanged'
  | 'invalid';

export type MaterialImportRowError =
  | 'name-required'
  | 'code-required'
  | 'duplicate-name-in-file'
  | 'duplicate-code-in-file'
  | 'code-taken'
  | 'material-targeted-twice';

/**
 * What one row would do to the registered materials. `name`/`code` are as a
 * `MaterialName`/`MaterialCode` holds them (English digits; a code trimmed),
 * `''` when missing. `materialId` and the `previous*` pair name the existing
 * material a `changeCode`, `rename` or `unchanged` row resolves to, and are
 * `null` otherwise.
 */
export interface ClassifiedMaterialImportRow {
  readonly row: number;
  readonly kind: MaterialImportRowKind;
  readonly name: string;
  readonly code: string;
  readonly materialId: string | null;
  readonly previousName: string | null;
  readonly previousCode: string | null;
  readonly errors: MaterialImportRowError[];
}

/**
 * Compares each row with the registered materials — first by name, then by
 * code, with the same equality as `MaterialName`/`MaterialCode` — and marks
 * the rows that can't be applied (issue #74):
 *
 * - name matches → same code: `unchanged`; another code: `changeCode` of that
 *   material, `code-taken` when the code belongs to another material;
 * - name unknown, code matches → `rename` of the material holding the code;
 * - neither → `register`;
 * - a name or code missing (blank) → `invalid`, with `name-required`/
 *   `code-required`.
 *
 * Across rows: every row sharing a name (or code) with another row is marked
 * `duplicate-name-in-file` (or `duplicate-code-in-file`), and rows resolving
 * to one existing material in different ways (sharing neither name nor code,
 * which the duplicate errors already report) are each marked
 * `material-targeted-twice`.
 *
 * The result is in file order and leaves out `unchanged` rows with no error:
 * they change nothing and the visitor never sees them. Pure: nothing is
 * read or written.
 */
export function classifyMaterialImportRows(
  rows: readonly MaterialImportRow[],
  materials: readonly Material[],
): ClassifiedMaterialImportRow[] {
  const resolved = rows.map((row) => resolve(row, materials));
  const nameCounts = countOf(resolved.map((item) => item.name));
  const codeCounts = countOf(resolved.map((item) => item.code));

  return resolved
    .map((item) => {
      const errors = [...item.errors];
      if (item.name && (nameCounts.get(item.name) ?? 0) > 1) {
        errors.push('duplicate-name-in-file');
      }
      if (item.code && (codeCounts.get(item.code) ?? 0) > 1) {
        errors.push('duplicate-code-in-file');
      }
      if (isTargetedTwice(item, resolved)) {
        errors.push('material-targeted-twice');
      }
      return { ...item, errors };
    })
    .filter((item) => item.kind !== 'unchanged' || item.errors.length > 0);
}

function resolve(
  row: MaterialImportRow,
  materials: readonly Material[],
): ClassifiedMaterialImportRow {
  const name = row.name.trim() ? MaterialName.fromString(row.name) : null;
  const code = row.code.trim() ? MaterialCode.fromString(row.code) : null;
  const unresolved: UnresolvedRow = {
    row: row.row,
    name: name?.asString() ?? '',
    code: code?.asString() ?? '',
    materialId: null,
    previousName: null,
    previousCode: null,
  };

  if (!name || !code) {
    const errors: MaterialImportRowError[] = [];
    if (!name) errors.push('name-required');
    if (!code) errors.push('code-required');
    return { ...unresolved, kind: 'invalid', errors };
  }

  const byName = materials.find((each) => each.name().equals(name));
  const byCode = materials.find((each) => each.code().equals(code));

  if (byName) {
    const codeTaken = byCode !== undefined && !byCode.id.equals(byName.id);
    return {
      ...resolvedTo(unresolved, byName),
      kind: byName.code().equals(code) ? 'unchanged' : 'changeCode',
      errors: codeTaken ? ['code-taken'] : [],
    };
  }
  if (byCode) {
    return { ...resolvedTo(unresolved, byCode), kind: 'rename', errors: [] };
  }
  return { ...unresolved, kind: 'register', errors: [] };
}

type UnresolvedRow = Omit<ClassifiedMaterialImportRow, 'kind' | 'errors'>;

function resolvedTo(row: UnresolvedRow, material: Material): UnresolvedRow {
  return {
    ...row,
    materialId: material.id.asString(),
    previousName: material.name().asString(),
    previousCode: material.code().asString(),
  };
}

function isTargetedTwice(
  item: ClassifiedMaterialImportRow,
  all: readonly ClassifiedMaterialImportRow[],
): boolean {
  if (item.materialId === null) return false;
  return all.some(
    (other) =>
      other !== item &&
      other.materialId === item.materialId &&
      other.name !== item.name &&
      other.code !== item.code,
  );
}

function countOf(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

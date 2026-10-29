import { Identity } from '@framework/domain';

import { Material } from '../material.aggregate';
import { MaterialImport } from '../material-import.aggregate';
import { MaterialCode } from '../value/material-code.vo';
import {
  isMaterialImportChangeKind,
  MaterialImportChange,
} from '../value/material-import-change.vo';
import { MaterialName } from '../value/material-name.vo';
import { ClassifiedMaterialImportRow } from './material-import-classifier';

export interface AppliedMaterialImport {
  /** Every material the import registered or revised, in file order — to save. */
  readonly touchedMaterials: Material[];
  /** The import's record, carrying its one `MaterialsImported` — to save after them. */
  readonly materialImport: MaterialImport;
}

/**
 * Applies already-classified, error-free change rows to the materials they
 * resolved against: a `register` row registers a new material by import, a
 * `changeCode` or `rename` row revises its material by import. Returns the
 * touched materials and the `MaterialImport` recording the changes. Pure: the
 * caller saves what it returns.
 *
 * The caller has refused rows with errors and dropped `unchanged` ones; being
 * handed either is a programming error.
 */
export function applyMaterialImport(
  rows: readonly ClassifiedMaterialImportRow[],
  materials: readonly Material[],
  importedAt: Date,
): AppliedMaterialImport {
  const touchedMaterials: Material[] = [];
  const changes: MaterialImportChange[] = [];

  for (const row of rows) {
    if (row.errors.length > 0 || !isMaterialImportChangeKind(row.kind)) {
      throw new Error('Only error-free change rows can be applied');
    }
    const name = MaterialName.fromString(row.name);
    const code = MaterialCode.fromString(row.code);

    if (row.kind === 'register') {
      const material = Material.registerByImport(name, code);
      touchedMaterials.push(material);
      changes.push(
        MaterialImportChange.registration(material.id, row.name, row.code),
      );
      continue;
    }

    const { material, previousName, previousCode } = resolvedMaterialOf(
      row,
      materials,
    );
    material.reviseByImport(name, code);
    touchedMaterials.push(material);
    changes.push(
      row.kind === 'changeCode'
        ? MaterialImportChange.codeChange(
            material.id,
            row.name,
            previousCode,
            row.code,
          )
        : MaterialImportChange.rename(
            material.id,
            row.code,
            previousName,
            row.name,
          ),
    );
  }

  return {
    touchedMaterials,
    materialImport: MaterialImport.record(changes, importedAt),
  };
}

/** The existing material a `changeCode`/`rename` row resolved to, as it stood. */
function resolvedMaterialOf(
  row: ClassifiedMaterialImportRow,
  materials: readonly Material[],
): { material: Material; previousName: string; previousCode: string } {
  const { materialId } = row;
  const material =
    materialId === null
      ? undefined
      : materials.find((each) =>
          each.id.equals(Identity.fromString(materialId)),
        );
  if (!material || row.previousName === null || row.previousCode === null) {
    throw new Error(
      `Row ${row.row} does not resolve to one of the given materials`,
    );
  }
  return {
    material,
    previousName: row.previousName,
    previousCode: row.previousCode,
  };
}

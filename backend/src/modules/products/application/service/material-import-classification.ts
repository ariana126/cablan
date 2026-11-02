import { RecordDependencies } from '@framework/application';
import { Material } from '@products/domain/material.aggregate';
import {
  ClassifiedMaterialImportRow,
  classifyMaterialImportRows,
  MaterialImportRow,
} from '@products/domain/service/material-import-classifier';

/**
 * Classifies an import's rows the way preview and confirm both must (issue
 * #74), including issue #94's lock: a row that would rename or re-code a
 * material another record references is `material-in-use`. Only the
 * materials a row would revise are asked about, one at a time, through the
 * framework's `RecordDependencies` — so no other module is imported. The
 * classifier itself stays pure; this is where the answer is fetched.
 *
 * Confirm calls it inside the import lock, so the materials and their
 * references are read where the import is then applied.
 */
export async function classifyMaterialImport(
  rows: readonly MaterialImportRow[],
  materials: readonly Material[],
  recordDependencies: RecordDependencies,
): Promise<ClassifiedMaterialImportRow[]> {
  const revisedMaterialIds = new Set(
    classifyMaterialImportRows(rows, materials)
      .filter((item) => item.kind === 'changeCode' || item.kind === 'rename')
      .flatMap((item) => (item.materialId === null ? [] : [item.materialId])),
  );
  const materialsInUse = new Set<string>();
  for (const id of revisedMaterialIds) {
    const dependents = await recordDependencies.dependentsOf({
      type: 'Material',
      id,
    });
    if (dependents.length > 0) {
      materialsInUse.add(id);
    }
  }
  return classifyMaterialImportRows(rows, materials, materialsInUse);
}

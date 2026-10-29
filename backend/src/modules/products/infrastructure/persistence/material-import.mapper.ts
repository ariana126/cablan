import { Identity } from '@framework/domain';
import { MaterialImport } from '@products/domain/material-import.aggregate';
import { MaterialImportChange } from '@products/domain/value/material-import-change.vo';

// The persistence shape of a `MaterialImport`: its own row plus its changes
// in file order. `sequence` (the same-instant tie-breaker) is assigned by the
// database and never flows through here.
export interface MaterialImportChangeRecord {
  kind: string;
  materialId: string;
  previousName: string | null;
  previousCode: string | null;
  name: string;
  code: string;
}

export interface MaterialImportRecord {
  id: string;
  importedAt: Date;
  revertedAt: Date | null;
  changes: MaterialImportChangeRecord[];
}

export const MaterialImportMapper = {
  toDomain(record: MaterialImportRecord): MaterialImport {
    return MaterialImport.fromPersistence(
      Identity.fromString(record.id),
      record.changes.map((change) =>
        MaterialImportChange.fromPersistence(
          change.kind,
          Identity.fromString(change.materialId),
          change.previousName,
          change.previousCode,
          change.name,
          change.code,
        ),
      ),
      record.importedAt,
      record.revertedAt,
    );
  },

  toPersistence(entity: MaterialImport): MaterialImportRecord {
    return {
      id: entity.id.asString(),
      importedAt: entity.importedAt(),
      revertedAt: entity.revertedAt(),
      changes: entity.changes().map((change) => change.snapshot()),
    };
  },
};

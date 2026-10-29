import { AggregateRoot, Identity } from '@framework/domain';

import { MaterialImportReverted } from './events/material-import-reverted.event';
import { MaterialsImported } from './events/materials-imported.event';
import { MaterialImportAlreadyReverted } from './exceptions/material-import-already-reverted.exception';
import { MaterialImportChange } from './value/material-import-change.vo';

/**
 * One confirmed bulk import of materials from the accounting software's
 * Excel (issue #74): the changes it applied, in file order — at most one per
 * material — when, and whether it has since been reverted. It is the unit its
 * single audit entry, and a reversion, refer to. Whether a reversion is still
 * possible depends on other aggregates; `MaterialImportReversion` decides
 * that and undoes the changes before calling `revert()`.
 */
export class MaterialImport extends AggregateRoot {
  private constructor(
    id: Identity,
    private readonly _changes: MaterialImportChange[],
    private readonly _importedAt: Date,
    private _revertedAt: Date | null,
  ) {
    super(id);
  }

  public static record(
    changes: MaterialImportChange[],
    importedAt: Date,
  ): MaterialImport {
    if (changes.length === 0) {
      throw new Error('A material import must change at least one material');
    }
    const materialIds = changes.map((change) => change.materialId().asString());
    if (new Set(materialIds).size !== materialIds.length) {
      throw new Error(
        'A material import must change each material at most once',
      );
    }
    const materialImport = new MaterialImport(
      Identity.new(),
      [...changes],
      importedAt,
      null,
    );
    materialImport.recordThat(
      new MaterialsImported(
        materialImport.id.asString(),
        materialImport.snapshots(),
      ),
    );
    return materialImport;
  }

  /**
   * Rehydrates an import from storage — for its persistence mapper only.
   * Records no event: loading an existing row is not a new business fact.
   */
  public static fromPersistence(
    id: Identity,
    changes: MaterialImportChange[],
    importedAt: Date,
    revertedAt: Date | null,
  ): MaterialImport {
    return new MaterialImport(id, [...changes], importedAt, revertedAt);
  }

  /**
   * Marks the import reverted and records the one `MaterialImportReverted`.
   * A reversion is final: an import is reverted at most once.
   */
  public revert(revertedAt: Date): void {
    if (this._revertedAt !== null) {
      throw MaterialImportAlreadyReverted.withId(this.id.asString());
    }
    this._revertedAt = revertedAt;
    this.recordThat(
      new MaterialImportReverted(this.id.asString(), this.snapshots()),
    );
  }

  public isReverted(): boolean {
    return this._revertedAt !== null;
  }

  public changes(): readonly MaterialImportChange[] {
    return this._changes;
  }

  public importedAt(): Date {
    return this._importedAt;
  }

  public revertedAt(): Date | null {
    return this._revertedAt;
  }

  private snapshots() {
    return this._changes.map((change) => change.snapshot());
  }
}

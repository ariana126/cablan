import { MaterialImportAlreadyReverted } from '../exceptions/material-import-already-reverted.exception';
import { MaterialImportNotLatest } from '../exceptions/material-import-not-latest.exception';
import {
  MaterialImportNotRevertible,
  MaterialImportNotRevertibleReason,
} from '../exceptions/material-import-not-revertible.exception';
import { Material } from '../material.aggregate';
import { MaterialImport } from '../material-import.aggregate';
import { MaterialCode } from '../value/material-code.vo';
import { MaterialImportChange } from '../value/material-import-change.vo';
import { MaterialName } from '../value/material-name.vo';
import { MaterialRepository } from './material.repository';
import { MaterialImportRepository } from './material-import.repository';
import { ProductRepository } from './product.repository';

/**
 * Reverting a bulk import (issue #74) — a rule spanning the import, the
 * materials it touched and the products that may use them, so it lives in a
 * domain service rather than in any one aggregate. `revert()`:
 *
 * 1. refuses an import already reverted, or one that is not the latest import
 *    still in place (imports are undone newest first);
 * 2. refuses, with `MaterialImportNotRevertible`, when a material the import
 *    touched was deleted or no longer has the name and code it left it with
 *    (`material-changed`), a material it registered is in a product's
 *    composition (`material-in-use`), or a name or code it would restore now
 *    belongs to another material (`value-taken`);
 * 3. otherwise withdraws the materials it registered, restores the ones it
 *    revised, and marks the import reverted.
 *
 * Every check runs before anything changes. The caller saves the import and
 * runs this inside one unit of work, serialised with confirming an import.
 */
export class MaterialImportReversion {
  constructor(
    private readonly materialImportRepository: MaterialImportRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async revert(
    materialImport: MaterialImport,
    revertedAt: Date,
  ): Promise<void> {
    await this.assertLatestInPlace(materialImport);

    const changes = materialImport.changes();
    const touched = await this.materialRepository.findByIds(
      changes.map((change) => change.materialId()),
    );
    const asImported = changes.map((change) =>
      this.stillAsImported(
        materialImport,
        change,
        touched.find((each) => each.id.equals(change.materialId())),
      ),
    );
    await this.assertNoneInUse(materialImport, changes);
    for (const change of changes) {
      await this.assertRestorable(materialImport, change);
    }

    for (const [index, change] of changes.entries()) {
      if (!change.isRegistration()) continue;
      asImported[index].withdrawFromImport();
      await this.materialRepository.delete(asImported[index]);
    }
    for (const [index, change] of changes.entries()) {
      if (change.isRegistration()) continue;
      const { name, code } = change.restoredNameAndCode();
      asImported[index].restoreBeforeImport(
        MaterialName.fromString(name),
        MaterialCode.fromString(code),
      );
      await this.materialRepository.save(asImported[index]);
    }
    materialImport.revert(revertedAt);
  }

  private async assertLatestInPlace(
    materialImport: MaterialImport,
  ): Promise<void> {
    if (materialImport.isReverted()) {
      throw MaterialImportAlreadyReverted.withId(materialImport.id.asString());
    }
    const latest = await this.materialImportRepository.findLatestNotReverted();
    if (!latest?.id.equals(materialImport.id)) {
      throw MaterialImportNotLatest.withId(materialImport.id.asString());
    }
  }

  /** The material, still holding the name and code the import left it with. */
  private stillAsImported(
    materialImport: MaterialImport,
    change: MaterialImportChange,
    material: Material | undefined,
  ): Material {
    if (
      material?.name().equals(MaterialName.fromString(change.name())) &&
      material.code().equals(MaterialCode.fromString(change.code()))
    ) {
      return material;
    }
    throw notRevertible(
      materialImport,
      'material-changed',
      `the material imported as "${change.name()}" (${change.code()}) was deleted or changed since`,
    );
  }

  private async assertNoneInUse(
    materialImport: MaterialImport,
    changes: readonly MaterialImportChange[],
  ): Promise<void> {
    const registered = changes
      .filter((change) => change.isRegistration())
      .map((change) => change.materialId());
    if (
      registered.length > 0 &&
      (await this.productRepository.anyUsesMaterial(registered))
    ) {
      throw notRevertible(
        materialImport,
        'material-in-use',
        'a material it registered is used by a product',
      );
    }
  }

  private async assertRestorable(
    materialImport: MaterialImport,
    change: MaterialImportChange,
  ): Promise<void> {
    if (change.isRegistration()) return;
    const { name, code } = change.restoredNameAndCode();
    const holders = [
      await this.materialRepository.findByName(MaterialName.fromString(name)),
      await this.materialRepository.findByCode(MaterialCode.fromString(code)),
    ];
    if (
      holders.some((holder) => holder && !holder.id.equals(change.materialId()))
    ) {
      throw notRevertible(
        materialImport,
        'value-taken',
        `"${name}" (${code}) now belongs to another material`,
      );
    }
  }
}

function notRevertible(
  materialImport: MaterialImport,
  reason: MaterialImportNotRevertibleReason,
  detail: string,
): MaterialImportNotRevertible {
  return MaterialImportNotRevertible.because(
    materialImport.id.asString(),
    reason,
    detail,
  );
}

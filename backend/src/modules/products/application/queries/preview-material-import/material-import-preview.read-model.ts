import {
  MaterialImportRowError,
  MaterialImportRowKind,
} from '@products/domain/service/material-import-classifier';

/**
 * One listed row of an import preview: what it would do (`kind`), its
 * normalised `name`/`code` (`''` when missing), the existing material it
 * resolves to with that material's current name and code (`null` for a
 * registration or an invalid row), and why it can't be applied (`errors`).
 */
export class MaterialImportPreviewChange {
  constructor(
    public readonly row: number,
    public readonly kind: MaterialImportRowKind,
    public readonly name: string,
    public readonly code: string,
    public readonly materialId: string | null,
    public readonly previousName: string | null,
    public readonly previousCode: string | null,
    public readonly errors: MaterialImportRowError[],
  ) {}
}

/** The change list of an uploaded file, in file order. Nothing is stored. */
export class MaterialImportPreview {
  constructor(public readonly changes: MaterialImportPreviewChange[]) {}
}

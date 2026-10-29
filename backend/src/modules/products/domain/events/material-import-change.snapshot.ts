/** What a bulk import did to one material. */
export type MaterialImportChangeKind = 'register' | 'changeCode' | 'rename';

/**
 * One change of a bulk import as plain data, carried by `MaterialsImported`
 * and `MaterialImportReverted` in file order: what the material was before
 * (`null` for a registration) and what the import left it as. A subscriber
 * renders it as it needs — audit-logging builds its own line keys from it.
 */
export interface MaterialImportChangeSnapshot {
  readonly kind: MaterialImportChangeKind;
  readonly materialId: string;
  readonly previousName: string | null;
  readonly previousCode: string | null;
  readonly name: string;
  readonly code: string;
}

import { DomainException } from '@framework/domain';

/**
 * Why a bulk import can no longer be undone:
 * - `material-in-use` — a material it registered is now in a product's
 *   composition;
 * - `material-changed` — a material it touched was deleted, or no longer has
 *   the name and code the import left it with;
 * - `value-taken` — a name or code it would restore now belongs to another
 *   material.
 */
export type MaterialImportNotRevertibleReason =
  | 'material-in-use'
  | 'material-changed'
  | 'value-taken';

export class MaterialImportNotRevertible extends DomainException {
  private constructor(
    message: string,
    public readonly importId: string,
    public readonly reason: MaterialImportNotRevertibleReason,
  ) {
    super(message);
  }

  public static because(
    importId: string,
    reason: MaterialImportNotRevertibleReason,
    detail: string,
  ): MaterialImportNotRevertible {
    return new MaterialImportNotRevertible(
      `Material import ${importId} can no longer be reverted: ${detail}`,
      importId,
      reason,
    );
  }
}

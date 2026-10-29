import { Identity, ValueObject } from '@framework/domain';

import {
  MaterialImportChangeKind,
  MaterialImportChangeSnapshot,
} from '../events/material-import-change.snapshot';

export type { MaterialImportChangeKind } from '../events/material-import-change.snapshot';

const CHANGE_KINDS: ReadonlySet<string> = new Set([
  'register',
  'changeCode',
  'rename',
]);

export function isMaterialImportChangeKind(
  kind: string,
): kind is MaterialImportChangeKind {
  return CHANGE_KINDS.has(kind);
}

/**
 * One change a confirmed bulk import applied to one material: what it was
 * before (`null` for a registration) and what the import left it as. That
 * pair is all a reversion needs — to check the material still stands as the
 * import left it, and to put back what it was.
 *
 * Invariants, by kind: a registration has no previous name or code; a code
 * change keeps the name; a rename keeps the code.
 *
 * Names and codes are kept as text: they were `MaterialName`/`MaterialCode`
 * validated when the import was applied, the same reasoning that lets
 * `ProductMaterialLine` keep a plain name.
 */
export class MaterialImportChange extends ValueObject {
  private constructor(
    private readonly _kind: MaterialImportChangeKind,
    private readonly _materialId: Identity,
    private readonly _previousName: string | null,
    private readonly _previousCode: string | null,
    private readonly _name: string,
    private readonly _code: string,
  ) {
    super();
  }

  static registration(
    materialId: Identity,
    name: string,
    code: string,
  ): MaterialImportChange {
    return new MaterialImportChange(
      'register',
      materialId,
      null,
      null,
      name,
      code,
    );
  }

  static codeChange(
    materialId: Identity,
    name: string,
    previousCode: string,
    code: string,
  ): MaterialImportChange {
    return new MaterialImportChange(
      'changeCode',
      materialId,
      name,
      previousCode,
      name,
      code,
    );
  }

  static rename(
    materialId: Identity,
    code: string,
    previousName: string,
    name: string,
  ): MaterialImportChange {
    return new MaterialImportChange(
      'rename',
      materialId,
      previousName,
      code,
      name,
      code,
    );
  }

  /** Rebuilds a stored change — for the import's persistence mapper only. */
  static fromPersistence(
    kind: string,
    materialId: Identity,
    previousName: string | null,
    previousCode: string | null,
    name: string,
    code: string,
  ): MaterialImportChange {
    if (!isMaterialImportChangeKind(kind)) {
      throw new Error(`Unknown material import change kind: ${kind}`);
    }
    const consistent = {
      register: previousName === null && previousCode === null,
      changeCode: previousName === name && previousCode !== null,
      rename: previousCode === code && previousName !== null,
    }[kind];
    if (!consistent) {
      throw new Error(
        `Stored material import change of ${materialId.asString()} does not match its kind ${kind}`,
      );
    }
    return new MaterialImportChange(
      kind,
      materialId,
      previousName,
      previousCode,
      name,
      code,
    );
  }

  public snapshot(): MaterialImportChangeSnapshot {
    return {
      kind: this._kind,
      materialId: this._materialId.asString(),
      previousName: this._previousName,
      previousCode: this._previousCode,
      name: this._name,
      code: this._code,
    };
  }

  /**
   * The name and code a reversion puts back. A registration has none — its
   * material is withdrawn instead — so asking one is a programming error.
   */
  public restoredNameAndCode(): { name: string; code: string } {
    if (this._previousName === null || this._previousCode === null) {
      throw new Error('A registration has no name and code to restore');
    }
    return { name: this._previousName, code: this._previousCode };
  }

  public isRegistration(): boolean {
    return this._kind === 'register';
  }

  public kind(): MaterialImportChangeKind {
    return this._kind;
  }

  public materialId(): Identity {
    return this._materialId;
  }

  public previousName(): string | null {
    return this._previousName;
  }

  public previousCode(): string | null {
    return this._previousCode;
  }

  public name(): string {
    return this._name;
  }

  public code(): string {
    return this._code;
  }
}

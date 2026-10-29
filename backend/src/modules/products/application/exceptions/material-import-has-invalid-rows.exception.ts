import { ApplicationException } from '@framework/application';
import { MaterialImportRowError } from '@products/domain/service/material-import-classifier';

export interface InvalidMaterialImportRow {
  readonly row: number;
  readonly name: string;
  readonly code: string;
  readonly errors: MaterialImportRowError[];
}

// Thrown when a confirmed import still holds a row that can't be applied, as
// re-classified against the materials at confirm time. The import is all or
// nothing, so nothing is written; the rows travel back so the client can mark
// them. A 400 `material-import-has-invalid-rows` with a `rows` extension.
export class MaterialImportHasInvalidRows extends ApplicationException {
  private constructor(
    message: string,
    public readonly rows: InvalidMaterialImportRow[],
  ) {
    super(message);
  }

  public static withRows(
    rows: InvalidMaterialImportRow[],
  ): MaterialImportHasInvalidRows {
    return new MaterialImportHasInvalidRows(
      `${rows.length} row(s) of the material import cannot be applied`,
      rows,
    );
  }
}

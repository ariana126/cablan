import { MaterialImportRow } from '@products/domain/service/material-import-classifier';

// The rows of a previewed import the visitor kept, as they sent them back.
export class ConfirmMaterialImportCommand {
  constructor(public readonly rows: MaterialImportRow[]) {}
}

import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  ConfirmMaterialImportRowDto,
  MaterialImportPreviewChange,
  MaterialImportPreviewChangeErrorsItem,
  MaterialImportPreviewChangeKind,
} from '../../api/model';
import { MaterialsService } from '../../api/materials/materials.service';

/** What one spreadsheet row would do: register, change a code, rename — or nothing, being in error. */
export type AppMaterialImportChangeKind = MaterialImportPreviewChangeKind;

/** Why a row can't be applied as it stands. The same codes come back on a refused confirm. */
export type AppMaterialImportRowError = MaterialImportPreviewChangeErrorsItem;

/** One row of an accounting-Excel change list, in the order the file has it. */
export interface AppMaterialImportChange {
  /** The spreadsheet row number, as Excel shows it. */
  readonly row: number;
  readonly kind: AppMaterialImportChangeKind;
  /** As the file has it, digits made Latin; `''` when the cell is empty. */
  readonly name: string;
  readonly code: string;
  /** The matched material's current name and code; `''` when the row matches none. */
  readonly previousName: string;
  readonly previousCode: string;
  readonly errors: readonly AppMaterialImportRowError[];
}

/** A row the visitor kept, sent back as the file had it — the server classifies it again. */
export type AppMaterialImportRow = ConfirmMaterialImportRowDto;

function toAppChange(change: MaterialImportPreviewChange): AppMaterialImportChange {
  return {
    row: change.row,
    kind: change.kind,
    name: change.name ?? '',
    code: change.code ?? '',
    previousName: change.previousName ?? '',
    previousCode: change.previousCode ?? '',
    errors: change.errors ?? [],
  };
}

/**
 * Bulk-importing materials from the accounting software's Excel export: a stateless preview of the
 * changes a file would make, confirming the rows the visitor kept (all or nothing), and — System
 * Admin only — reverting the latest import.
 */
@Injectable({ providedIn: 'root' })
export class MaterialImportGateway {
  private readonly api = inject(MaterialsService);

  preview(file: Blob): Observable<AppMaterialImportChange[]> {
    return this.api
      .materialImportControllerPreview({ file })
      .pipe(map((preview) => (preview.changes ?? []).map(toAppChange)));
  }

  /** Applies the kept rows and answers with the new import's id. */
  confirm(rows: readonly AppMaterialImportRow[]): Observable<string> {
    return this.api
      .materialImportControllerConfirm({ rows: [...rows] })
      .pipe(map((created) => created.id ?? ''));
  }

  revert(importId: string): Observable<void> {
    return this.api.materialImportControllerRevert(importId);
  }
}

import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  PmPlanImportConflict,
  PmPlanImportConflictDifferencesItem,
  PmPlanImportCounts,
  PmPlanImportError,
  PmPlanImportItem,
  PmPlanImportPreview,
} from '../../api/model';
import { PmPlanImportsService } from '../../api/pm-plan-imports/pm-plan-imports.service';

/** One cell the check refused: where it is (sheet, cell, row, column), what it holds (`''` when
 * empty) and why, `message` being the reason as the visitor reads it. */
export type AppPmPlanImportError = PmPlanImportError;

/** A plan row the file names — an equipment, an activity, its interval and first due date (ISO). */
export type AppPmPlanImportItem = PmPlanImportItem;

/** What a file's row differs in from the equipment's active row, in this order. */
export type AppPmPlanImportDifference = PmPlanImportConflictDifferencesItem;

/** A row the file names that is already active with another interval or first due date. */
export type AppPmPlanImportConflict = PmPlanImportConflict;

export type AppPmPlanImportCounts = PmPlanImportCounts;

/**
 * The system's report on a PM-plan workbook: before confirming, what an import would add, what is
 * already in force, what differs from an active row and every error; after confirming, the same
 * with `toCreate` being what was added. Every list present, in the server's (file) order.
 */
export interface AppPmPlanImport {
  readonly sheetName: string;
  readonly counts: AppPmPlanImportCounts;
  readonly errors: readonly AppPmPlanImportError[];
  readonly toCreate: readonly AppPmPlanImportItem[];
  readonly alreadyExisting: readonly AppPmPlanImportItem[];
  readonly conflicts: readonly AppPmPlanImportConflict[];
}

function toAppImport(report: PmPlanImportPreview): AppPmPlanImport {
  return {
    sheetName: report.sheetName ?? '',
    counts: report.counts,
    errors: report.errors ?? [],
    toCreate: report.toCreate ?? [],
    alreadyExisting: report.alreadyExisting ?? [],
    conflicts: report.conflicts ?? [],
  };
}

/**
 * Bulk import of PM plans from the plant's Excel matrix (issue #127, System Admin only). The check
 * is stateless; the import re-sends the same file, which the server checks again and applies all or
 * nothing (400 `pm-plan-import-has-errors` when it has errors).
 */
@Injectable({ providedIn: 'root' })
export class PmPlanImportGateway {
  private readonly api = inject(PmPlanImportsService);

  preview(file: Blob): Observable<AppPmPlanImport> {
    return this.api.pmPlanImportControllerPreview({ file }).pipe(map(toAppImport));
  }

  import(file: Blob): Observable<AppPmPlanImport> {
    return this.api.pmPlanImportControllerImport({ file }).pipe(map(toAppImport));
  }
}

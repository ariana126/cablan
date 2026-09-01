import { Injectable } from '@angular/core';
import writeExcelFile from 'write-excel-file/browser';

/** Every cell type `write-excel-file` accepts for a plain grid — re-exported so a feature's own
 * row-shaping module (e.g. `features/bom-reports/bom-report-export.ts`) never has to import the
 * third-party library itself just to name its own return type. */
export type XlsxCell = string | number;

/**
 * Writes a grid to a real `.xlsx` file and triggers a browser download of it — a thin wrapper
 * around `write-excel-file`, injected rather than imported directly by a feature so a component's own
 * spec can substitute it through `TestBed` (`@angular/build:unit-test` refuses `vi.mock` on a
 * relative import outright — "Please use Angular TestBed for mocking dependencies" — which is what
 * makes this an injectable service rather than a plain exported function).
 *
 * `write-excel-file`'s own `toFile()` is a `Blob` + object URL + a clicked `<a download>` under the
 * hood, which is what `acceptance-tests/screenplay/common/downloads.ts#CaptureTheDownloadTriggeredBy`
 * needs to see a real `download` event rather than an in-page preview.
 *
 * Deliberately carries no unit test of its own: jsdom implements neither `URL.createObjectURL` nor a
 * real file-save dialog, so the one thing this class does — trigger that download — can only be
 * proven in a real browser. Every caller mocks this service instead of asserting anything about the
 * download itself; see this feature's own browser pass for what actually exercises it.
 */
@Injectable({ providedIn: 'root' })
export class XlsxDownloader {
  download(grid: XlsxCell[][], fileName: string): Promise<void> {
    return writeExcelFile(grid).toFile(fileName);
  }
}

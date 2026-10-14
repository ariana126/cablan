import { DOCUMENT, Injectable, inject } from '@angular/core';

/** How long an object URL outlives its click. Revoking it synchronously can cancel a download the
 * browser has not started reading yet; FileSaver.js settled on the same 40 s for the same reason. */
const REVOKE_DELAY_MS = 40_000;

/**
 * Saves a `Blob` the API produced as a real browser download — an object URL behind a clicked
 * `<a download>`, which is what makes the browser fire a genuine `download` event rather than open
 * an in-page preview. Something downstream depends on that event, so do not "simplify" this into a
 * `window.open` or a navigation.
 *
 * Injectable rather than a plain function so a page's spec can substitute it through `TestBed`
 * (`@angular/build:unit-test` refuses `vi.mock` on a relative import). Hand-written rather than the
 * `file-saver` package, which has had no release since 2020 and mostly carries fallbacks for
 * browsers without `<a download>`.
 */
@Injectable({ providedIn: 'root' })
export class FileSaver {
  private readonly document = inject(DOCUMENT);

  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    // Attached for the click: Firefox ignores a click on a detached anchor.
    this.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}

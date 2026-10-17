import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * The line icon for a navigation category, shared by the drawer and the home page's cards so the
 * two always agree. Inline SVG inside `mat-icon` on a 24px viewBox, stroked in `currentColor` so it
 * follows its container's colour in both schemes; there is no icon font to ligature from.
 *
 * Decoration, not content: `mat-icon` hides it from assistive technology, and the label beside it
 * carries the meaning. An id it does not know (a page rather than a category) gets a plain document.
 */
@Component({
  selector: 'app-category-icon',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'category-icon' },
  template: `
    <mat-icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        @switch (id()) {
          @case ('quality-control') {
            <path d="M9 4h6v3H9z" />
            <path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
            <path d="M9 14l2 2 4-4" />
          }
          @case ('master-data') {
            <ellipse cx="12" cy="6" rx="7" ry="3" />
            <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
            <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
          }
          @case ('system-administration') {
            <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6z" />
            <path d="M9 12l2 2 4-4" />
          }
          @case ('reports') {
            <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
          }
          @default {
            <path d="M7 3h7l5 5v13H7z" />
            <path d="M14 3v5h5" />
          }
        }
      </svg>
    </mat-icon>
  `,
})
export class CategoryIcon {
  /** A navigation category id, e.g. `master-data`. */
  readonly id = input.required<string>();
}

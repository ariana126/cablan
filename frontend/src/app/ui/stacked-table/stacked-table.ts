import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * Lets the tables inside its host fold into labelled cards on a narrow screen — a phone held
 * upright — instead of scrolling sideways (issue #41).
 *
 * It does two things, and changes nothing else about the markup:
 *
 * - It adds the `stacked-table` class to its host, which makes the host a size container. The
 *   layout itself is global CSS in `styles/_stacked-table.scss`: below 40rem of *container* width
 *   each row becomes a card and each cell a line, «label: value». A container query, not a media
 *   query, so a table that has the room stays a table wherever it sits — on desktop every data sheet
 *   is wider than that, and its layout does not change at all.
 * - It writes each body cell's column header text into a `data-label` attribute, which that CSS
 *   shows in front of the value. Kept in step by a `MutationObserver`, because rows arrive and leave
 *   with the data, and those changes belong to the page's view, not to this directive's.
 *
 * What it deliberately keeps: the `<table>`, its rows, cells and header cells, their explicit
 * `role`s (which Material already writes, and which is what keeps a table a table to a screen reader
 * once CSS changes its `display`), every accessible name, and the DOM order — so the acceptance suite
 * and the keyboard see the same page at every width. The header row is only *visually* hidden in the
 * stacked layout; a sortable header (`th[aria-sort]`) stays visible, so sorting stays available.
 *
 * A column whose header is for a screen reader only (the row actions' «عملیات» is
 * `.visually-hidden`) gets no label: its cell is the card's footer.
 *
 * `app-data-sheet` applies this to its body, so every list page gets it for free. Apply it yourself
 * only to a table that does not live in a data sheet (the dashboard's per-analysis lines).
 */
@Directive({
  selector: '[appStackedTable]',
  host: { class: 'stacked-table' },
})
export class StackedTable {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      labelCells(host);
      // Only structure and text are watched, never attributes: writing `data-label` must not wake
      // the observer that wrote it.
      const observer = new MutationObserver(() => labelCells(host));
      observer.observe(host, { childList: true, subtree: true, characterData: true });
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/** Labels every body cell of every table under `root` with its column header's visible text. */
function labelCells(root: HTMLElement): void {
  for (const table of Array.from(root.querySelectorAll('table'))) {
    const header = table.tHead?.rows[0];
    if (!header) {
      continue;
    }
    const labels = Array.from(header.cells).map(visibleText);
    for (const body of Array.from(table.tBodies)) {
      for (const row of Array.from(body.rows)) {
        Array.from(row.cells).forEach((cell, index) => setLabel(cell, labels[index] ?? ''));
      }
    }
  }
}

/** A header's text as a sighted reader sees it — without what is there for a screen reader only. */
function visibleText(cell: HTMLTableCellElement): string {
  const copy = cell.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.visually-hidden').forEach((hidden) => hidden.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function setLabel(cell: HTMLTableCellElement, label: string): void {
  if (label === '') {
    cell.removeAttribute('data-label');
  } else if (cell.getAttribute('data-label') !== label) {
    cell.setAttribute('data-label', label);
  }
}

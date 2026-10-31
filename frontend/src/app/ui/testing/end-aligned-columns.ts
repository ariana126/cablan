/**
 * Spec helper: which column headers, and which cells of a table's first body row, hold their content
 * in a `.cell-end` box (pushed to the end edge — see `styles/_layout.scss`).
 *
 * jsdom has no layout, so a spec cannot measure that a value sits under its header. It can pin the
 * thing that decides it: a column whose values are end-aligned must have an end-aligned header too,
 * or the value reads as belonging to the next column over.
 */
export function endAlignedColumns(table: Element): {
  readonly headers: boolean[];
  readonly cells: boolean[];
} {
  const endAligned = (cell: Element) => cell.querySelector('.cell-end') !== null;
  const firstRow = table.querySelector('tbody tr');
  return {
    headers: Array.from(table.querySelectorAll('thead th')).map(endAligned),
    cells: firstRow ? Array.from(firstRow.querySelectorAll('td')).map(endAligned) : [],
  };
}

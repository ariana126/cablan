import { XlsxCell } from './xlsx-downloader';

/** One (component, material) pair of a BOM, with its weight. */
export interface MaterialWeightEntry {
  readonly componentName: string;
  readonly materialName: string;
  readonly weight: number;
}

export interface MaterialWeightColumns {
  /** One header per distinct material-of-component, in order of first appearance. */
  readonly headers: string[];
  /** One row of cells per input BOM, aligned with `headers`; `''` where the BOM lacks that pair. */
  readonly rows: XlsxCell[][];
}

/** The column header for one entry: the material followed by the component it belongs to
 * («مس» of «هادی ۱» → «مس هادی ۱»), so the component's own slot number, which is part of its name,
 * is what tells two otherwise identical materials apart. */
function headerOf(entry: MaterialWeightEntry): string {
  return `${entry.materialName} ${entry.componentName}`;
}

/**
 * Lays BOMs out one column per distinct material-of-component instead of one per slot. A BOM that
 * does not contain a column's pair leaves the cell empty; one that contains the same pair more than
 * once (two identically named slots) gets the weights summed into the one cell, rather than a
 * second column the header could not tell apart from the first.
 */
export function buildMaterialWeightColumns(
  entriesByItem: readonly (readonly MaterialWeightEntry[])[],
): MaterialWeightColumns {
  const headers: string[] = [];
  const weightsByItem = entriesByItem.map((entries) => {
    const weights = new Map<string, number>();
    for (const entry of entries) {
      const header = headerOf(entry);
      if (!headers.includes(header)) {
        headers.push(header);
      }
      weights.set(header, (weights.get(header) ?? 0) + entry.weight);
    }
    return weights;
  });

  const rows = weightsByItem.map((weights) => headers.map((header) => weights.get(header) ?? ''));

  return { headers, rows };
}

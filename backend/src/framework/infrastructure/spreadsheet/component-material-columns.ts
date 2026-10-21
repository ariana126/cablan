import { SpreadsheetCell } from './spreadsheet-cell';

/** One component of a BOM, its materials in the standard BOM's own defined order. */
export interface ComponentMaterials {
  readonly name: string;
  readonly materials: readonly {
    readonly name: string;
    readonly weight: number;
  }[];
}

export interface ComponentMaterialColumns {
  /** «جز n», «مواد اولیه n», «وزن n» per material slot, n in Persian digits from ۱. */
  readonly headers: string[];
  /** One row of cells per input BOM, aligned with `headers`; `-` in every slot the BOM lacks. */
  readonly rows: SpreadsheetCell[][];
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** A plain hyphen for an empty slot — the same "nothing here" both exports write. */
const EMPTY_SLOT = '-';

function toPersianDigits(value: number): string {
  return String(value).replaceAll(
    /\d/g,
    (digit) => PERSIAN_DIGITS[Number(digit)],
  );
}

/** A BOM's material lines in order: its components in order, each one's materials in order. */
function materialLinesOf(
  components: readonly ComponentMaterials[],
): SpreadsheetCell[][] {
  return components.flatMap((component) =>
    component.materials.map((material) => [
      component.name,
      material.name,
      material.weight,
    ]),
  );
}

/**
 * Lays BOMs out one row each: one (component, material, weight) slot per material line, in the
 * BOM's own composition order — slot n is its n-th material line, headed «جز n», «مواد اولیه n»,
 * «وزن n». There are as many slots as the BOM with the most material lines has, and every slot a
 * BOM lacks is padded with `-` in all three cells.
 *
 * Shared by the daily-BOM and standard-BOM exports, which lay out their "one row per BOM" format
 * identically.
 */
export function buildComponentMaterialColumns(
  componentsByItem: readonly (readonly ComponentMaterials[])[],
): ComponentMaterialColumns {
  const linesByItem = componentsByItem.map((components) =>
    materialLinesOf(components),
  );
  const slots = Math.max(0, ...linesByItem.map((lines) => lines.length));

  const headers = Array.from({ length: slots }, (_, index) => {
    const n = toPersianDigits(index + 1);
    return [`جز ${n}`, `مواد اولیه ${n}`, `وزن ${n}`];
  }).flat();

  const rows = linesByItem.map((lines) =>
    Array.from(
      { length: slots },
      (_, index): SpreadsheetCell[] =>
        lines[index] ?? [EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT],
    ).flat(),
  );

  return { headers, rows };
}

import { XlsxCell } from '../../../core/files/xlsx-downloader';
import { AppStandardBomExportItem } from '../../../core/standard-boms/standard-bom-report-gateway';

/** What a Gherkin table, and this feature's own spreadsheet, both already use for "nothing here" —
 * mirrors `bom-report-export.ts`'s own `MISSING_VALUE`: `exporting-standard-bom.feature`'s worked
 * examples compare the exported file's cells byte-for-byte, and every one of them (a missing
 * description, a padded triple) is a plain hyphen, not an em dash. */
const MISSING_VALUE = '-';

/** بله/خیر — the exact convention `standard-bom-reports-page.ts#formatActive` already renders on
 * screen, reused here rather than duplicated so the exported cell and the on-screen cell can never
 * drift apart. */
function formatActive(active: boolean): string {
  return active ? 'بله' : 'خیر';
}

const LEADING_COLUMNS = [
  'کد MI',
  'نام محصول',
  'برند',
  'متراژ استاندارد',
  'فعال',
  'توضیحات',
] as const;

/** The two row layouts `exporting-standard-bom.feature` names, keyed for
 * `StandardBomReportsPage`'s export menu — the menu item's own accessible name is this array's
 * `label`, matched exactly against the feature's own quoted format strings. */
export const STANDARD_BOM_EXPORT_FORMATS = [
  { key: 'perMaterial', label: 'هر مواد اولیه یک ردیف' },
  { key: 'perBom', label: 'هر آنالیز استاندارد یک ردیف' },
] as const;

export type StandardBomExportFormatKey = (typeof STANDARD_BOM_EXPORT_FORMATS)[number]['key'];

export const STANDARD_BOM_EXPORT_FILE_NAME = 'گزارش-آنالیز-های-استاندارد.xlsx';

type ExportCell = XlsxCell;

interface MaterialEntry {
  readonly componentName: string;
  readonly materialName: string;
  readonly weight: number;
}

/** Flattens one standard BOM's components into its (component, material) entries, in rendered
 * order — mirrors `bom-report-export.ts#toMaterialEntries` exactly. */
function toMaterialEntries(item: AppStandardBomExportItem): MaterialEntry[] {
  return item.components.flatMap((component) =>
    component.materials.map((material) => ({
      componentName: component.name,
      materialName: material.name,
      weight: material.weight,
    })),
  );
}

function leadingCells(item: AppStandardBomExportItem): ExportCell[] {
  return [
    item.miCode,
    item.productName,
    item.brand,
    item.standardLength,
    formatActive(item.active),
    item.description ?? MISSING_VALUE,
  ];
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Renders `1`, `2`, `3`, … as Persian digits — `exporting-standard-bom.feature`'s own "جز ۱"/"مواد
 * اولیه ۱"/"وزن ۱" column headers. Mirrors `bom-report-export.ts#toPersianDigits` exactly. */
function toPersianDigits(value: number): string {
  return String(value)
    .split('')
    .map((digit) => PERSIAN_DIGITS[Number(digit)])
    .join('');
}

function buildOneRowPerMaterialGrid(items: readonly AppStandardBomExportItem[]): ExportCell[][] {
  const header: ExportCell[] = [...LEADING_COLUMNS, 'نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'];

  const rows = items.flatMap((item) => {
    const leading = leadingCells(item);
    return toMaterialEntries(item).map((entry) => [
      ...leading,
      entry.componentName,
      entry.materialName,
      entry.weight,
    ]);
  });

  return [header, ...rows];
}

function buildOneRowPerBomGrid(items: readonly AppStandardBomExportItem[]): ExportCell[][] {
  const entriesByItem = items.map(toMaterialEntries);
  const columnCount = entriesByItem.reduce((max, entries) => Math.max(max, entries.length), 0);
  const columnNumbers = Array.from({ length: columnCount }, (_, index) => index + 1);

  const header: ExportCell[] = [
    ...LEADING_COLUMNS,
    ...columnNumbers.flatMap((n) => [
      `جز ${toPersianDigits(n)}`,
      `مواد اولیه ${toPersianDigits(n)}`,
      `وزن ${toPersianDigits(n)}`,
    ]),
  ];

  const rows = items.map((item, index) => {
    const entries = entriesByItem[index];
    const triples = columnNumbers.flatMap((n) => {
      const entry = entries[n - 1] as MaterialEntry | undefined;
      return entry
        ? [entry.componentName, entry.materialName, entry.weight]
        : [MISSING_VALUE, MISSING_VALUE, MISSING_VALUE];
    });
    return [...leadingCells(item), ...triples];
  });

  return [header, ...rows];
}

/**
 * Shapes the export set into one of the two grids `exporting-standard-bom.feature` names — a plain
 * `(string | number)[][]`, header row first, ready to hand straight to `XlsxDownloader`. Pure and
 * heavily unit-tested here, mirroring `bom-report-export.ts#buildBomExportGrid`'s own shape with
 * this report's own narrower column set (no date/order fields — a standard BOM is a catalog entry,
 * not a work-order registration) and the بله/خیر active-status rendering.
 */
export function buildStandardBomExportGrid(
  items: readonly AppStandardBomExportItem[],
  format: StandardBomExportFormatKey,
): ExportCell[][] {
  return format === 'perMaterial'
    ? buildOneRowPerMaterialGrid(items)
    : buildOneRowPerBomGrid(items);
}

import { formatJalaliDateTimeInLatinDigits } from '../../core/date/jalali-datetime';
import { buildMaterialWeightColumns } from '../../core/files/material-weight-columns';
import { XlsxCell } from '../../core/files/xlsx-downloader';
import { AppBomExportItem } from '../../core/boms/bom-report-gateway';

/** What a Gherkin table, and this feature's own spreadsheet, both already use for "nothing here" —
 * see `bom-report-detail-dialog.ts`'s own `description || '—'` for the *screen* convention this
 * deliberately does NOT reuse: `exporting-bom.feature`'s worked examples compare the exported file's
 * cells byte-for-byte, and every one of them (a missing description, a padded triple) is a plain
 * hyphen, not an em dash. */
const MISSING_VALUE = '-';

const LEADING_COLUMNS = [
  'شماره سفارش',
  'شماره ردیابی',
  'تاریخ و زمان ثبت',
  'کنترلگر',
  'کد MI',
  'برند',
  'متراژ استاندارد',
  'نام محصول',
  'توضیحات',
] as const;

/** The two row layouts `exporting-bom.feature` names, keyed for `BomsPage`'s export menu — the
 * menu item's own accessible name is this array's `label`, matched exactly against the feature's own
 * quoted format strings. */
export const BOM_EXPORT_FORMATS = [
  { key: 'perMaterial', label: 'هر مواد اولیه یک ردیف' },
  { key: 'perBom', label: 'هر آنالیز روزانه یک ردیف' },
] as const;

export type BomExportFormatKey = (typeof BOM_EXPORT_FORMATS)[number]['key'];

export const BOM_EXPORT_FILE_NAME = 'گزارش-آنالیز-های-روزانه.xlsx';

type ExportCell = XlsxCell;

interface MaterialEntry {
  readonly componentName: string;
  readonly materialName: string;
  readonly weight: number;
}

/** Flattens one BOM's components into its (component, material) entries, in rendered order — the
 * same flattening `bom-report-detail-dialog.ts#toRows` already does for the single-BOM detail
 * table, reproduced here rather than shared because that function returns a *view row* (a `weight`
 * column meant for a `mat-table`), not the plain entry this module folds into two different grid
 * shapes. */
function toMaterialEntries(item: AppBomExportItem): MaterialEntry[] {
  return item.components.flatMap((component) =>
    component.materials.map((material) => ({
      componentName: component.name,
      materialName: material.name,
      weight: material.weight,
    })),
  );
}

function leadingCells(item: AppBomExportItem): ExportCell[] {
  const registeredAt = new Date(item.registeredAt);
  return [
    item.orderNumber,
    item.trackingNumber,
    Number.isNaN(registeredAt.getTime())
      ? MISSING_VALUE
      : formatJalaliDateTimeInLatinDigits(registeredAt),
    item.registeredBy,
    item.standardBomMiCode,
    item.brand,
    item.standardLength,
    item.productName,
    item.description ?? MISSING_VALUE,
  ];
}

function buildOneRowPerMaterialGrid(items: readonly AppBomExportItem[]): ExportCell[][] {
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

/** One column per distinct material-of-component (see `buildMaterialWeightColumns`), headed by that
 * name and holding each BOM's weight for it — empty where the BOM lacks it. */
function buildOneRowPerBomGrid(items: readonly AppBomExportItem[]): ExportCell[][] {
  const { headers, rows: weightCells } = buildMaterialWeightColumns(items.map(toMaterialEntries));

  const header: ExportCell[] = [...LEADING_COLUMNS, ...headers];
  const rows = items.map((item, index) => [...leadingCells(item), ...weightCells[index]]);

  return [header, ...rows];
}

/**
 * Shapes the export set into one of the two grids `exporting-bom.feature` names — a plain
 * `(string | number)[][]`, header row first, ready to hand straight to `XlsxDownloader`. Pure and
 * heavily unit-tested here; `../../core/files/xlsx-downloader.ts` is the one side-effecting collaborator
 * `BomsPage` hands this grid to, and it is injected rather than imported so the page's own spec
 * can substitute it through `TestBed` — jsdom implements neither `URL.createObjectURL` nor a real
 * file-save dialog, the same reason that module's own comment gives for staying untested at that
 * layer.
 */
export function buildBomExportGrid(
  items: readonly AppBomExportItem[],
  format: BomExportFormatKey,
): ExportCell[][] {
  return format === 'perMaterial'
    ? buildOneRowPerMaterialGrid(items)
    : buildOneRowPerBomGrid(items);
}

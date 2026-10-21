import {
  buildComponentMaterialColumns,
  SpreadsheetCell,
  SpreadsheetGrid,
} from '@framework/infrastructure';
import { ManufacturingInstructionExportItem } from '@manufacturing-instructions/application/queries/export-manufacturing-instructions/manufacturing-instruction-export.read-model';

/** The two row layouts the standard-BOM export offers: one row per (component, material) entry,
 * or one row per standard BOM with a (component, material, weight) column triple per material slot. */
export enum StandardBomExportFormat {
  PerMaterial = 'perMaterial',
  PerBom = 'perBom',
}

export const STANDARD_BOM_EXPORT_FILE_NAME = 'گزارش-آنالیز-های-استاندارد.xlsx';

/** A plain hyphen, not an em dash, for "nothing here" — what the exported cell holds for a
 * standard BOM without a description. */
const MISSING_VALUE = '-';

const LEADING_COLUMNS = [
  'کد MI',
  'نام محصول',
  'برند',
  'متراژ استاندارد',
  'فعال',
  'توضیحات',
];

const PER_MATERIAL_COLUMNS = ['نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'];

function formatActive(active: boolean): string {
  return active ? 'بله' : 'خیر';
}

function leadingCells(
  item: ManufacturingInstructionExportItem,
): SpreadsheetCell[] {
  return [
    item.miCode,
    item.productName,
    item.brand,
    item.standardLength,
    formatActive(item.active),
    item.description ?? MISSING_VALUE,
  ];
}

function buildOneRowPerMaterialGrid(
  items: readonly ManufacturingInstructionExportItem[],
): SpreadsheetGrid {
  const rows = items.flatMap((item) => {
    const leading = leadingCells(item);
    return item.components.flatMap((component) =>
      component.materials.map((material) => [
        ...leading,
        component.name,
        material.name,
        material.weight,
      ]),
    );
  });

  return [[...LEADING_COLUMNS, ...PER_MATERIAL_COLUMNS], ...rows];
}

function buildOneRowPerBomGrid(
  items: readonly ManufacturingInstructionExportItem[],
): SpreadsheetGrid {
  const { headers, rows: componentCells } = buildComponentMaterialColumns(
    items.map((item) => item.components),
  );

  const rows = items.map((item, index) => [
    ...leadingCells(item),
    ...componentCells[index],
  ]);

  return [[...LEADING_COLUMNS, ...headers], ...rows];
}

/**
 * Shapes the standard-BOM export set into the grid of the chosen format, header row first, ready
 * for `renderXlsxWorkbook`. Narrower than the daily-BOM export — no order, tracking or
 * registration fields, since a standard BOM is a catalogue entry — and renders `active` as
 * بله/خیر.
 */
export function buildManufacturingInstructionExportGrid(
  items: readonly ManufacturingInstructionExportItem[],
  format: StandardBomExportFormat,
): SpreadsheetGrid {
  return format === StandardBomExportFormat.PerMaterial
    ? buildOneRowPerMaterialGrid(items)
    : buildOneRowPerBomGrid(items);
}

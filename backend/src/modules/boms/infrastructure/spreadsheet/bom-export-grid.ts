import { BomExportItem } from '@boms/application/queries/export-boms/bom-export.read-model';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { formatJalaliDateTime } from '@framework/domain';
import {
  buildComponentMaterialColumns,
  SpreadsheetCell,
  SpreadsheetGrid,
  XlsxWorkbookOptions,
} from '@framework/infrastructure';

/** The two row layouts the daily-BOM export offers: one row per (component, material) entry, or
 * one row per daily BOM with a (component, material, weight) column triple per material slot. */
export enum BomExportFormat {
  PerMaterial = 'perMaterial',
  PerBom = 'perBom',
}

export const BOM_EXPORT_FILE_NAME = 'گزارش-آنالیز-های-روزانه.xlsx';

/** A plain hyphen, not an em dash, for "nothing here" — what the exported cell holds for a
 * daily BOM without a description, or a pending one's reviewer and management note. */
const MISSING_VALUE = '-';

const PER_MATERIAL_LEADING_COLUMNS = [
  'شماره سفارش',
  'شماره ردیابی',
  'تاریخ و زمان ثبت',
  'کنترلگر',
  'کد MI',
  'برند',
  'متراژ استاندارد',
  'نام محصول',
  'توضیحات',
  'وضعیت تایید',
  'تایید/رد کننده',
  'توضیحات مدیریت',
];

const PER_BOM_LEADING_COLUMNS = [
  'شماره سفارش',
  'شماره ردیابی',
  'تاریخ و زمان ثبت',
  'کنترلگر',
  'کد MI',
  'نام محصول',
  'برند',
  'متراژ استاندارد',
  'وزن 1 متر',
  'وزن متراژ استاندارد',
  'اختلاف با استاندارد',
  'توضیحات',
  'وضعیت تایید',
  'تایید/رد کننده',
  'توضیحات مدیریت',
];

/** The computed weights are exact in the read model; only the cell shows them to 2 decimals,
 * still as a number (23 stays 23). */
const COMPUTED_WEIGHT_SCALE = 100;

function computedWeightCell(weight: number): number {
  // `|| 0` turns a rounded -0 into 0.
  return (
    Math.round(weight * COMPUTED_WEIGHT_SCALE) / COMPUTED_WEIGHT_SCALE || 0
  );
}

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.Pending]: 'در انتظار تایید',
  [ApprovalStatus.Approved]: 'تایید',
  [ApprovalStatus.Rejected]: 'عدم تایید',
};

const PER_MATERIAL_COLUMNS = ['نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'];

function reviewCells(item: BomExportItem): SpreadsheetCell[] {
  return [
    APPROVAL_STATUS_LABELS[item.approvalStatus],
    item.reviewedBy ?? MISSING_VALUE,
    // A note of several lines (one per noted edit) is one cell, its lines
    // kept apart by the newlines it is stored with.
    item.managementNote ?? MISSING_VALUE,
  ];
}

function perMaterialLeadingCells(
  item: BomExportItem,
  timeZone: string,
): SpreadsheetCell[] {
  return [
    item.orderNumber,
    item.trackingNumber,
    formatJalaliDateTime(new Date(item.registeredAt), timeZone),
    item.registeredBy,
    item.standardBomMiCode,
    item.brand,
    item.standardLength,
    item.productName,
    item.description ?? MISSING_VALUE,
    ...reviewCells(item),
  ];
}

function perBomLeadingCells(
  item: BomExportItem,
  timeZone: string,
): SpreadsheetCell[] {
  return [
    item.orderNumber,
    item.trackingNumber,
    formatJalaliDateTime(new Date(item.registeredAt), timeZone),
    item.registeredBy,
    item.standardBomMiCode,
    item.productName,
    item.brand,
    item.standardLength,
    computedWeightCell(item.weightPerMeter),
    computedWeightCell(item.standardLengthWeight),
    // No standard BOM left to compare against: nothing to show.
    item.differenceFromStandard === null
      ? MISSING_VALUE
      : computedWeightCell(item.differenceFromStandard),
    item.description ?? MISSING_VALUE,
    ...reviewCells(item),
  ];
}

function buildOneRowPerMaterialGrid(
  items: readonly BomExportItem[],
  timeZone: string,
): SpreadsheetGrid {
  const rows = items.flatMap((item) => {
    const leading = perMaterialLeadingCells(item, timeZone);
    return item.components.flatMap((component) =>
      component.materials.map((material) => [
        ...leading,
        component.name,
        material.name,
        material.weight,
      ]),
    );
  });

  return [[...PER_MATERIAL_LEADING_COLUMNS, ...PER_MATERIAL_COLUMNS], ...rows];
}

function buildOneRowPerBomGrid(
  items: readonly BomExportItem[],
  timeZone: string,
): SpreadsheetGrid {
  const { headers, rows: componentCells } = buildComponentMaterialColumns(
    items.map((item) => item.components),
  );

  const rows = items.map((item, index) => [
    ...perBomLeadingCells(item, timeZone),
    ...componentCells[index],
  ]);

  return [[...PER_BOM_LEADING_COLUMNS, ...headers], ...rows];
}

/**
 * Shapes the daily-BOM export set into the grid of the chosen format, header row first, ready for
 * `renderXlsxWorkbook`. The registration time is written as a Jalali date-time in `timeZone`, the
 * reader's own IANA zone.
 */
export function buildBomExportGrid(
  items: readonly BomExportItem[],
  format: BomExportFormat,
  timeZone: string,
): SpreadsheetGrid {
  return format === BomExportFormat.PerMaterial
    ? buildOneRowPerMaterialGrid(items, timeZone)
    : buildOneRowPerBomGrid(items, timeZone);
}

/**
 * How the chosen format's sheet is laid out: the "perBom" sheet reads right to left, as a Persian
 * reader expects; the "perMaterial" sheet keeps its original left-to-right layout.
 */
export function bomExportWorkbookOptions(
  format: BomExportFormat,
): XlsxWorkbookOptions {
  return { rightToLeft: format === BomExportFormat.PerBom };
}

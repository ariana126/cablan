import { BomExportItem } from '@boms/application/queries/export-boms/bom-export.read-model';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import {
  buildComponentMaterialColumns,
  formatJalaliDateTime,
  SpreadsheetCell,
  SpreadsheetGrid,
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
  'وضعیت تایید',
  'تایید/رد کننده',
  'توضیحات مدیریت',
];

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.Pending]: 'در انتظار تایید',
  [ApprovalStatus.Approved]: 'تایید',
  [ApprovalStatus.Rejected]: 'عدم تایید',
};

const PER_MATERIAL_COLUMNS = ['نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'];

function leadingCells(
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
    APPROVAL_STATUS_LABELS[item.approvalStatus],
    item.reviewedBy ?? MISSING_VALUE,
    // A note of several lines (one per noted edit) is one cell, its lines
    // kept apart by the newlines it is stored with.
    item.managementNote ?? MISSING_VALUE,
  ];
}

function buildOneRowPerMaterialGrid(
  items: readonly BomExportItem[],
  timeZone: string,
): SpreadsheetGrid {
  const rows = items.flatMap((item) => {
    const leading = leadingCells(item, timeZone);
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
  items: readonly BomExportItem[],
  timeZone: string,
): SpreadsheetGrid {
  const { headers, rows: componentCells } = buildComponentMaterialColumns(
    items.map((item) => item.components),
  );

  const rows = items.map((item, index) => [
    ...leadingCells(item, timeZone),
    ...componentCells[index],
  ]);

  return [[...LEADING_COLUMNS, ...headers], ...rows];
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

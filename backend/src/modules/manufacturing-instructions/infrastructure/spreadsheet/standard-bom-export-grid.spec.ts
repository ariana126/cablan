import { ManufacturingInstructionExportItem } from '@manufacturing-instructions/application/queries/export-manufacturing-instructions/manufacturing-instruction-export.read-model';

import {
  buildManufacturingInstructionExportGrid,
  StandardBomExportFormat,
} from './standard-bom-export-grid';

/**
 * Two standard BOMs: the first active with three (component, material) entries, the second
 * inactive with one and no description. The expected grids are written out by hand.
 */
const mi1001: ManufacturingInstructionExportItem = {
  miCode: '1001',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  brand: 'لگراند',
  standardLength: 305,
  active: true,
  description: 'بررسی کیفیت اولیه',
  components: [
    {
      name: 'مغزی',
      materials: [
        { name: 'مسی', weight: 10 },
        { name: 'آلومینیوم', weight: 5 },
      ],
    },
    { name: 'روکش', materials: [{ name: 'مسی', weight: 8 }] },
  ],
};

const mi1002: ManufacturingInstructionExportItem = {
  miCode: '1002',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  brand: 'لگراند',
  standardLength: 500,
  active: false,
  description: null,
  components: [
    { name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] },
  ],
};

const LEADING_HEADERS = [
  'کد MI',
  'نام محصول',
  'برند',
  'متراژ استاندارد',
  'فعال',
  'توضیحات',
];

const MI_1001_LEADING = [
  '1001',
  'کابل شبکه U/UTP 0.42 LEGRAND',
  'لگراند',
  305,
  'بله',
  'بررسی کیفیت اولیه',
];

const MI_1002_LEADING = [
  '1002',
  'کابل شبکه U/UTP 0.42 LEGRAND',
  'لگراند',
  500,
  'خیر',
  '-',
];

describe('buildManufacturingInstructionExportGrid', () => {
  it('shapes one row per (component, material) entry in the "perMaterial" format', () => {
    const grid = buildManufacturingInstructionExportGrid(
      [mi1001, mi1002],
      StandardBomExportFormat.PerMaterial,
    );

    expect(grid).toEqual([
      [...LEADING_HEADERS, 'نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'],
      [...MI_1001_LEADING, 'مغزی', 'مسی', 10],
      [...MI_1001_LEADING, 'مغزی', 'آلومینیوم', 5],
      [...MI_1001_LEADING, 'روکش', 'مسی', 8],
      [...MI_1002_LEADING, 'روکش', 'آلومینیوم', 12],
    ]);
  });

  it('gives each component a numbered (material, weight) pair per material slot in the "perBom" format, empty where a BOM lacks it', () => {
    const grid = buildManufacturingInstructionExportGrid(
      [mi1001, mi1002],
      StandardBomExportFormat.PerBom,
    );

    expect(grid).toEqual([
      [
        ...LEADING_HEADERS,
        'نوع مواد اولیه مغزی ۱',
        'وزن مغزی ۱',
        'نوع مواد اولیه مغزی ۲',
        'وزن مغزی ۲',
        'نوع مواد اولیه روکش',
        'وزن روکش',
      ],
      [...MI_1001_LEADING, 'مسی', 10, 'آلومینیوم', 5, 'مسی', 8],
      [...MI_1002_LEADING, '', '', '', '', 'آلومینیوم', 12],
    ]);
  });

  it('only has columns for the exported items in the "perBom" format', () => {
    const grid = buildManufacturingInstructionExportGrid(
      [mi1002],
      StandardBomExportFormat.PerBom,
    );

    expect(grid[0].slice(6)).toEqual(['نوع مواد اولیه روکش', 'وزن روکش']);
    expect(grid[1].slice(6)).toEqual(['آلومینیوم', 12]);
  });

  it('produces only a header row when there is nothing to export', () => {
    expect(
      buildManufacturingInstructionExportGrid(
        [],
        StandardBomExportFormat.PerMaterial,
      ),
    ).toEqual([
      [...LEADING_HEADERS, 'نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'],
    ]);
    expect(
      buildManufacturingInstructionExportGrid(
        [],
        StandardBomExportFormat.PerBom,
      ),
    ).toEqual([LEADING_HEADERS]);
  });
});

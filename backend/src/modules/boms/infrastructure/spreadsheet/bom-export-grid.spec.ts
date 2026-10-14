import { BomExportItem } from '@boms/application/queries/export-boms/bom-export.read-model';

import { BomExportFormat, buildBomExportGrid } from './bom-export-grid';

/**
 * Two daily BOMs: the first with three (component, material) entries, the second with one and no
 * description. The expected grids are written out by hand, not recomputed.
 */
const ord2001: BomExportItem = {
  orderNumber: 'ORD-2001',
  trackingNumber: 'TRK-3001',
  registeredAt: '2024-06-21T08:30:00.000Z',
  registeredBy: 'نیکروش',
  standardBomMiCode: '1001',
  brand: 'لگراند',
  standardLength: 305,
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
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

const ord2002: BomExportItem = {
  orderNumber: 'ORD-2002',
  trackingNumber: 'TRK-3002',
  registeredAt: '2024-06-25T14:00:00.000Z',
  registeredBy: 'مصطفی',
  standardBomMiCode: '1002',
  brand: 'لگراند',
  standardLength: 500,
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  description: null,
  components: [
    { name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] },
  ],
};

const LEADING_HEADERS = [
  'شماره سفارش',
  'شماره ردیابی',
  'تاریخ و زمان ثبت',
  'کنترلگر',
  'کد MI',
  'برند',
  'متراژ استاندارد',
  'نام محصول',
  'توضیحات',
];

describe('buildBomExportGrid', () => {
  it('shapes one row per (component, material) entry in the "perMaterial" format', () => {
    const grid = buildBomExportGrid(
      [ord2001, ord2002],
      BomExportFormat.PerMaterial,
      'UTC',
    );

    expect(grid).toEqual([
      [...LEADING_HEADERS, 'نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'],
      [
        'ORD-2001',
        'TRK-3001',
        '1403/04/01 08:30',
        'نیکروش',
        '1001',
        'لگراند',
        305,
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'بررسی کیفیت اولیه',
        'مغزی',
        'مسی',
        10,
      ],
      [
        'ORD-2001',
        'TRK-3001',
        '1403/04/01 08:30',
        'نیکروش',
        '1001',
        'لگراند',
        305,
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'بررسی کیفیت اولیه',
        'مغزی',
        'آلومینیوم',
        5,
      ],
      [
        'ORD-2001',
        'TRK-3001',
        '1403/04/01 08:30',
        'نیکروش',
        '1001',
        'لگراند',
        305,
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'بررسی کیفیت اولیه',
        'روکش',
        'مسی',
        8,
      ],
      [
        'ORD-2002',
        'TRK-3002',
        '1403/04/05 14:00',
        'مصطفی',
        '1002',
        'لگراند',
        500,
        'کابل شبکه U/UTP 0.42 LEGRAND',
        '-',
        'روکش',
        'آلومینیوم',
        12,
      ],
    ]);
  });

  it('gives each component a numbered (material, weight) pair per material slot in the "perBom" format, empty where a BOM lacks it', () => {
    const grid = buildBomExportGrid(
      [ord2001, ord2002],
      BomExportFormat.PerBom,
      'UTC',
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
      [
        'ORD-2001',
        'TRK-3001',
        '1403/04/01 08:30',
        'نیکروش',
        '1001',
        'لگراند',
        305,
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'بررسی کیفیت اولیه',
        'مسی',
        10,
        'آلومینیوم',
        5,
        'مسی',
        8,
      ],
      [
        'ORD-2002',
        'TRK-3002',
        '1403/04/05 14:00',
        'مصطفی',
        '1002',
        'لگراند',
        500,
        'کابل شبکه U/UTP 0.42 LEGRAND',
        '-',
        '',
        '',
        '',
        '',
        'آلومینیوم',
        12,
      ],
    ]);
  });

  it('keeps the standard BOM\'s component order in the "perBom" format even when a BOM lacking the first component is listed first', () => {
    const grid = buildBomExportGrid(
      [ord2002, ord2001],
      BomExportFormat.PerBom,
      'UTC',
    );

    expect(grid[0].slice(9)).toEqual([
      'نوع مواد اولیه مغزی ۱',
      'وزن مغزی ۱',
      'نوع مواد اولیه مغزی ۲',
      'وزن مغزی ۲',
      'نوع مواد اولیه روکش',
      'وزن روکش',
    ]);
    expect(grid[1].slice(9)).toEqual(['', '', '', '', 'آلومینیوم', 12]);
  });

  it('only has columns for the exported items in the "perBom" format', () => {
    const grid = buildBomExportGrid([ord2002], BomExportFormat.PerBom, 'UTC');

    expect(grid[0].slice(9)).toEqual(['نوع مواد اولیه روکش', 'وزن روکش']);
    expect(grid[1].slice(9)).toEqual(['آلومینیوم', 12]);
  });

  it('writes the registration time in the reader’s own time zone', () => {
    const grid = buildBomExportGrid(
      [ord2001],
      BomExportFormat.PerBom,
      'Asia/Tehran',
    );

    expect(grid[1][2]).toBe('1403/04/01 12:00');
  });

  it('produces only a header row when there is nothing to export', () => {
    expect(buildBomExportGrid([], BomExportFormat.PerMaterial, 'UTC')).toEqual([
      [...LEADING_HEADERS, 'نام جز', 'نام مواد اولیه', 'وزن مواد اولیه'],
    ]);
    expect(buildBomExportGrid([], BomExportFormat.PerBom, 'UTC')).toEqual([
      LEADING_HEADERS,
    ]);
  });
});

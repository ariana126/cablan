import { BomExportItem } from '@boms/application/queries/export-boms/bom-export.read-model';
import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { BomExportFormat, buildBomExportGrid } from './bom-export-grid';

// An approval's management note: the edits by any reviewer, one line each.
const NOTE = [
  'وزن جز مغزی مواد اولیه مسی از 12 به 10 تغییر کرد',
  'وزن جز روکش مواد اولیه مسی از 9 به 8 تغییر کرد',
].join('\n');

/**
 * Two daily BOMs: the first, approved with a two-line note, with three (component, material) entries, the second pending, with one and
 * no description. The expected grids are written out by hand, not recomputed.
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
  approvalStatus: ApprovalStatus.Approved,
  reviewedBy: 'مصطفی',
  managementNote: NOTE,
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
  approvalStatus: ApprovalStatus.Pending,
  reviewedBy: null,
  managementNote: null,
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
  'وضعیت تایید',
  'تایید/رد کننده',
  'توضیحات مدیریت',
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
        'تایید',
        'مصطفی',
        NOTE,
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
        'تایید',
        'مصطفی',
        NOTE,
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
        'تایید',
        'مصطفی',
        NOTE,
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
        'در انتظار تایید',
        '-',
        '-',
        'روکش',
        'آلومینیوم',
        12,
      ],
    ]);
  });

  it('gives each material line a numbered (component, material, weight) slot in the "perBom" format, padding missing slots with -', () => {
    const grid = buildBomExportGrid(
      [ord2001, ord2002],
      BomExportFormat.PerBom,
      'UTC',
    );

    expect(grid).toEqual([
      [
        ...LEADING_HEADERS,
        'جز ۱',
        'مواد اولیه ۱',
        'وزن ۱',
        'جز ۲',
        'مواد اولیه ۲',
        'وزن ۲',
        'جز ۳',
        'مواد اولیه ۳',
        'وزن ۳',
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
        'تایید',
        'مصطفی',
        NOTE,
        'مغزی',
        'مسی',
        10,
        'مغزی',
        'آلومینیوم',
        5,
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
        'در انتظار تایید',
        '-',
        '-',
        'روکش',
        'آلومینیوم',
        12,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
      ],
    ]);
  });

  it.each([[BomExportFormat.PerMaterial], [BomExportFormat.PerBom]])(
    'shows a rejected daily BOM with its reviewer and reason in the %p format',
    (format) => {
      const rejected: BomExportItem = {
        ...ord2002,
        approvalStatus: ApprovalStatus.Rejected,
        reviewedBy: 'یاشار',
        managementNote: 'وزن آلومینیوم خارج از محدوده است',
      };

      const grid = buildBomExportGrid([rejected], format, 'UTC');

      expect(grid[1].slice(9, 12)).toEqual([
        'عدم تایید',
        'یاشار',
        'وزن آلومینیوم خارج از محدوده است',
      ]);
    },
  );

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

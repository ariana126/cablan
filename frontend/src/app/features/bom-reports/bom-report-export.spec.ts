import { describe, expect, it } from 'vitest';

import { AppBomExportItem } from '../../core/boms/bom-report-gateway';
import { buildBomExportGrid } from './bom-report-export';

/**
 * Fixture mirrors `exporting-bom.feature`'s own background exactly — two daily BOMs, the first with
 * three (component, material) entries, the second with one and no description — so the expected
 * grids below are transcribed straight from that feature's two worked examples rather than
 * recomputed from the algorithm under test.
 */
const ord2001: AppBomExportItem = {
  orderNumber: 'ORD-2001',
  trackingNumber: 'TRK-3001',
  registeredAt: '2024-06-21T08:30:00.000Z', // 1403/04/01 08:30
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

const ord2002: AppBomExportItem = {
  orderNumber: 'ORD-2002',
  trackingNumber: 'TRK-3002',
  registeredAt: '2024-06-25T14:00:00.000Z', // 1403/04/05 14:00
  registeredBy: 'مصطفی',
  standardBomMiCode: '1002',
  brand: 'لگراند',
  standardLength: 500,
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  description: null,
  components: [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
};

describe('buildBomExportGrid', () => {
  it('shapes one row per (component, material) entry in the "perMaterial" format', () => {
    const grid = buildBomExportGrid([ord2001, ord2002], 'perMaterial');

    expect(grid).toEqual([
      [
        'شماره سفارش',
        'شماره ردیابی',
        'تاریخ و زمان ثبت',
        'کنترلگر',
        'کد MI',
        'برند',
        'متراژ استاندارد',
        'نام محصول',
        'توضیحات',
        'نام جز',
        'نام مواد اولیه',
        'وزن مواد اولیه',
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

  it('pads a BOM with fewer entries than the widest one with "-" triples in the "perBom" format', () => {
    const grid = buildBomExportGrid([ord2001, ord2002], 'perBom');

    expect(grid).toEqual([
      [
        'شماره سفارش',
        'شماره ردیابی',
        'تاریخ و زمان ثبت',
        'کنترلگر',
        'کد MI',
        'برند',
        'متراژ استاندارد',
        'نام محصول',
        'توضیحات',
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

  it('widens the "perBom" header to the largest entry count among only the exported items', () => {
    const grid = buildBomExportGrid([ord2002], 'perBom');

    expect(grid[0]).toEqual([
      'شماره سفارش',
      'شماره ردیابی',
      'تاریخ و زمان ثبت',
      'کنترلگر',
      'کد MI',
      'برند',
      'متراژ استاندارد',
      'نام محصول',
      'توضیحات',
      'جز ۱',
      'مواد اولیه ۱',
      'وزن ۱',
    ]);
  });

  it('produces only a header row when there is nothing to export', () => {
    expect(buildBomExportGrid([], 'perMaterial')).toEqual([
      [
        'شماره سفارش',
        'شماره ردیابی',
        'تاریخ و زمان ثبت',
        'کنترلگر',
        'کد MI',
        'برند',
        'متراژ استاندارد',
        'نام محصول',
        'توضیحات',
        'نام جز',
        'نام مواد اولیه',
        'وزن مواد اولیه',
      ],
    ]);
    expect(buildBomExportGrid([], 'perBom')).toEqual([
      [
        'شماره سفارش',
        'شماره ردیابی',
        'تاریخ و زمان ثبت',
        'کنترلگر',
        'کد MI',
        'برند',
        'متراژ استاندارد',
        'نام محصول',
        'توضیحات',
      ],
    ]);
  });
});

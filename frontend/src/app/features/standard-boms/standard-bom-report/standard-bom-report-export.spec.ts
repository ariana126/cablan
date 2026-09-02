import { describe, expect, it } from 'vitest';

import { AppStandardBomExportItem } from '../../../core/standard-boms/standard-bom-report-gateway';
import { buildStandardBomExportGrid } from './standard-bom-report-export';

/**
 * Fixture mirrors `exporting-standard-bom.feature`'s own background exactly — two standard BOMs,
 * the first with three (component, material) entries, the second with one and no description — so
 * the expected grids below are transcribed straight from that feature's two worked examples rather
 * than recomputed from the algorithm under test.
 */
const mi1001: AppStandardBomExportItem = {
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

const mi1002: AppStandardBomExportItem = {
  miCode: '1002',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  brand: 'لگراند',
  standardLength: 500,
  active: false,
  description: null,
  components: [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
};

describe('buildStandardBomExportGrid', () => {
  it('shapes one row per (component, material) entry in the "perMaterial" format', () => {
    const grid = buildStandardBomExportGrid([mi1001, mi1002], 'perMaterial');

    expect(grid).toEqual([
      [
        'کد MI',
        'نام محصول',
        'برند',
        'متراژ استاندارد',
        'فعال',
        'توضیحات',
        'نام جز',
        'نام مواد اولیه',
        'وزن مواد اولیه',
      ],
      [
        '1001',
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'لگراند',
        305,
        'بله',
        'بررسی کیفیت اولیه',
        'مغزی',
        'مسی',
        10,
      ],
      [
        '1001',
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'لگراند',
        305,
        'بله',
        'بررسی کیفیت اولیه',
        'مغزی',
        'آلومینیوم',
        5,
      ],
      [
        '1001',
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'لگراند',
        305,
        'بله',
        'بررسی کیفیت اولیه',
        'روکش',
        'مسی',
        8,
      ],
      ['1002', 'کابل شبکه U/UTP 0.42 LEGRAND', 'لگراند', 500, 'خیر', '-', 'روکش', 'آلومینیوم', 12],
    ]);
  });

  it('pads a BOM with fewer entries than the widest one with "-" triples in the "perBom" format', () => {
    const grid = buildStandardBomExportGrid([mi1001, mi1002], 'perBom');

    expect(grid).toEqual([
      [
        'کد MI',
        'نام محصول',
        'برند',
        'متراژ استاندارد',
        'فعال',
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
        '1001',
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'لگراند',
        305,
        'بله',
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
        '1002',
        'کابل شبکه U/UTP 0.42 LEGRAND',
        'لگراند',
        500,
        'خیر',
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
    const grid = buildStandardBomExportGrid([mi1002], 'perBom');

    expect(grid[0]).toEqual([
      'کد MI',
      'نام محصول',
      'برند',
      'متراژ استاندارد',
      'فعال',
      'توضیحات',
      'جز ۱',
      'مواد اولیه ۱',
      'وزن ۱',
    ]);
  });

  it('produces only a header row when there is nothing to export', () => {
    expect(buildStandardBomExportGrid([], 'perMaterial')).toEqual([
      [
        'کد MI',
        'نام محصول',
        'برند',
        'متراژ استاندارد',
        'فعال',
        'توضیحات',
        'نام جز',
        'نام مواد اولیه',
        'وزن مواد اولیه',
      ],
    ]);
    expect(buildStandardBomExportGrid([], 'perBom')).toEqual([
      ['کد MI', 'نام محصول', 'برند', 'متراژ استاندارد', 'فعال', 'توضیحات'],
    ]);
  });
});

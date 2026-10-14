import { buildComponentMaterialColumns } from './component-material-columns';

function component(name: string) {
  return { name, materials: [{ name: 'مسی', weight: 1 }] };
}

describe('buildComponentMaterialColumns', () => {
  it('gives a single-material component one unnumbered (material, weight) pair', () => {
    const { headers, rows } = buildComponentMaterialColumns([
      [{ name: 'روکش', materials: [{ name: 'مسی', weight: 8 }] }],
    ]);

    expect(headers).toEqual(['نوع مواد اولیه روکش', 'وزن روکش']);
    expect(rows).toEqual([['مسی', 8]]);
  });

  it('numbers every pair of a multi-material component in Persian digits, in material order', () => {
    const { headers, rows } = buildComponentMaterialColumns([
      [
        {
          name: 'مغزی',
          materials: [
            { name: 'مسی', weight: 10 },
            { name: 'آلومینیوم', weight: 5 },
          ],
        },
      ],
    ]);

    expect(headers).toEqual([
      'نوع مواد اولیه مغزی ۱',
      'وزن مغزی ۱',
      'نوع مواد اولیه مغزی ۲',
      'وزن مغزی ۲',
    ]);
    expect(rows).toEqual([['مسی', 10, 'آلومینیوم', 5]]);
  });

  it('sizes a component by the most materials it has in any row, blanking the slots a row lacks', () => {
    const { headers, rows } = buildComponentMaterialColumns([
      [{ name: 'مغزی', materials: [{ name: 'مسی', weight: 10 }] }],
      [
        {
          name: 'مغزی',
          materials: [
            { name: 'مسی', weight: 9 },
            { name: 'آلومینیوم', weight: 4 },
          ],
        },
      ],
    ]);

    expect(headers).toEqual([
      'نوع مواد اولیه مغزی ۱',
      'وزن مغزی ۱',
      'نوع مواد اولیه مغزی ۲',
      'وزن مغزی ۲',
    ]);
    expect(rows).toEqual([
      ['مسی', 10, '', ''],
      ['مسی', 9, 'آلومینیوم', 4],
    ]);
  });

  it('leaves both cells of a component a row lacks empty', () => {
    const { headers, rows } = buildComponentMaterialColumns([
      [
        { name: 'مغزی', materials: [{ name: 'مسی', weight: 10 }] },
        { name: 'روکش', materials: [{ name: 'مسی', weight: 8 }] },
      ],
      [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
    ]);

    expect(headers).toEqual([
      'نوع مواد اولیه مغزی',
      'وزن مغزی',
      'نوع مواد اولیه روکش',
      'وزن روکش',
    ]);
    expect(rows).toEqual([
      ['مسی', 10, 'مسی', 8],
      ['', '', 'آلومینیوم', 12],
    ]);
  });

  it('orders components as each row defines them, even when a later row introduces an earlier one', () => {
    const { headers } = buildComponentMaterialColumns([
      [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
      [
        { name: 'مغزی', materials: [{ name: 'مسی', weight: 10 }] },
        { name: 'روکش', materials: [{ name: 'مسی', weight: 8 }] },
      ],
    ]);

    expect(headers).toEqual([
      'نوع مواد اولیه مغزی',
      'وزن مغزی',
      'نوع مواد اولیه روکش',
      'وزن روکش',
    ]);
  });

  it('places a newly seen component right after its nearest preceding already-placed one', () => {
    const { headers } = buildComponentMaterialColumns([
      [component('الف'), component('ج')],
      [component('الف'), component('ب'), component('ج')],
      [component('د'), component('ج'), component('ه')],
    ]);

    expect(headers.filter((header) => header.startsWith('وزن '))).toEqual([
      'وزن الف',
      'وزن ب',
      'وزن د',
      'وزن ج',
      'وزن ه',
    ]);
  });

  it('appends a component that shares nothing with what is already placed', () => {
    const { headers } = buildComponentMaterialColumns([
      [{ name: 'مغزی', materials: [{ name: 'مسی', weight: 10 }] }],
      [{ name: 'زره', materials: [{ name: 'فولاد', weight: 3 }] }],
    ]);

    expect(headers).toEqual([
      'نوع مواد اولیه مغزی',
      'وزن مغزی',
      'نوع مواد اولیه زره',
      'وزن زره',
    ]);
  });

  it('gathers the materials of a component listed twice under one name into its slots', () => {
    const { headers, rows } = buildComponentMaterialColumns([
      [
        { name: 'مغزی', materials: [{ name: 'مسی', weight: 10 }] },
        { name: 'مغزی', materials: [{ name: 'قلع', weight: 2 }] },
      ],
    ]);

    expect(headers).toEqual([
      'نوع مواد اولیه مغزی ۱',
      'وزن مغزی ۱',
      'نوع مواد اولیه مغزی ۲',
      'وزن مغزی ۲',
    ]);
    expect(rows).toEqual([['مسی', 10, 'قلع', 2]]);
  });

  it('numbers slots past nine with every digit in Persian', () => {
    const materials = Array.from({ length: 10 }, (_, index) => ({
      name: 'مسی',
      weight: index,
    }));
    const { headers } = buildComponentMaterialColumns([
      [{ name: 'مغزی', materials }],
    ]);

    expect(headers.slice(-2)).toEqual([
      'نوع مواد اولیه مغزی ۱۰',
      'وزن مغزی ۱۰',
    ]);
  });

  it('has no columns when there is nothing to lay out', () => {
    expect(buildComponentMaterialColumns([])).toEqual({
      headers: [],
      rows: [],
    });
    expect(buildComponentMaterialColumns([[]])).toEqual({
      headers: [],
      rows: [[]],
    });
  });
});

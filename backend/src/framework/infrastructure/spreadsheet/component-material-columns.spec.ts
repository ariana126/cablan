import { buildComponentMaterialColumns } from './component-material-columns';

describe('buildComponentMaterialColumns', () => {
  it('gives each material line a (component, material, weight) slot, numbered in Persian digits', () => {
    const { headers, rows } = buildComponentMaterialColumns([
      [
        {
          name: 'مغزی',
          materials: [
            { name: 'مسی', weight: 10 },
            { name: 'آلومینیوم', weight: 5 },
          ],
        },
        { name: 'روکش', materials: [{ name: 'مسی', weight: 8 }] },
      ],
    ]);

    expect(headers).toEqual([
      'جز ۱',
      'مواد اولیه ۱',
      'وزن ۱',
      'جز ۲',
      'مواد اولیه ۲',
      'وزن ۲',
      'جز ۳',
      'مواد اولیه ۳',
      'وزن ۳',
    ]);
    expect(rows).toEqual([
      ['مغزی', 'مسی', 10, 'مغزی', 'آلومینیوم', 5, 'روکش', 'مسی', 8],
    ]);
  });

  it('has as many slots as the row with the most material lines, padding the others with -', () => {
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
      [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
    ]);

    expect(headers).toHaveLength(6);
    expect(rows).toEqual([
      ['مغزی', 'مسی', 10, 'مغزی', 'آلومینیوم', 5],
      ['روکش', 'آلومینیوم', 12, '-', '-', '-'],
    ]);
  });

  it('numbers slots past nine with every digit in Persian', () => {
    const materials = Array.from({ length: 10 }, (_, index) => ({
      name: 'مسی',
      weight: index + 1,
    }));
    const { headers } = buildComponentMaterialColumns([
      [{ name: 'مغزی', materials }],
    ]);

    expect(headers.slice(-3)).toEqual(['جز ۱۰', 'مواد اولیه ۱۰', 'وزن ۱۰']);
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

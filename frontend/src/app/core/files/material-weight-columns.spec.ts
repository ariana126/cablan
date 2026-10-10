import { describe, expect, it } from 'vitest';

import { buildMaterialWeightColumns } from './material-weight-columns';

describe('buildMaterialWeightColumns', () => {
  it('makes one column per distinct material-of-component, headed by its own name', () => {
    const { headers, rows } = buildMaterialWeightColumns([
      [{ componentName: 'هادی ۱', materialName: 'مس', weight: 5 }],
      [{ componentName: 'هادی ۲', materialName: 'عایق', weight: 9.3 }],
    ]);

    expect(headers).toEqual(['مس هادی ۱', 'عایق هادی ۲']);
    expect(rows).toEqual([
      [5, ''],
      ['', 9.3],
    ]);
  });

  it('shares a column between BOMs that hold the same material of the same component', () => {
    const { headers, rows } = buildMaterialWeightColumns([
      [{ componentName: 'هادی ۱', materialName: 'مس', weight: 5 }],
      [{ componentName: 'هادی ۱', materialName: 'مس', weight: 7 }],
    ]);

    expect(headers).toEqual(['مس هادی ۱']);
    expect(rows).toEqual([[5], [7]]);
  });

  it('keeps the same material under different components apart', () => {
    const { headers } = buildMaterialWeightColumns([
      [
        { componentName: 'هادی ۱', materialName: 'مس', weight: 5 },
        { componentName: 'هادی ۲', materialName: 'مس', weight: 6 },
      ],
    ]);

    expect(headers).toEqual(['مس هادی ۱', 'مس هادی ۲']);
  });

  it('sums the weights of one pair repeated within a BOM', () => {
    const { rows } = buildMaterialWeightColumns([
      [
        { componentName: 'هادی', materialName: 'مس', weight: 5 },
        { componentName: 'هادی', materialName: 'مس', weight: 2 },
      ],
    ]);

    expect(rows).toEqual([[7]]);
  });

  it('has no columns when there is nothing to lay out', () => {
    expect(buildMaterialWeightColumns([])).toEqual({ headers: [], rows: [] });
    expect(buildMaterialWeightColumns([[]])).toEqual({ headers: [], rows: [[]] });
  });
});

import { describe, expect, it } from 'vitest';

import { AppBomDashboardDailyBom } from './bom-dashboard-gateway';
import { materialWeightEdit } from './material-weight-edit';

const dailyBom: AppBomDashboardDailyBom = {
  id: 'bom-1',
  orderNumber: 'ORD-5002',
  trackingNumber: 'TRK-6002',
  registeredAt: '2026-06-22T04:00:00.000Z',
  registeredBy: 'نیکروش',
  description: '',
  standardBomMiCode: '1001',
  approvalStatus: 'approved',
  reviewedBy: 'مصطفی',
  managementNote: null,
  lines: [
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm1',
      materialName: 'مسی',
      actualWeight: 3,
      standardWeight: 3,
      difference: 0,
    },
    {
      componentId: 'c2',
      componentName: 'روکش',
      materialId: 'm2',
      materialName: 'آلومینیوم',
      actualWeight: 6,
      standardWeight: 5,
      difference: 1,
    },
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm2',
      materialName: 'آلومینیوم',
      actualWeight: 1,
      standardWeight: 1,
      difference: 0,
    },
  ],
};

describe('materialWeightEdit', () => {
  it("sends the BOM's standard BOM MI code and its whole composition, grouped by component", () => {
    const edit = materialWeightEdit(dailyBom, { componentId: 'c2', materialId: 'm2' }, 6);

    expect(edit).toEqual({
      standardBomMiCode: '1001',
      components: [
        {
          componentId: 'c1',
          materials: [
            { materialId: 'm1', weight: 3 },
            { materialId: 'm2', weight: 1 },
          ],
        },
        { componentId: 'c2', materials: [{ materialId: 'm2', weight: 6 }] },
      ],
    });
  });

  it('replaces the weight of exactly the one edited line, leaving the same material elsewhere alone', () => {
    const edit = materialWeightEdit(dailyBom, { componentId: 'c1', materialId: 'm2' }, 2.5);

    expect(edit.components).toEqual([
      {
        componentId: 'c1',
        materials: [
          { materialId: 'm1', weight: 3 },
          { materialId: 'm2', weight: 2.5 },
        ],
      },
      { componentId: 'c2', materials: [{ materialId: 'm2', weight: 6 }] },
    ]);
  });

  it('sends nothing else — no order number, tracking number or description to overwrite', () => {
    const edit = materialWeightEdit(dailyBom, { componentId: 'c1', materialId: 'm1' }, 2);

    expect(Object.keys(edit).sort()).toEqual(['components', 'standardBomMiCode']);
  });
});

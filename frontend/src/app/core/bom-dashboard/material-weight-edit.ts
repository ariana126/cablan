import { UpdateBomDto } from '../../api/model';
import { AppBomDashboardDailyBom } from './bom-dashboard-gateway';

/** Which line of a daily BOM is being corrected: a material within a component. */
export interface MaterialLineKey {
  readonly componentId: string;
  readonly materialId: string;
}

/**
 * The `PATCH /boms/:id` body that changes one material line's weight from the dashboard.
 *
 * The API edits a daily BOM's composition only as a whole — `components` replaces the old list —
 * so the body re-sends every line the dashboard holds, grouped by component in the order the lines
 * arrived, with exactly the edited line's weight replaced. `standardBomMiCode` names the standard
 * BOM the composition is checked against. Nothing else is sent, so the order number, tracking
 * number and description are left as they are.
 */
export function materialWeightEdit(
  bom: AppBomDashboardDailyBom,
  edited: MaterialLineKey,
  weight: number,
): UpdateBomDto & Required<Pick<UpdateBomDto, 'standardBomMiCode' | 'components'>> {
  const byComponent = new Map<string, { materialId: string; weight: number }[]>();
  for (const line of bom.lines) {
    const isEdited =
      line.componentId === edited.componentId && line.materialId === edited.materialId;
    const materials = byComponent.get(line.componentId) ?? [];
    materials.push({ materialId: line.materialId, weight: isEdited ? weight : line.actualWeight });
    byComponent.set(line.componentId, materials);
  }

  return {
    standardBomMiCode: bom.standardBomMiCode,
    components: [...byComponent].map(([componentId, materials]) => ({ componentId, materials })),
  };
}

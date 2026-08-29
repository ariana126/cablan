import { Identity } from '@framework/domain';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

import { GetStandardBomDetailHandler } from './get-standard-bom-detail.handler';
import { GetStandardBomDetailQuery } from './get-standard-bom-detail.query';

describe('getStandardBomDetailHandler', () => {
  it('returns the standard BOM detail with composition and total weight', async () => {
    const standardBom = makeStandardBom({
      id: 'bom-1',
      miCode: '1001',
      brand: 'Legrand',
      productName: 'Product 1',
      standardLength: 305,
      active: true,
      description: 'desc',
      components: [
        {
          componentId: 'comp-1',
          name: 'Core',
          materials: [
            { materialId: 'mat-1', name: 'Copper', weight: 10 },
            { materialId: 'mat-2', name: 'Aluminium', weight: 5 },
          ],
        },
        {
          componentId: 'comp-2',
          name: 'Sheath',
          materials: [{ materialId: 'mat-3', name: 'Copper', weight: 8 }],
        },
      ],
    });
    const repository = {
      findByMiCode: jest.fn().mockResolvedValue(standardBom),
    };
    const sut = new GetStandardBomDetailHandler(repository as any);

    const result = await sut.execute(new GetStandardBomDetailQuery('1001'));

    expect(result.miCode).toBe('1001');
    expect(result.brand).toBe('Legrand');
    expect(result.standardLength).toBe(305);
    expect(result.description).toBe('desc');
    expect(result.components).toHaveLength(2);
    expect(result.components[0].materials).toHaveLength(2);
    expect(result.totalWeight).toBe(23);
  });

  it('returns null description and zero total weight for a BOM with one material', async () => {
    const standardBom = makeStandardBom({
      id: 'bom-2',
      miCode: '1002',
      brand: 'Schneider',
      productName: 'Product 2',
      standardLength: 500,
      active: false,
      description: null,
      components: [
        {
          componentId: 'comp-3',
          name: 'Core',
          materials: [{ materialId: 'mat-1', name: 'Copper', weight: 12 }],
        },
      ],
    });
    const repository = {
      findByMiCode: jest.fn().mockResolvedValue(standardBom),
    };
    const sut = new GetStandardBomDetailHandler(repository as any);

    const result = await sut.execute(new GetStandardBomDetailQuery('1002'));

    expect(result.description).toBeNull();
    expect(result.totalWeight).toBe(12);
  });
});

function makeStandardBom(params: {
  id: string;
  miCode: string;
  brand: string;
  productName: string;
  standardLength: number;
  active: boolean;
  description: string | null;
  components: Array<{
    componentId: string;
    name: string;
    materials: Array<{ materialId: string; name: string; weight: number }>;
  }>;
}): StandardBom {
  return StandardBom.fromPersistence(
    Identity.fromString(params.id),
    MiCode.fromString(params.miCode),
    Brand.fromString(params.brand),
    StandardLength.of(params.standardLength),
    params.active,
    params.description ?? undefined,
    Identity.fromString('product-id'),
    params.productName,
    params.components.map((component) =>
      StandardBomComponentLine.of(
        Identity.fromString(component.componentId),
        component.name,
        component.materials.map((material) =>
          StandardBomMaterialLine.of(
            Identity.fromString(material.materialId),
            material.name,
            Weight.ofGrams(material.weight),
          ),
        ),
      ),
    ),
  );
}

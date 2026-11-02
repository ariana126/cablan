import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { Identity } from '@framework/domain';

import { BomMapper } from './bom.mapper';

function rejectedBom(): Bom {
  const bom = Bom.register(
    Identity.new(),
    '1234',
    'Legrand',
    'Product 1',
    305,
    OrderNumber.fromString('SO-1234'),
    TrackingNumber.fromString('TN-5678'),
    undefined,
    'Sina',
    [
      BomComponentLine.of(Identity.new(), 'Bolt', [
        BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150)),
      ]),
    ],
  );
  bom.reject('مصطفی', 'وزن مس خارج از محدوده است');
  return bom;
}

describe('BomMapper', () => {
  it('round-trips the daily BOM a re-sample re-samples', () => {
    const source = rejectedBom();
    const resample = source.resample(
      true,
      source.standardBomId(),
      'Legrand',
      'Product 1',
      305,
      source.components(),
      undefined,
      'یاشار',
    );

    const record = BomMapper.toPersistence(resample);
    const restored = BomMapper.toDomain({ ...record, updatedAt: new Date() });

    expect(record.resampledFromId).toBe(source.id.asString());
    expect(restored.resampledFromId()).toEqual(source.id);
  });

  it('keeps an ordinary registration linked to no other daily BOM', () => {
    const record = BomMapper.toPersistence(rejectedBom());
    const restored = BomMapper.toDomain({ ...record, updatedAt: new Date() });

    expect(record.resampledFromId).toBeNull();
    expect(restored.resampledFromId()).toBeNull();
  });
});

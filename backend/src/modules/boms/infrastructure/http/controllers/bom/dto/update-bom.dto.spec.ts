import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { UpdateBomDto } from './update-bom.dto';

function validationErrors(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(UpdateBomDto, body));
}

describe('UpdateBomDto', () => {
  // A cleared text input reports an empty value as `null` on the wire — a
  // legitimate "clear this field" gesture for `description`, but not for
  // `orderNumber`/`trackingNumber`, which `registring-bom.feature`'s own
  // "پاک کردن شماره سفارش/ردیابی" scenarios reject outright.
  it('rejects an order number explicitly cleared to null', async () => {
    const errors = await validationErrors({ orderNumber: null });

    expect(errors.some((error) => error.property === 'orderNumber')).toBe(true);
  });

  it('rejects a tracking number explicitly cleared to null', async () => {
    const errors = await validationErrors({ trackingNumber: null });

    expect(errors.some((error) => error.property === 'trackingNumber')).toBe(
      true,
    );
  });

  it('leaves the order number unchanged when the field is omitted entirely', async () => {
    const errors = await validationErrors({ trackingNumber: 'TN-0000' });

    expect(errors).toHaveLength(0);
  });

  it('accepts a well-formed order number and tracking number', async () => {
    const errors = await validationErrors({
      orderNumber: 'SO-9999',
      trackingNumber: 'TN-0000',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty order number', async () => {
    const errors = await validationErrors({ orderNumber: '' });

    expect(errors.some((error) => error.property === 'orderNumber')).toBe(true);
  });

  it('accepts description cleared to an empty string', async () => {
    const errors = await validationErrors({ description: '' });

    expect(errors).toHaveLength(0);
  });

  it('rejects components given without a standardBomMiCode to reclone from', async () => {
    const errors = await validationErrors({
      components: [{ componentId: 'component-1', materials: [] }],
    });

    expect(errors.some((error) => error.property === 'standardBomMiCode')).toBe(
      true,
    );
  });

  it('accepts components given alongside a standardBomMiCode', async () => {
    const errors = await validationErrors({
      standardBomMiCode: '0001',
      components: [
        {
          componentId: 'component-1',
          materials: [{ materialId: 'material-1', weight: 150 }],
        },
      ],
    });

    expect(errors).toHaveLength(0);
  });
});

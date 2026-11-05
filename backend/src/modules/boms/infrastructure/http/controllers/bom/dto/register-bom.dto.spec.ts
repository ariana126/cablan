import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterBomDto, RegisterBomMaterialDto } from './register-bom.dto';

async function isValid(weight: number) {
  const errors = await validate(
    plainToInstance(RegisterBomMaterialDto, { materialId: 'm', weight }),
  );
  return errors.length === 0;
}

describe('RegisterBomMaterialDto weight', () => {
  it('accepts a weight between zero and one', async () => {
    expect(await isValid(0.1)).toBe(true);
  });

  it.each([0, -1, -0.1])('rejects a weight of %s', async (value) => {
    expect(await isValid(value)).toBe(false);
  });
});

// Issue #101: an order with one MI code chooses it itself.
describe('RegisterBomDto standardBomMiCode', () => {
  const registration = {
    orderNumber: 'ORD-5001',
    trackingNumber: 'TRK-1',
    components: [],
  };

  it('may be left out', async () => {
    expect(
      await validate(plainToInstance(RegisterBomDto, registration)),
    ).toEqual([]);
  });

  it('is refused empty when given', async () => {
    const errors = await validate(
      plainToInstance(RegisterBomDto, {
        ...registration,
        standardBomMiCode: '',
      }),
    );

    expect(errors.map((error) => error.property)).toEqual([
      'standardBomMiCode',
    ]);
  });
});

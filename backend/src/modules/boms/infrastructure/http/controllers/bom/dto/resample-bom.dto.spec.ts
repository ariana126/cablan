import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ResampleBomDto } from './resample-bom.dto';

async function isValid(body: object) {
  const errors = await validate(plainToInstance(ResampleBomDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.length === 0;
}

function withWeight(weight: unknown) {
  return {
    components: [
      { componentId: 'component-1', materials: [{ materialId: 'm', weight }] },
    ],
  };
}

describe('ResampleBomDto', () => {
  it('accepts the new weights with no description', async () => {
    expect(await isValid(withWeight(152))).toBe(true);
  });

  it('accepts a description', async () => {
    expect(
      await isValid({ ...withWeight(152), description: 'نمونه دوم' }),
    ).toBe(true);
  });

  it.each([[undefined], [0], [-1]])(
    'rejects a weight of %p, as a registration does',
    async (weight) => {
      expect(await isValid(withWeight(weight))).toBe(false);
    },
  );

  it.each(['orderNumber', 'trackingNumber', 'standardBomMiCode'])(
    'rejects a %s, which comes from the rejected daily BOM',
    async (field) => {
      expect(await isValid({ ...withWeight(152), [field]: 'X' })).toBe(false);
    },
  );
});

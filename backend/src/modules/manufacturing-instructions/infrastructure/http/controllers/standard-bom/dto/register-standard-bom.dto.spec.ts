import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterStandardBomDto } from './register-standard-bom.dto';

function body(standardLength: number, weight: number) {
  return {
    productId: 'p',
    miCode: '1234',
    brand: 'Legrand',
    standardLength,
    active: true,
    components: [
      { componentId: 'c', materials: [{ materialId: 'm', weight }] },
    ],
  };
}

async function isValid(standardLength: number, weight: number) {
  const errors = await validate(
    plainToInstance(RegisterStandardBomDto, body(standardLength, weight)),
  );
  return errors.length === 0;
}

describe('RegisterStandardBomDto numeric fields', () => {
  it('accepts a standard length and weight between zero and one', async () => {
    expect(await isValid(0.1, 0.1)).toBe(true);
  });

  it.each([0, -1, -0.1])('rejects a standard length of %s', async (value) => {
    expect(await isValid(value, 150)).toBe(false);
  });

  it.each([0, -1, -0.1])('rejects a weight of %s', async (value) => {
    expect(await isValid(305, value)).toBe(false);
  });
});

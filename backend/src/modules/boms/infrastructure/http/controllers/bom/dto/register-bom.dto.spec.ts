import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterBomMaterialDto } from './register-bom.dto';

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

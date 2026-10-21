import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterMaterialDto } from './register-material.dto';

function toDto(body: Record<string, unknown>): RegisterMaterialDto {
  return plainToInstance(RegisterMaterialDto, body);
}

async function invalidFields(body: Record<string, unknown>) {
  const errors = await validate(toDto(body));
  return errors.map((error) => error.property);
}

describe('RegisterMaterialDto code', () => {
  it('accepts a name and a code', async () => {
    expect(await invalidFields({ name: 'Steel Rod', code: 'RM-001' })).toEqual(
      [],
    );
  });

  it('trims surrounding whitespace from the code', () => {
    expect(toDto({ name: 'Steel Rod', code: '  RM-001 ' }).code).toBe('RM-001');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace-only', ' '.repeat(3)],
  ])('rejects a %s code on the code field', async (_label, code) => {
    expect(await invalidFields({ name: 'Steel Rod', code })).toEqual(['code']);
  });
});

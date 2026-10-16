import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { ExportStandardBomsDto } from './export-standard-boms.dto';

function validationErrors(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(ExportStandardBomsDto, body));
}

describe('ExportStandardBomsDto', () => {
  it('accepts either format with no filters', async () => {
    expect(await validationErrors({ format: 'perMaterial' })).toHaveLength(0);
    expect(await validationErrors({ format: 'perBom' })).toHaveLength(0);
  });

  it('accepts filters alongside the format', async () => {
    const errors = await validationErrors({
      format: 'perBom',
      filters: { brands: ['لگراند'] },
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing format', async () => {
    const errors = await validationErrors({});

    expect(errors.map((error) => error.property)).toEqual(['format']);
  });

  it('rejects an unknown format', async () => {
    const errors = await validationErrors({ format: 'csv' });

    expect(errors.map((error) => error.property)).toEqual(['format']);
  });
});

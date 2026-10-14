import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { ExportBomsDto } from './export-boms.dto';

function validationErrors(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(ExportBomsDto, body));
}

function invalidProperties(errors: ValidationError[]): string[] {
  return errors.map((error) => error.property);
}

describe('ExportBomsDto', () => {
  it('accepts either format with the reader’s time zone and no filters', async () => {
    expect(
      await validationErrors({ format: 'perMaterial', timeZone: 'UTC' }),
    ).toHaveLength(0);
    expect(
      await validationErrors({ format: 'perBom', timeZone: 'Asia/Tehran' }),
    ).toHaveLength(0);
  });

  it('accepts filters alongside the format', async () => {
    const errors = await validationErrors({
      format: 'perBom',
      timeZone: 'Asia/Tehran',
      filters: { brands: ['لگراند'], registeredAtFrom: '2024-06-21T00:00:00Z' },
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing format', async () => {
    const errors = await validationErrors({ timeZone: 'UTC' });

    expect(invalidProperties(errors)).toEqual(['format']);
  });

  it('rejects an unknown format', async () => {
    const errors = await validationErrors({ format: 'csv', timeZone: 'UTC' });

    expect(invalidProperties(errors)).toEqual(['format']);
  });

  it('rejects a missing time zone', async () => {
    const errors = await validationErrors({ format: 'perBom' });

    expect(invalidProperties(errors)).toEqual(['timeZone']);
  });

  it('rejects a time zone that is not an IANA name', async () => {
    const errors = await validationErrors({
      format: 'perBom',
      timeZone: 'Mars/Olympus',
    });

    expect(invalidProperties(errors)).toEqual(['timeZone']);
  });
});

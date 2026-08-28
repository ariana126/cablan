import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { ReportBomsDto } from './report-boms.dto';

function validationErrors(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(ReportBomsDto, body));
}

describe('ReportBomsDto', () => {
  it('accepts a request with no filters at all', async () => {
    const errors = await validationErrors({ page: 1, pageSize: 20 });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing page', async () => {
    const errors = await validationErrors({ pageSize: 20 });

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('rejects a missing pageSize', async () => {
    const errors = await validationErrors({ page: 1 });

    expect(errors.some((error) => error.property === 'pageSize')).toBe(true);
  });

  it('rejects a non-positive page', async () => {
    const errors = await validationErrors({ page: 0, pageSize: 20 });

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  // The absent-vs-empty distinction is what tells "reselect all" (the filter
  // key is dropped) apart from "deselect all" (the filter key is sent as
  // `[]`) — see reporting-bom.feature's own rules for both. `transform: true`
  // must not collapse one into the other.
  it('leaves an omitted filter field as undefined, not an empty array', () => {
    const dto = plainToInstance(ReportBomsDto, { page: 1, pageSize: 20 });

    expect(dto.filters).toBeUndefined();
  });

  it('leaves an empty array filter field as an empty array', () => {
    const dto = plainToInstance(ReportBomsDto, {
      page: 1,
      pageSize: 20,
      filters: { brands: [] },
    });

    expect(dto.filters?.brands).toEqual([]);
  });

  it('accepts a fully populated set of filters', async () => {
    const errors = await validationErrors({
      page: 1,
      pageSize: 20,
      filters: {
        brands: ['لگراند'],
        componentNames: ['مغزی'],
        standardBomMiCodes: ['1001'],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        registeredByUsers: ['نیکروش'],
        registeredAtFrom: '2026-06-21T00:00:00.000Z',
        registeredAtTo: '2026-06-26T00:00:00.000Z',
      },
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a malformed registeredAtFrom', async () => {
    const errors = await validationErrors({
      page: 1,
      pageSize: 20,
      filters: { registeredAtFrom: 'not-a-date' },
    });

    expect(errors.some((error) => error.property === 'filters')).toBe(true);
  });

  it('rejects a non-string entry in a filter array', async () => {
    const errors = await validationErrors({
      page: 1,
      pageSize: 20,
      filters: { brands: [123] },
    });

    expect(errors.some((error) => error.property === 'filters')).toBe(true);
  });
});

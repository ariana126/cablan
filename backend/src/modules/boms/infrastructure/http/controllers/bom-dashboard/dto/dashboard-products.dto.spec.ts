import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { DashboardProductsDto } from './dashboard-products.dto';

function validationErrors(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(DashboardProductsDto, body));
}

describe('DashboardProductsDto', () => {
  it('accepts an empty body — from/to are both optional', async () => {
    const errors = await validationErrors({});

    expect(errors).toHaveLength(0);
  });

  it('accepts a from-only body', async () => {
    const errors = await validationErrors({
      from: '2026-06-21T00:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a to-only body', async () => {
    const errors = await validationErrors({
      to: '2026-06-26T00:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated body', async () => {
    const errors = await validationErrors({
      from: '2026-06-21T00:00:00.000Z',
      to: '2026-06-26T00:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a malformed `from`', async () => {
    const errors = await validationErrors({ from: 'not-a-date' });

    expect(errors.some((error) => error.property === 'from')).toBe(true);
  });

  it('rejects a malformed `to`', async () => {
    const errors = await validationErrors({ to: 'not-a-date' });

    expect(errors.some((error) => error.property === 'to')).toBe(true);
  });

  // The absent-vs-empty distinction is what the repository's "absent
  // means unfiltered" semantics rely on: a missing key must stay
  // `undefined`, not be coerced into `[]`/a default Date. `transform:
  // true` must not collapse the two.
  it('leaves an omitted `from`/`to` as undefined, not coerced to a default', () => {
    const dto = plainToInstance(DashboardProductsDto, {});

    expect(dto.from).toBeUndefined();
    expect(dto.to).toBeUndefined();
  });
});

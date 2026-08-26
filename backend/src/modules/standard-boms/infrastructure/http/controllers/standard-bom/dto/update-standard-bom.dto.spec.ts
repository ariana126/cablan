import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { UpdateStandardBomDto } from './update-standard-bom.dto';

function validationErrors(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(UpdateStandardBomDto, body));
}

describe('UpdateStandardBomDto', () => {
  // A `type="number"` edit-form input reports an empty value as `NaN`, which
  // `JSON.stringify` turns into `null` on the wire — a legitimate "clear this
  // field" gesture, not a malformed request (see this module's CLAUDE.md).
  // `standardLength` cannot be empty, on edit exactly as on registration, so
  // this must be an ordinary validation error rather than reaching
  // `StandardLength.of()` unvalidated.
  it('rejects a standard length explicitly cleared to null', async () => {
    const errors = await validationErrors({ standardLength: null });

    expect(errors.some((error) => error.property === 'standardLength')).toBe(
      true,
    );
  });

  it('leaves the standard length unchanged when the field is omitted entirely', async () => {
    const errors = await validationErrors({ miCode: '5678' });

    expect(errors).toHaveLength(0);
  });

  it('accepts a well-formed standard length', async () => {
    const errors = await validationErrors({ standardLength: 500 });

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-positive standard length', async () => {
    const errors = await validationErrors({ standardLength: -1 });

    expect(errors.some((error) => error.property === 'standardLength')).toBe(
      true,
    );
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RejectBomDto } from './reject-bom.dto';

async function errorsOf(body: object) {
  return validate(plainToInstance(RejectBomDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
}

describe('RejectBomDto', () => {
  it('accepts a reason', async () => {
    expect(await errorsOf({ reason: 'وزن مس خارج از محدوده است' })).toEqual([]);
  });

  // A missing, empty or blank reason is the domain's to refuse, as
  // `rejection-reason-required` rather than a generic validation error.
  it.each([[{}], [{ reason: '' }], [{ reason: ' '.repeat(3) }]])(
    'lets %p through to the domain',
    async (body) => {
      expect(await errorsOf(body)).toEqual([]);
    },
  );

  it('rejects a reason that is not a string', async () => {
    const errors = await errorsOf({ reason: 42 });

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });
});

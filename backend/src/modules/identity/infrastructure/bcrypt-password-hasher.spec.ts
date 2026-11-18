import { ConfigService } from '@nestjs/config';

import { BcryptPasswordHasher } from './bcrypt-password-hasher';

function hasherWith(settings: Record<string, string>): BcryptPasswordHasher {
  const config = {
    get: (key: string) => settings[key],
  } as unknown as ConfigService;
  return new BcryptPasswordHasher(config);
}

describe('BcryptPasswordHasher', () => {
  it('uses cost 10 when BCRYPT_COST is unset', async () => {
    const hash = await hasherWith({}).hash('x');

    expect(hash.startsWith('$2b$10$')).toBe(true);
  });

  it('uses the configured cost under NODE_ENV=test', async () => {
    const hash = await hasherWith({
      NODE_ENV: 'test',
      BCRYPT_COST: '4',
    }).hash('x');

    expect(hash.startsWith('$2b$04$')).toBe(true);
  });

  it.each([
    { NODE_ENV: 'production', BCRYPT_COST: '4' },
    { NODE_ENV: 'development', BCRYPT_COST: '9' },
  ])('refuses a cost below 10 outside NODE_ENV=test: %j', (settings) => {
    expect(() => hasherWith(settings)).toThrow(/BCRYPT_COST/);
  });

  it.each(['abc', '3', '32', '4.5'])('refuses a malformed cost: %s', (cost) => {
    expect(() => hasherWith({ NODE_ENV: 'test', BCRYPT_COST: cost })).toThrow(
      /BCRYPT_COST/,
    );
  });

  it('still verifies a hash made at another cost', async () => {
    const hash = await hasherWith({}).hash('x');
    const cheap = hasherWith({ NODE_ENV: 'test', BCRYPT_COST: '4' });

    await expect(cheap.compare('x', hash)).resolves.toBe(true);
  });
});

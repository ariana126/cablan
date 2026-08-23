import { Clock } from '@framework/domain';
import { JwtService } from '@nestjs/jwt';

import { JwtTokenService } from './jwt-token.service';

const SECRET = 'test-secret';
const FROZEN_INSTANT = new Date('2026-01-01T00:00:00.000Z');

class FixedClock extends Clock {
  constructor(private readonly instant: Date) {
    super();
  }

  now(): Date {
    return this.instant;
  }
}

function makeSut(instant: Date) {
  const jwtService = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: '1h' },
  });
  const sut = new JwtTokenService(jwtService, new FixedClock(instant));
  return { sut, jwtService };
}

describe('JwtTokenService', () => {
  it('stamps the token with the clock-provided instant, not real time', () => {
    const { sut, jwtService } = makeSut(FROZEN_INSTANT);

    const token = sut.issue({ sub: 'a-user-id' });

    const decoded = jwtService.decode<{ iat: number }>(token);
    expect(decoded.iat).toBe(Math.floor(FROZEN_INSTANT.getTime() / 1000));
  });

  it('expires exactly one clock-hour after the frozen instant', () => {
    const { sut, jwtService } = makeSut(FROZEN_INSTANT);

    const token = sut.issue({ sub: 'a-user-id' });

    const decoded = jwtService.decode<{ exp: number }>(token);
    expect(decoded.exp).toBe(
      Math.floor(FROZEN_INSTANT.getTime() / 1000) + 3600,
    );
  });

  it('is expired once verified an hour past the clock instant it was issued at, regardless of real time', () => {
    const { sut, jwtService } = makeSut(FROZEN_INSTANT);
    const token = sut.issue({ sub: 'a-user-id' });

    const oneHourLater = new Date(FROZEN_INSTANT.getTime() + 3_600_000);

    expect(() => {
      jwtService.verify(token, {
        clockTimestamp: Math.floor(oneHourLater.getTime() / 1000),
      });
    }).toThrow();
  });
});

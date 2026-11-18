import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

const DEFAULT_COST = 10;
const MIN_COST = 4;
const MAX_COST = 31;

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  private readonly cost: number;

  constructor(config: ConfigService) {
    super();
    this.cost = BcryptPasswordHasher.resolveCost(
      config.get<string>('BCRYPT_COST'),
      config.get<string>('NODE_ENV'),
    );
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  private static resolveCost(
    raw: string | undefined,
    nodeEnv: string | undefined,
  ): number {
    if (raw === undefined || raw === '') {
      return DEFAULT_COST;
    }
    const cost = Number(raw);
    if (
      !/^\d+$/.test(raw) ||
      !Number.isInteger(cost) ||
      cost < MIN_COST ||
      cost > MAX_COST
    ) {
      throw new Error(
        `BCRYPT_COST must be an integer from ${MIN_COST} to ${MAX_COST}, got "${raw}"`,
      );
    }
    if (cost < DEFAULT_COST && nodeEnv !== 'test') {
      throw new Error(
        `BCRYPT_COST below ${DEFAULT_COST} is allowed only when NODE_ENV=test, got "${raw}"`,
      );
    }
    return cost;
  }
}

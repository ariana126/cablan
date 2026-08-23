import { ValueObject } from '@framework/domain';

export class Username extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, unlike Email — usernames
  // are case-sensitive by design (see logging-in.feature's "نام کاربری به
  // حروف بزرگ و کوچک حساس است" rule), so "Sina.Q" and "sina.q" must compare
  // as different usernames.
  static fromString(username: string): Username {
    if (!username.trim()) {
      throw new Error('Username value must not be empty');
    }
    return new Username(username);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}

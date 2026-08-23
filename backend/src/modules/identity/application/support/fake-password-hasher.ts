import { PasswordHasher } from '@identity/domain/service/password-hasher';

// Deterministic and reversible, never a real hash — good enough to prove a
// handler calls through the port correctly, without pulling bcrypt into a
// unit test.
export class FakePasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return Promise.resolve(hashed === `hashed:${plain}`);
  }
}

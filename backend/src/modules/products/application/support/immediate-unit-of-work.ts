import { UnitOfWork } from '@framework/application';

// Runs the work as is: the in-memory repositories have no transaction to
// open and nothing runs concurrently. It notes which lock keys were asked
// for, so a spec can tell a command serialises itself. Atomicity and the lock
// themselves are proven against Postgres by the integration suite.
export class ImmediateUnitOfWork extends UnitOfWork {
  private readonly keys: string[] = [];

  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }

  runExclusively<T>(lockKey: string, work: () => Promise<T>): Promise<T> {
    this.keys.push(lockKey);
    return work();
  }

  lockKeysTaken(): string[] {
    return [...this.keys];
  }
}

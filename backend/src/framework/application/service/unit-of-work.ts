/**
 * The port for "do all of this, or none of it": `run(work)` executes `work`
 * in one transaction — joining one already open — so every repository write
 * inside it, and every domain-event handler those writes dispatch, commits or
 * rolls back together (ADR 0007). For a command that writes several
 * aggregates; a single `save()` is already atomic on its own.
 *
 * `runExclusively(lockKey, work)` does the same, but first waits for every
 * other unit of work holding the same `lockKey` to finish, and holds it until
 * this one commits or rolls back. For commands whose checks read state that a
 * concurrent run of a command sharing the key could change underneath them.
 *
 * Bound in infrastructure, over the same transaction host the repositories
 * write through.
 */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;

  abstract runExclusively<T>(
    lockKey: string,
    work: () => Promise<T>,
  ): Promise<T>;
}

import { Answerable, PerformsActivities, Task } from '@serenity-js/core';

/**
 * Performs `first`, then builds and performs whatever `next()` returns, then runs `after` — the
 * escape hatch `Task.where`'s static activity list can't express: it needs `first` (registering a
 * fresh product, say) to have *actually run* before `next()` can read what it just registered
 * (`theLastRegisteredProduct()`). `Task.where(first, next())` can't do this — both arguments are
 * evaluated eagerly, before either one has performed. `after` exists for the same reason in
 * reverse: `RegisterStandardBomAndRememberIt` (typically `next()`) calls `standard-bom-details.ts`'s
 * own `rememberAttempt` internally to remember the standard BOM's own drafted details, so a caller
 * that also wants "the attempt" to mean something else (e.g. the product's fresh components) has to
 * set that *after* `next()` has finished clobbering it, not before it's ever run.
 */
export class SequentiallyDependentTask extends Task {
  constructor(
    description: Answerable<string>,
    private readonly first: Task,
    private readonly next: () => Task,
    private readonly after?: () => void,
  ) {
    super(description);
  }

  async performAs(actor: PerformsActivities): Promise<void> {
    await actor.attemptsTo(this.first);
    await actor.attemptsTo(this.next());
    this.after?.();
  }
}

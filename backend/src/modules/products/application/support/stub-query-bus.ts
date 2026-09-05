// A hand-written fake, not a mock: from `ProductCompositionFactory`'s point
// of view, another module's query handler is the one boundary this module
// crosses that it doesn't own (see src/modules/products/CLAUDE.md), so
// tests drive it with a fake that records what it was asked to execute and
// returns a scripted response, rather than asserting call-by-call on a
// generic spy.
//
// Responses are queued per query name (FIFO), mirroring `StubCommandBus`:
// every code path now resolves through a query rather than falling back to
// a command, so a single test can script a distinct response for each of
// several same-typed queries (e.g. two different `FindMaterialByNameQuery`s
// for two differently named materials) in the order they're expected to be
// dispatched.
export class StubQueryBus {
  public readonly executedQueries: object[] = [];
  private readonly responseQueuesByQueryName = new Map<string, unknown[]>();

  respondTo(queryName: string, ...responses: unknown[]): void {
    this.responseQueuesByQueryName.set(queryName, [...responses]);
  }

  execute(query: object): Promise<unknown> {
    this.executedQueries.push(query);
    const queue = this.responseQueuesByQueryName.get(query.constructor.name);
    return Promise.resolve(queue?.shift());
  }
}

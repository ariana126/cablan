// A hand-written fake, not a mock: from `ProductCompositionFactory`'s point
// of view, another module's query handler is the one boundary this module
// crosses that it doesn't own (see src/modules/products/CLAUDE.md), so
// tests drive it with a fake that records what it was asked to execute and
// returns a scripted response, rather than asserting call-by-call on a
// generic spy.
export class StubQueryBus {
  public readonly executedQueries: object[] = [];
  private readonly responsesByQueryName = new Map<string, unknown>();

  respondTo(queryName: string, response: unknown): void {
    this.responsesByQueryName.set(queryName, response);
  }

  execute(query: object): Promise<unknown> {
    this.executedQueries.push(query);
    return Promise.resolve(
      this.responsesByQueryName.get(query.constructor.name),
    );
  }
}

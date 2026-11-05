// A hand-written fake, not a mock: from `BomCompositionFactory`'s point of
// view, another module's query handler is the one boundary this module
// crosses that it doesn't own (see src/modules/boms/CLAUDE.md), so tests
// drive it with a fake that records what it was asked to execute and returns
// a scripted response or rejection, rather than asserting call-by-call on a
// generic spy.
export class StubQueryBus {
  public readonly executedQueries: object[] = [];
  private readonly responsesByQueryName = new Map<string, unknown>();
  private readonly errorsByQueryName = new Map<string, Error>();
  private readonly answersByQueryName = new Map<
    string,
    (query: object) => unknown
  >();

  respondTo(queryName: string, response: unknown): void {
    this.responsesByQueryName.set(queryName, response);
  }

  rejectWith(queryName: string, error: Error): void {
    this.errorsByQueryName.set(queryName, error);
  }

  /**
   * Answers each query of this name from the query itself — e.g. one standard
   * BOM per MI code. `answer` may throw, which rejects the execution.
   */
  answerWith(queryName: string, answer: (query: object) => unknown): void {
    this.answersByQueryName.set(queryName, answer);
  }

  execute(query: object): Promise<unknown> {
    this.executedQueries.push(query);
    const queryName = query.constructor.name;
    const error = this.errorsByQueryName.get(queryName);
    if (error) {
      return Promise.reject(error);
    }
    const answer = this.answersByQueryName.get(queryName);
    if (answer) {
      try {
        return Promise.resolve(answer(query));
      } catch (answerError) {
        return Promise.reject(answerError as Error);
      }
    }
    return Promise.resolve(this.responsesByQueryName.get(queryName));
  }
}

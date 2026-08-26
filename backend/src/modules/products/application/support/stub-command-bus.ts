// A hand-written fake, not a mock: from `ProductCompositionFactory`'s point
// of view, another module's command handler is the one boundary this module
// crosses that it doesn't own (see src/modules/products/CLAUDE.md), so
// tests drive it with a fake that records what it was asked to execute and
// returns a scripted response, rather than asserting call-by-call on a
// generic spy.
export class StubCommandBus {
  public readonly executedCommands: object[] = [];
  private readonly responseQueuesByCommandName = new Map<string, unknown[]>();

  respondTo(commandName: string, ...responses: unknown[]): void {
    this.responseQueuesByCommandName.set(commandName, [...responses]);
  }

  execute(command: object): Promise<unknown> {
    this.executedCommands.push(command);
    const queue = this.responseQueuesByCommandName.get(
      command.constructor.name,
    );
    return Promise.resolve(queue?.shift());
  }
}

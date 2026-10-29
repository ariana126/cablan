import { DisplayNameProvider, Identity } from '@framework/domain';

/** Names users from a fixed table; an unknown id is a spec mistake. */
export class StubDisplayNameProvider extends DisplayNameProvider {
  private readonly names = new Map<string, string>();

  name(userId: Identity, displayName: string): this {
    this.names.set(userId.asString(), displayName);
    return this;
  }

  getName(userId: Identity): Promise<string> {
    const name = this.names.get(userId.asString());
    if (name === undefined) {
      return Promise.reject(
        new Error(`No name stubbed for ${userId.asString()}`),
      );
    }
    return Promise.resolve(name);
  }
}

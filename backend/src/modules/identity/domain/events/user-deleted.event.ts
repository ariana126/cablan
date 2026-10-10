import { DomainEvent, Role } from '@framework/domain';

// A snapshot of the user as it stood when deleted — never the password or
// its hash — so a subscriber (e.g. audit-logging) can show what was removed.
export class UserDeleted implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly username: string,
    public readonly role: Role,
  ) {}
}

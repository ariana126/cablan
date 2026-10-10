import { DomainEvent, Role } from '@framework/domain';

// Carries every field the user was registered with that a subscriber (e.g.
// audit-logging) is entitled to see — never the password or its hash.
export class UserRegistered implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly username: string,
    public readonly role: Role,
  ) {}
}

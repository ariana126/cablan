import { DomainEvent, Role } from '@framework/domain';

export class UserRegistered implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly username: string,
    public readonly role: Role,
  ) {}
}

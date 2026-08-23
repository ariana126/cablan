import { DomainEvent, Role } from '@framework/domain';

export class UserRoleChanged implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly previousRole: Role,
    public readonly newRole: Role,
  ) {}
}

import { DomainEvent } from '@framework/domain';

export class UserDeleted implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly username: string,
  ) {}
}

import { DomainEvent } from '@framework/domain';

export class UserRenamed implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly previousName: string,
    public readonly newName: string,
  ) {}
}

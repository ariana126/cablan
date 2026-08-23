import { DomainEvent } from '@framework/domain';

export class UsernameChanged implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly previousUsername: string,
    public readonly newUsername: string,
  ) {}
}

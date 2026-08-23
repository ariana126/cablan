import { DomainEvent } from '@framework/domain';

// Carries no password material, hashed or otherwise — only the fact that it
// changed, which is all a subscriber (e.g. audit logging) is ever entitled to.
export class UserPasswordChanged implements DomainEvent {
  constructor(public readonly userId: string) {}
}

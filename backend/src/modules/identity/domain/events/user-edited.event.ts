import { DomainEvent } from '@framework/domain';

// One entry per field that actually changed in a single edit — never for a
// field resent unchanged. `User.edit()` computes this while the old values
// are still on hand, so a subscriber (e.g. audit-logging) reads it directly
// instead of diffing snapshots itself.
export interface UserFieldChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

export class UserEdited implements DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly changes: UserFieldChange[],
  ) {}
}

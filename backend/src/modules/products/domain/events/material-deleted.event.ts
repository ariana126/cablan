import { DomainEvent } from '@framework/domain';

// A snapshot of the material as it stood when deleted, so a subscriber
// (e.g. audit-logging) can show what was removed.
export class MaterialDeleted implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
    public readonly code: string,
  ) {}
}

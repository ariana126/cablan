import { DomainEvent } from '@framework/domain';

// A material registered as part of a bulk import. Deliberately not
// `MaterialRegistered`: the import's own `MaterialsImported` is what the
// audit log records, once for the whole import, so audit-logging has no
// handler for this event (pinned by its `EventHandlers` spec).
export class MaterialRegisteredByImport implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
    public readonly code: string,
  ) {}
}

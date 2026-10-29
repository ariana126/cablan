import { DomainEvent } from '@framework/domain';

// A material a bulk import registered, removed again because that import is
// reverted. Not `MaterialDeleted`: `MaterialImportReverted` is what the audit
// log records, and nothing audits this event on its own.
export class MaterialWithdrawnByImport implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
    public readonly code: string,
  ) {}
}

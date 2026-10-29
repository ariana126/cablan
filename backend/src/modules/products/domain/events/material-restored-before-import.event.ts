import { DomainEvent } from '@framework/domain';

// A material given back the name and code it had before a bulk import, while
// that import is reverted. `MaterialImportReverted` is what the audit log
// records; nothing audits this event on its own.
export class MaterialRestoredBeforeImport implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly previousName: string,
    public readonly previousCode: string,
    public readonly name: string,
    public readonly code: string,
  ) {}
}

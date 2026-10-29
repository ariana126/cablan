import { DomainEvent } from '@framework/domain';

// A material given a new name or code by a bulk import. Not
// `MaterialEdited`, for the same reason as `MaterialRegisteredByImport`:
// nothing audits it on its own.
export class MaterialRevisedByImport implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly previousName: string,
    public readonly previousCode: string,
    public readonly name: string,
    public readonly code: string,
  ) {}
}

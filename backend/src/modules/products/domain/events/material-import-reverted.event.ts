import { DomainEvent } from '@framework/domain';

import { MaterialImportChangeSnapshot } from './material-import-change.snapshot';

// A bulk import undone, as a whole: the import's own changes, as they were
// applied (a subscriber reads each one backwards). Like the import, one event
// for the whole reversion.
export class MaterialImportReverted implements DomainEvent {
  constructor(
    public readonly importId: string,
    public readonly changes: MaterialImportChangeSnapshot[],
  ) {}
}

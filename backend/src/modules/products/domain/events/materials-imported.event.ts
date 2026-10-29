import { DomainEvent } from '@framework/domain';

import { MaterialImportChangeSnapshot } from './material-import-change.snapshot';

// A confirmed bulk import from the accounting software's Excel: one event
// for the whole import, its changes in file order. The materials it touched
// record only import-specific events, which nothing audits (issue #74).
export class MaterialsImported implements DomainEvent {
  constructor(
    public readonly importId: string,
    public readonly changes: MaterialImportChangeSnapshot[],
  ) {}
}

import { DomainEvent } from '@framework/domain';

// One entry per editable scalar field that actually changed — never for a
// field resent unchanged. `Bom.edit()` computes this by comparing each old
// field value (still on hand before it overwrites `this._...`) against the
// incoming new value; a subscriber (e.g. audit-logging) reads this directly
// rather than diffing old/new snapshots itself.
export interface BomFieldChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

export class BomEdited implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly description: string | undefined,
    public readonly changes: BomFieldChange[],
  ) {}
}

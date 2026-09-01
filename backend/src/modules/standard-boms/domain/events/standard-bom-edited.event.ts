import { DomainEvent } from '@framework/domain';

// One entry per editable scalar field that actually changed — never for a
// field resent unchanged. `StandardBom.edit()` computes this by comparing
// each old field value (still on hand before it overwrites `this._...`)
// against the incoming new value; a subscriber (e.g. audit-logging) reads
// this directly rather than diffing old/new snapshots itself.
export interface StandardBomFieldChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

export class StandardBomEdited implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly description: string | undefined,
    public readonly active: boolean,
    public readonly changes: StandardBomFieldChange[],
  ) {}
}

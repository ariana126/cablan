import { DomainEvent } from '@framework/domain';

import { ManufacturingInstructionCompositionReplacement } from './manufacturing-instruction.snapshot';

// One entry per editable scalar field that actually changed — never for a
// field resent unchanged. `ManufacturingInstruction.edit()` computes this by comparing
// each old field value (still on hand before it overwrites `this._...`)
// against the incoming new value; a subscriber (e.g. audit-logging) reads
// this directly rather than diffing old/new snapshots itself.
export interface ManufacturingInstructionFieldChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

export class ManufacturingInstructionEdited implements DomainEvent {
  constructor(
    public readonly manufacturingInstructionId: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly description: string | undefined,
    public readonly active: boolean,
    public readonly changes: ManufacturingInstructionFieldChange[],
    // The composition before and after, when the same edit also replaced
    // it — carried here, not in a second event, so one edit is one event.
    // `null` when the composition was left as it was.
    public readonly replacedComposition: ManufacturingInstructionCompositionReplacement | null = null,
  ) {}
}

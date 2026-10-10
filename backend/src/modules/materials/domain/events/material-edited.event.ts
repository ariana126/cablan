import { DomainEvent } from '@framework/domain';

// One entry per field that actually changed in a single edit — never for a
// field resent unchanged. `Material.edit()` computes this while the old values
// are still on hand, so a subscriber (e.g. audit-logging) reads it directly
// instead of diffing snapshots itself. An absent code reads as `''`.
export interface MaterialFieldChange {
  readonly field: 'name' | 'code';
  readonly previousValue: string;
  readonly newValue: string;
}

export class MaterialEdited implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly changes: MaterialFieldChange[],
  ) {}
}

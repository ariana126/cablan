import { DomainEvent } from '@framework/domain';

export class MaterialRegistered implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
    // `null` when the material was registered without a code.
    public readonly code: string | null,
  ) {}
}

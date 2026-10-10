import { DomainEvent } from '@framework/domain';

import { BomSnapshot } from './bom.snapshot';

export class BomRegistered implements DomainEvent {
  constructor(
    public readonly bomId: string,
    // Everything the BOM was registered with, composition included.
    public readonly snapshot: BomSnapshot,
  ) {}
}

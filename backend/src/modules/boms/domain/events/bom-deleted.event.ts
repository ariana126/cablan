import { DomainEvent } from '@framework/domain';

import { BomSnapshot } from './bom.snapshot';

export class BomDeleted implements DomainEvent {
  constructor(
    public readonly bomId: string,
    // The BOM as it stood when deleted, composition included.
    public readonly snapshot: BomSnapshot,
  ) {}
}

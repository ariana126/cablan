import { DomainEvent } from '@framework/domain';

import { StandardBomSnapshot } from './standard-bom.snapshot';

export class StandardBomDeleted implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    // The standard BOM as it stood when deleted, composition included.
    public readonly snapshot: StandardBomSnapshot,
  ) {}
}

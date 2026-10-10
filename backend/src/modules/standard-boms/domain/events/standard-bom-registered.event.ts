import { DomainEvent } from '@framework/domain';

import { StandardBomSnapshot } from './standard-bom.snapshot';

export class StandardBomRegistered implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    // Everything the standard BOM was registered with, composition included.
    public readonly snapshot: StandardBomSnapshot,
  ) {}
}

import { DomainEvent } from '@framework/domain';

import { ProductComponentSnapshot } from './product-component.snapshot';

// A snapshot of the product as it stood when deleted — its name and its
// whole composition — so a subscriber (e.g. audit-logging) can show what was
// removed.
export class ProductDeleted implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly components: readonly ProductComponentSnapshot[],
  ) {}
}

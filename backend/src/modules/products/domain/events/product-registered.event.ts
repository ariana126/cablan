import { DomainEvent } from '@framework/domain';

import { ProductComponentSnapshot } from './product-component.snapshot';

export class ProductRegistered implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly components: readonly ProductComponentSnapshot[],
  ) {}
}

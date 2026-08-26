import { DomainEvent } from '@framework/domain';

export class ProductDeleted implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly name: string,
  ) {}
}

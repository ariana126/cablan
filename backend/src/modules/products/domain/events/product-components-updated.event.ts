import { DomainEvent } from '@framework/domain';

export class ProductComponentsUpdated implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly componentIds: string[],
  ) {}
}

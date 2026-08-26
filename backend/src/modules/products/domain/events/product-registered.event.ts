import { DomainEvent } from '@framework/domain';

export class ProductRegistered implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly componentIds: string[],
  ) {}
}

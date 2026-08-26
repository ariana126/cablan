import { DomainEvent } from '@framework/domain';

export class ProductRenamed implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly previousName: string,
    public readonly newName: string,
  ) {}
}

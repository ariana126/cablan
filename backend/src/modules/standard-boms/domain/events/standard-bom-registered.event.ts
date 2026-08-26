import { DomainEvent } from '@framework/domain';

export class StandardBomRegistered implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    public readonly miCode: string,
    public readonly productId: string,
    public readonly componentIds: string[],
  ) {}
}

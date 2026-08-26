import { DomainEvent } from '@framework/domain';

export class StandardBomEdited implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly description: string | undefined,
    public readonly active: boolean,
  ) {}
}

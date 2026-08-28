import { Identity } from '@framework/domain';

export class GetBomQuery {
  constructor(public readonly bomId: Identity) {}
}

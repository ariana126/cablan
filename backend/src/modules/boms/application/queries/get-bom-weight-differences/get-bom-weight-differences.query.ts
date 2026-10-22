import { Identity } from '@framework/domain';

export class GetBomWeightDifferencesQuery {
  constructor(public readonly bomId: Identity) {}
}

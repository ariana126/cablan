import { Identity } from '@framework/domain';

export class GetCurrentUserQuery {
  constructor(public readonly userId: Identity) {}
}

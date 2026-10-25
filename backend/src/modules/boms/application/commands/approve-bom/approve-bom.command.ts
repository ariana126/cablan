import { Identity } from '@framework/domain';

// `reviewerName` is the acting user's display name, resolved by the
// controller through `DisplayNameProvider` — the same way
// `RegisterBomCommand.registeredBy` is.
export class ApproveBomCommand {
  constructor(
    public readonly bomId: Identity,
    public readonly reviewerName: string,
  ) {}
}

import { Identity } from '@framework/domain';

// `reviewerName` is resolved like `ApproveBomCommand.reviewerName`. `reason`
// is what the reviewer typed, as sent — `undefined` when the request carried
// none, which `Bom.reject()` refuses exactly like an empty one.
export class RejectBomCommand {
  constructor(
    public readonly bomId: Identity,
    public readonly reviewerName: string,
    public readonly reason: string | undefined,
  ) {}
}

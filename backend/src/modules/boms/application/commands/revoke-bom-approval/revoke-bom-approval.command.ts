import { Identity } from '@framework/domain';

export class RevokeBomApprovalCommand {
  constructor(public readonly bomId: Identity) {}
}

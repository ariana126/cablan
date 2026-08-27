import { Identity } from '@framework/domain';

export class DeleteBomCommand {
  constructor(public readonly bomId: Identity) {}
}

import { Identity } from '@framework/domain';

export class DeleteStandardBomCommand {
  constructor(public readonly standardBomId: Identity) {}
}

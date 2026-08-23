import { Identity } from '@framework/domain';

export class DeleteUserCommand {
  constructor(public readonly userId: Identity) {}
}

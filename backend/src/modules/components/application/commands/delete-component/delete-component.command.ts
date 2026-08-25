import { Identity } from '@framework/domain';

export class DeleteComponentCommand {
  constructor(public readonly componentId: Identity) {}
}

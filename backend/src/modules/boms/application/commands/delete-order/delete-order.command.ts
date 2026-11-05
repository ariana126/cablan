import { Identity, Role } from '@framework/domain';

export class DeleteOrderCommand {
  constructor(
    public readonly orderId: Identity,
    // The deleter's current role (`null` for an unknown user), looked up by
    // the controller: the System Admin's delete takes the order's daily BOMs
    // with it (issue #101's approved exception).
    public readonly deleterRole: Role | null,
  ) {}
}

import { Identity } from '@framework/domain';

export class RetireEquipmentCommand {
  constructor(public readonly equipmentId: Identity) {}
}

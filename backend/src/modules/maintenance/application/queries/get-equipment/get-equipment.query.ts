import { Identity } from '@framework/domain';

export class GetEquipmentQuery {
  constructor(public readonly equipmentId: Identity) {}
}

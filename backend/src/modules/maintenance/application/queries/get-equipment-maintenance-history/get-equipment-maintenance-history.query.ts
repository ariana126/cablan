import { Identity } from '@framework/domain';

export class GetEquipmentMaintenanceHistoryQuery {
  constructor(public readonly equipmentId: Identity) {}
}

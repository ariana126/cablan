import { Identity } from '@framework/domain';

/** Retired equipment deleted with its whole plan and history (issue #110). */
export class DeleteEquipmentCommand {
  constructor(public readonly equipmentId: Identity) {}
}

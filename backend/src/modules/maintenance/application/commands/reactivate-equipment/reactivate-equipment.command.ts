import { Identity } from '@framework/domain';
import { RescheduledPlanItem } from '@maintenance/domain/equipment.aggregate';

/**
 * Retired equipment back in service (issue #110). The rows listed get a new
 * first due date; every other active row continues its previous calendar.
 */
export class ReactivateEquipmentCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly rescheduledItems: readonly RescheduledPlanItem[],
  ) {}
}

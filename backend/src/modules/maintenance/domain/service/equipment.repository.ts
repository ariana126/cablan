import { EntityRepository } from '@framework/domain';

import { Equipment } from '../equipment.aggregate';
import { EquipmentName } from '../value/equipment-name.vo';

/**
 * Equipment with its whole PM plan and its service breaks, deactivated items
 * included. Equipment is retired, and only the System Admin deletes retired
 * equipment (issue #110) — its plan items go with it; its executions are the
 * caller's to delete.
 *
 * `save()` persists the aggregate **whole**: a plan item no longer in it (an
 * inactive row deleted) is removed, the rest keep their plan order, and its
 * service breaks are written as it holds them. Saving equipment that was
 * loaded from storage only ever updates it: if it has been deleted
 * meanwhile, the save is refused (`EntityNotFound`) rather than bringing it
 * back.
 */
export abstract class EquipmentRepository extends EntityRepository<Equipment> {
  /** Retired equipment included — a name stays taken until it is deleted. */
  abstract findByName(name: EquipmentName): Promise<Equipment | null>;

  /** Removes it and its plan items, dispatching its released events. */
  abstract delete(equipment: Equipment): Promise<void>;

  /** Every piece of equipment, retired included, in no particular order. */
  abstract list(): Promise<Equipment[]>;
}

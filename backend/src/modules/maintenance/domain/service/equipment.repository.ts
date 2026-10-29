import { EntityRepository } from '@framework/domain';

import { Equipment } from '../equipment.aggregate';
import { EquipmentName } from '../value/equipment-name.vo';

/**
 * Equipment with its whole PM plan, removed items included. No `delete`:
 * equipment is retired, never removed, so its history stays resolvable.
 */
export abstract class EquipmentRepository extends EntityRepository<Equipment> {
  /** Retired equipment included — a name stays taken. */
  abstract findByName(name: EquipmentName): Promise<Equipment | null>;

  /** Every piece of equipment, retired included, in no particular order. */
  abstract list(): Promise<Equipment[]>;
}

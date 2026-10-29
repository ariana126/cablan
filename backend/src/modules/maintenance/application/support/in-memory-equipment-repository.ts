import { DomainEvent, EntityNotFound, Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

// A hand-written fake, not a mock. `savedEvents` keeps what each save
// released, so a spec can assert the fact a command recorded.
export class InMemoryEquipmentRepository extends EquipmentRepository {
  private readonly equipmentById = new Map<string, Equipment>();
  readonly savedEvents: DomainEvent[] = [];

  find(id: Identity): Promise<Equipment | null> {
    return Promise.resolve(this.equipmentById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Equipment> {
    const equipment = await this.find(id);
    if (!equipment) {
      throw EntityNotFound.withId(id);
    }
    return equipment;
  }

  save(entity: Equipment): Promise<void> {
    this.equipmentById.set(entity.id.asString(), entity);
    this.savedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  findByName(name: EquipmentName): Promise<Equipment | null> {
    for (const equipment of this.equipmentById.values()) {
      if (equipment.name().equals(name)) return Promise.resolve(equipment);
    }
    return Promise.resolve(null);
  }

  list(): Promise<Equipment[]> {
    return Promise.resolve([...this.equipmentById.values()]);
  }

  seed(equipment: Equipment): Equipment {
    this.equipmentById.set(equipment.id.asString(), equipment);
    equipment.releaseEvents();
    return equipment;
  }
}

import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { EntityNotFound, Identity } from '@framework/domain';

const DEFAULT_REGISTERED_AT = new Date('2026-01-01T00:00:00.000Z');

// A hand-written fake, not a mock: `BomRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryBomRepository extends BomRepository {
  private readonly bomsById = new Map<string, Bom>();
  private readonly saveCountsById = new Map<string, number>();
  private readonly registeredAtById = new Map<string, Date>();

  // Every BOM saved for the first time is stamped with this instant, as the
  // Prisma repository stamps `createdAt` from the (pinned, in tests) clock.
  constructor(private readonly registrationInstant = DEFAULT_REGISTERED_AT) {
    super();
  }

  find(id: Identity): Promise<Bom | null> {
    return Promise.resolve(this.bomsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Bom> {
    const bom = await this.find(id);
    if (!bom) {
      throw EntityNotFound.withId(id);
    }
    return bom;
  }

  save(entity: Bom): Promise<void> {
    const id = entity.id.asString();
    if (!this.registeredAtById.has(id)) {
      this.registeredAtById.set(id, this.registrationInstant);
    }
    this.bomsById.set(id, entity);
    this.saveCountsById.set(id, this.timesSaved(entity.id) + 1);
    entity.releaseEvents();
    return Promise.resolve();
  }

  // No concurrency to serialise in memory: load, change, save.
  async modify(id: Identity, change: (bom: Bom) => void): Promise<void> {
    const bom = await this.get(id);
    change(bom);
    await this.save(bom);
  }

  delete(bom: Bom): Promise<void> {
    this.bomsById.delete(bom.id.asString());
    this.registeredAtById.delete(bom.id.asString());
    bom.releaseEvents();
    return Promise.resolve();
  }

  // Latest is registration order, as `PrismaBomRepository` reads it: the
  // registration instant, then — for BOMs registered at the same instant —
  // insertion order (a `Map` keeps a key where it was first set, so saving an
  // existing BOM again moves nothing).
  async isLatestOfItsTrackingNumber(id: Identity): Promise<boolean> {
    const boms = await this.list();
    const position = boms.findIndex((bom) => bom.id.equals(id));
    if (position === -1) {
      return true;
    }
    const source = boms[position];
    const registeredAt = this.registeredAtOf(source.id).getTime();
    return !boms.some((other, otherPosition) => {
      if (!other.trackingNumber().equals(source.trackingNumber())) {
        return false;
      }
      const otherRegisteredAt = this.registeredAtOf(other.id).getTime();
      return (
        otherRegisteredAt > registeredAt ||
        (otherRegisteredAt === registeredAt && otherPosition > position)
      );
    });
  }

  list(): Promise<Bom[]> {
    return Promise.resolve([...this.bomsById.values()]);
  }

  // How many times `save()` was called for this BOM — `seed()` does not
  // count. Lets a handler test prove a no-op command writes nothing.
  private registeredAtOf(id: Identity): Date {
    return this.registeredAtById.get(id.asString()) ?? this.registrationInstant;
  }

  timesSaved(id: Identity): number {
    return this.saveCountsById.get(id.asString()) ?? 0;
  }

  seed(bom: Bom, registeredAt = this.registrationInstant): Bom {
    this.bomsById.set(bom.id.asString(), bom);
    this.registeredAtById.set(bom.id.asString(), registeredAt);
    bom.releaseEvents();
    return bom;
  }
}

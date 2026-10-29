import { DomainEvent, EntityNotFound, Identity } from '@framework/domain';
import { MaterialImport } from '@products/domain/material-import.aggregate';
import { MaterialImportRepository } from '@products/domain/service/material-import.repository';

// A hand-written fake, not a mock. Mirrors the Prisma repository's ordering:
// newest by `importedAt`, then by insertion order (the storage `sequence`)
// for imports recorded at the same instant.
export class InMemoryMaterialImportRepository extends MaterialImportRepository {
  private readonly importsById = new Map<string, MaterialImport>();
  private readonly sequenceById = new Map<string, number>();
  private readonly releasedEvents: DomainEvent[] = [];

  find(id: Identity): Promise<MaterialImport | null> {
    return Promise.resolve(this.importsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<MaterialImport> {
    const materialImport = await this.find(id);
    if (!materialImport) {
      throw EntityNotFound.withId(id);
    }
    return materialImport;
  }

  save(entity: MaterialImport): Promise<void> {
    this.store(entity);
    this.releasedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  findLatestNotReverted(): Promise<MaterialImport | null> {
    const latest = [...this.importsById.values()]
      .filter((each) => !each.isReverted())
      .toSorted(
        (a, b) =>
          b.importedAt().getTime() - a.importedAt().getTime() ||
          this.sequenceOf(b) - this.sequenceOf(a),
      )[0];
    return Promise.resolve(latest ?? null);
  }

  seed(materialImport: MaterialImport): MaterialImport {
    this.store(materialImport);
    materialImport.releaseEvents();
    return materialImport;
  }

  /** The events every `save()` dispatched, in order — what the audit log would receive. */
  dispatchedEvents(): DomainEvent[] {
    return [...this.releasedEvents];
  }

  all(): MaterialImport[] {
    return [...this.importsById.values()];
  }

  private store(materialImport: MaterialImport): void {
    const id = materialImport.id.asString();
    if (!this.sequenceById.has(id)) {
      this.sequenceById.set(id, this.sequenceById.size + 1);
    }
    this.importsById.set(id, materialImport);
  }

  private sequenceOf(materialImport: MaterialImport): number {
    return this.sequenceById.get(materialImport.id.asString()) ?? 0;
  }
}

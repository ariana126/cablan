import { EntityNotFound, Identity } from '@framework/domain';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialRepository } from '@materials/domain/service/material.repository';
import { MaterialName } from '@materials/domain/value/material-name.vo';

// A hand-written fake, not a mock: `MaterialRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryMaterialRepository extends MaterialRepository {
  private readonly materialsById = new Map<string, Material>();

  find(id: Identity): Promise<Material | null> {
    return Promise.resolve(this.materialsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Material> {
    const material = await this.find(id);
    if (!material) {
      throw EntityNotFound.withId(id);
    }
    return material;
  }

  save(entity: Material): Promise<void> {
    this.materialsById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  delete(material: Material): Promise<void> {
    this.materialsById.delete(material.id.asString());
    material.releaseEvents();
    return Promise.resolve();
  }

  findByName(name: MaterialName): Promise<Material | null> {
    for (const material of this.materialsById.values()) {
      if (material.name().equals(name)) return Promise.resolve(material);
    }
    return Promise.resolve(null);
  }

  list(): Promise<Material[]> {
    return Promise.resolve([...this.materialsById.values()]);
  }

  seed(material: Material): Material {
    this.materialsById.set(material.id.asString(), material);
    material.releaseEvents();
    return material;
  }
}

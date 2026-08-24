import { Identity } from '@framework/domain';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialName } from '@materials/domain/value/material-name.vo';

// The persistence shape carries only what the domain owns — `id` and `name`.
// `createdAt`/`updatedAt` are managed entirely by the database (`@default(now())`
// and `@updatedAt` in prisma/schema/materials.prisma) and never flow through
// this mapper, so a save can never clobber them with a stale value.
export interface MaterialRecord {
  id: string;
  name: string;
}

export const MaterialMapper = {
  toDomain(record: MaterialRecord): Material {
    return Material.fromPersistence(
      Identity.fromString(record.id),
      MaterialName.fromString(record.name),
    );
  },

  toPersistence(entity: Material): MaterialRecord {
    return {
      id: entity.id.asString(),
      name: entity.name().asString(),
    };
  },
};

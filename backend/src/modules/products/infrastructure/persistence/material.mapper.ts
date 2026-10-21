import { Identity } from '@framework/domain';
import { Material } from '@products/domain/material.aggregate';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

// The persistence shape carries only what the domain owns — `id`, `name` and
// `code`. `createdAt`/`updatedAt` are managed entirely by the database
// (`@default(now())` and `@updatedAt` in prisma/schema/products.prisma) and
// never flow through this mapper, so a save can never clobber them with a
// stale value.
export interface MaterialRecord {
  id: string;
  name: string;
  code: string;
}

export const MaterialMapper = {
  toDomain(record: MaterialRecord): Material {
    return Material.fromPersistence(
      Identity.fromString(record.id),
      MaterialName.fromString(record.name),
      MaterialCode.fromString(record.code),
    );
  },

  toPersistence(entity: Material): MaterialRecord {
    return {
      id: entity.id.asString(),
      name: entity.name().asString(),
      code: entity.code().asString(),
    };
  },
};

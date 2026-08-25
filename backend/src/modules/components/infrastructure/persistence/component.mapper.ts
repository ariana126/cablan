import { Component } from '@components/domain/component.aggregate';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { Identity } from '@framework/domain';

// The persistence shape carries only what the domain owns — `id` and `name`.
// `createdAt`/`updatedAt` are managed entirely by the database (`@default(now())`
// and `@updatedAt` in prisma/schema/components.prisma) and never flow through
// this mapper, so a save can never clobber them with a stale value.
export interface ComponentRecord {
  id: string;
  name: string;
}

export const ComponentMapper = {
  toDomain(record: ComponentRecord): Component {
    return Component.fromPersistence(
      Identity.fromString(record.id),
      ComponentName.fromString(record.name),
    );
  },

  toPersistence(entity: Component): ComponentRecord {
    return {
      id: entity.id.asString(),
      name: entity.name().asString(),
    };
  },
};

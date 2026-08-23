import { Identity, Role } from '@framework/domain';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';
import { User as PrismaUser } from '@prisma/client';

export const UserMapper = {
  toDomain(record: PrismaUser): User {
    return User.fromPersistence(
      Identity.fromString(record.id),
      record.name,
      Username.fromString(record.username),
      record.passwordHash,
      record.role as Role,
      record.isDeleted,
    );
  },

  toPersistence(entity: User): PrismaUser {
    return {
      id: entity.id.asString(),
      name: entity.displayName(),
      username: entity.username().asString(),
      passwordHash: entity.passwordHash(),
      role: entity.role(),
      isDeleted: entity.deleted(),
    };
  },
};

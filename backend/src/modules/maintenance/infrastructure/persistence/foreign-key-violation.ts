import { Prisma } from '@prisma/client';

/**
 * Whether `error` is Postgres refusing a write on a foreign key — P2003, as
 * deleting a row another still references (`ON DELETE RESTRICT`) raises.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

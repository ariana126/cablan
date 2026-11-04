import { Prisma } from '@prisma/client';

/**
 * Whether `error` is Prisma finding no row to write — P2025, as a `delete` of
 * a row another request deleted first raises.
 */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

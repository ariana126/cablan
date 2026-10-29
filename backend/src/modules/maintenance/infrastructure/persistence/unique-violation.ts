import { Prisma } from '@prisma/client';

/**
 * Whether `error` is Postgres refusing a write on a unique index over every
 * one of `columns`. Through the `PrismaPg` driver adapter, P2002 names the
 * columns at `meta.driverAdapterError.cause.constraint.fields`, not at
 * `meta.target` (the same reading as `products`' material repository).
 */
export function isUniqueViolationOn(
  error: unknown,
  ...columns: string[]
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const meta = error.meta as
    | {
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[] } };
        };
      }
    | undefined;
  const fields = new Set(
    (meta?.driverAdapterError?.cause?.constraint?.fields ?? []).map((field) =>
      field.replaceAll('"', ''),
    ),
  );
  return columns.every((column) => fields.has(column));
}

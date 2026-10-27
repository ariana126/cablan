import { Prisma } from '@prisma/client';

// Either the transaction client (the write side, `PrismaBomRepository`) or
// `PrismaService` (the read side, `PrismaBomReportRepository`).
type RawQueryClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * Which of the given daily BOMs have another daily BOM with the same
 * (current) tracking number registered after them — i.e. are *not* the
 * latest of their tracking number, the fact re-sampling turns on. Latest is
 * registration order: `created_at`, then `registration_sequence`, so BOMs
 * registered at one instant (a pinned test clock) still have a latest. Computed on every call, never stored: another
 * BOM's registration, tracking-number edit or deletion changes the answer.
 * Prisma's query API has no correlated `EXISTS`, hence the raw SQL.
 */
export async function idsWithLaterRegistration(
  db: RawQueryClient,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT source.id
    FROM bom source
    WHERE source.id = ANY(${ids}::text[])
      AND EXISTS (
        SELECT 1
        FROM bom later
        WHERE later.tracking_number = source.tracking_number
          AND (later.created_at, later.registration_sequence)
            > (source.created_at, source.registration_sequence)
      )`;
  return new Set(rows.map((row) => row.id));
}

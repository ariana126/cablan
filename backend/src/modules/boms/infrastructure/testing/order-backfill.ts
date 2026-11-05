import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// The legacy carry-over's SQL (issue #101) lives in exactly one place: the
// `order_backfill` migration, one idempotent `DO` block. The test stack
// re-runs it from there (its working directory is the project root, where
// `prisma/migrations` is), so the endpoint and a deploy can never drift.
const MIGRATION_SUFFIX = '_order_backfill';

export function orderBackfillSql(
  migrationsDirectory = path.join(process.cwd(), 'prisma', 'migrations'),
): string {
  const directory = readdirSync(migrationsDirectory).find((name) =>
    name.endsWith(MIGRATION_SUFFIX),
  );
  if (directory === undefined) {
    throw new Error('The order_backfill migration is missing');
  }
  return readFileSync(
    path.join(migrationsDirectory, directory, 'migration.sql'),
    'utf8',
  );
}

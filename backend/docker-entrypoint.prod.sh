#!/bin/sh
# Makes a deploy self-migrating: `make migrate` only ever targets the dev stack
# (see backend/CLAUDE.md's "Two stacks" section), so there is no equivalent manual
# step for production — this is what applies pending migrations before the app
# that depends on them starts serving traffic.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

exec node dist/src/main

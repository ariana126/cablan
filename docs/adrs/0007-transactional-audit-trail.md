# 0007. Write audit entries in the same transaction as the change

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Auditability is a driving characteristic ([0002](0002-architecture-characteristics.md)): a
committed change without an audit entry is a defect. The current implementation cannot guarantee
this.

1. `PrismaEntityRepository.save()` and `.delete()` write the aggregate, and **then** call
   `eventBus.publishAll(...)`. The call is not awaited
   (`backend/src/framework/infrastructure/persistence/prisma.repository.ts:54` and `:65`).
2. `AuditLogProjector.project()` catches every error, logs it, and skips the entry
   (`backend/src/modules/audit-logging/application/service/audit-log-projector.service.ts:62`).
3. Nothing in the backend uses `$transaction`.

As a result, the business change and its audit entry are written in two separate transactions.
Three situations commit the change and lose the entry without any visible failure:

- the process crashes or is redeployed between the two writes;
- a database error occurs while writing the entry;
- the projector has a bug.

This design was simple, and it kept audit failures from blocking business writes. But it trades
away the characteristic we just said matters most.

Options considered:

| Option | Auditability | Simplicity | Notes |
|---|---|---|---|
| A. Keep fire-and-forget | ✗ Entries can be lost silently | ★★★ | Only acceptable if we downgrade auditability |
| **B. Project audit entries in the same database transaction as the aggregate write** | ✓ Atomic: both or neither | ★★ | Same database (see [0004](0004-module-owned-data-and-snapshot-copies.md)), so no new runtime parts. A failure to write the audit entry fails the business write |
| C. Transactional outbox: write the events to an `outbox` table in the same transaction, and have a relay project them | ✓ Eventually complete | ★ | Adds a relay, retries and an idempotency key. Built for asynchronous or distributed consumers, which we don't have ([0005](0005-synchronous-in-process-communication.md)) |
| D. Database triggers | ✓ Atomic | ★ | Puts domain knowledge in SQL. The actor must be passed as a session variable. Hard to test, and invisible to the module structure |

## Decision

We will make every audit entry **atomic with the change it describes**:

- `PrismaEntityRepository.save()` and `.delete()` will run the aggregate write and the projection
  of its released events inside one Prisma interactive transaction.
- The audit event handlers will **await** the projection and will no longer swallow errors. If the
  audit entry cannot be written, the whole command fails and returns a Problem Details error.
- The actor is still resolved from `ActorContext` (AsyncLocalStorage), which is already available
  synchronously within the request.

We choose B over C because C solves a problem we don't have (asynchronous or remote consumers) at
the cost of simplicity. If a non-audit, asynchronous subscriber ever appears, we can revisit C in a
superseding ADR.

## Consequences

- Every committed change has its audit entry, which makes the audit trail evidence rather than
  best effort.
- A fault in the audit module now blocks business writes. We accept this deliberately: we prefer
  "the change didn't happen" to "the change happened without a record".
- The transaction scope has to reach the audit repository. The likely route is a
  transaction-scoped Prisma client passed through `AsyncLocalStorage`, or a unit-of-work port in
  `framework/`. Neither may break `framework-independent-of-modules`.
- Each write takes slightly longer, because it waits for the projection. This is negligible at
  Cablan's volume.
- The current `AuditLogProjector` unit tests that assert "logs and skips" must change to assert
  that the error propagates.

## Compliance

- **Fitness function, unit level:** a backend test that forces the audit repository to throw and
  asserts that the aggregate row was **not** persisted.
- **Fitness function, acceptance level:** for every mutating feature, the scenario's audit-log
  expectation is checked through the admin audit-log API.
- **Review rule:** code that publishes domain events outside the repository's transaction must not
  pass review.

## Notes

- This ADR was raised by the architecture review that produced
  [0002](0002-architecture-characteristics.md).
- Accepted on 2026-10-15. Implementation belongs to `backend-engineer`.
- Implemented on 2026-10-16
  (`docs/superpowers/specs/2026-10-15-transactional-audit-trail-design.md`). The ambient
  transaction comes from `nestjs-cls` with `@nestjs-cls/transactional` and its Prisma adapter, and
  events go through an awaited `DomainEventDispatcher` in `framework/`.
  `make run-integration-tests` is the Compliance section's unit-level fitness function, run
  against a real Postgres.
- Correction to Context point 3: `$transaction` *was* used, by three hand-written delegates
  (product, standard BOM, BOM), each for its own delete-and-recreate of child rows. They now run on
  the repository's transaction instead. The line numbers in points 1 and 2 describe the code before
  this change.

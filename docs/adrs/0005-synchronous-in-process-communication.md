# 0005. Synchronous in-process communication between modules

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Modules must sometimes cooperate:

- product, standard-BOM and daily-BOM registration each validate against the module upstream;
- the deviation dashboard compares daily BOMs with their standard;
- the audit trail observes every change.

*Fundamentals of Software Architecture* (ch. 19) recommends **synchronous by default, asynchronous
only when necessary**. Asynchronous communication brings data-synchronisation problems, race
conditions and debugging difficulty, and Cablan has no scale need that would justify them.

We also had to choose *how* modules talk inside the process. Ch. 11 describes two ways:
peer-to-peer class calls, which are convenient but tend to grow into a Big Ball of Mud, and
calls through a mediator.

## Decision

We will communicate between modules **synchronously, in-process**, and only through the
`@nestjs/cqrs` buses:

- **Queries** (`QueryBus`) are used when a module needs another module's data to make a decision.
  Each such use is a named, narrow exception in `.dependency-cruiser.cjs`.
- **Domain events** (`EventBus`) are used when a module must react to another module's change
  without the source knowing about it. Today the audit trail is the only subscriber.
- **No** module instantiates or injects another module's services, repositories or aggregates.

We will not introduce a message broker, a queue or a scheduler. The buses act as the mediator:
modules depend on the bus and on the shape of a message, not on each other's classes.

## Consequences

- There is no network between modules, so the fallacies of distributed computing don't apply.
  Everything shares one stack trace and one log.
- Each cross-module dependency is visible and has a name: a query or event class plus a lint
  carve-out.
- Coupling is not removed; it moves to the shape of the messages (connascence of name and type).
  Renaming a field on an event affects every subscriber.
- **Domain events are currently published fire-and-forget after commit.** This conflicts with
  auditability, and [0007](0007-transactional-audit-trail.md) addresses it.
- If an asynchronous need appears later (for example, notifications or heavy exports), adopting it
  requires a new ADR that weighs it against simplicity.

## Compliance

- In `.dependency-cruiser.cjs`, `modules-isolated` forbids cross-module imports. Each permitted
  exception is pinned to specific files by its own rule:
  - `product-composition-factory-reuse-is-narrow`
  - `standard-bom-composition-factory-reuse-is-narrow`
  - `bom-composition-factory-reuse-is-narrow`
  - `bom-dashboard-handler-reuse-is-narrow`
  - `audit-logging-event-handlers-reuse-is-narrow`
- There is no messaging or queue dependency in `backend/package.json`.

## Notes

- Recorded retroactively.
- The book's guideline for a modular monolith is roughly five or fewer coupling points per module.
  Today the five carve-outs are spread across four modules.
- Since [0007](0007-transactional-audit-trail.md) was implemented, domain events no longer go
  through `@nestjs/cqrs`' `EventBus`. `PrismaEntityRepository` hands them to
  `DomainEventDispatcher` (`framework/application`), an awaited, sequential, in-process dispatcher
  that runs inside the aggregate write's transaction. Subscribers are marked
  `@DomainEventHandler(EventClass)`. `CommandBus` and `QueryBus` are unchanged.

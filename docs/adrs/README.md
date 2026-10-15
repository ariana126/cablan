# Architecture Decision Records

This folder holds the architecture decisions that shape Cablan, one file per decision, in the
format from Richards & Ford, *Fundamentals of Software Architecture* (2nd ed., ch. 21). Each ADR
records **why**, not only what: you can recover *how* by reading the code, but never *why*.

| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-architecture-characteristics.md) | Auditability, simplicity and agility are the driving characteristics | Accepted |
| [0003](0003-modular-monolith.md) | Use a modular monolith | Accepted |
| [0004](0004-module-owned-data-and-snapshot-copies.md) | One database, tables owned per module, snapshots copied across modules | Accepted |
| [0005](0005-synchronous-in-process-communication.md) | Synchronous in-process communication between modules | Accepted |
| [0006](0006-govern-architecture-with-fitness-functions.md) | Govern the architecture with automated fitness functions | Accepted |
| [0007](0007-transactional-audit-trail.md) | Write audit entries in the same transaction as the change | Accepted |
| [0008](0008-split-boms-by-responsibility.md) | Split the `boms` module into capture, reporting and deviation analysis | Superseded by 0009 |
| [0009](0009-module-structure.md) | Six flat modules, one per domain concept | Accepted |

ADRs 0001–0006 are recorded retroactively: they describe decisions the code already embodies.
ADRs 0007 and 0009 were accepted on 2026-10-15 and are not yet implemented. 0008 was superseded
by 0009 before it was decided.

## Writing a new ADR

Copy the template below into `NNNN-short-kebab-title.md`, using the next number. An ADR is never
edited to reverse it. Instead, write a new ADR and set the old one's status to
`Superseded by NNNN`.

```markdown
# NNNN. Title — a short noun phrase

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context
The forces at play and the alternatives considered. What makes this a decision at all?

## Decision
In the commanding voice: "We will …". Give the justification, including the business one.

## Consequences
What becomes easier and what becomes harder. The trade-off analysis goes here.

## Compliance
How we will know the decision is being followed. Prefer an automated check (a fitness function)
to a manual review.

## Notes
Author, approvals, links, and the history of changes to this record.
```

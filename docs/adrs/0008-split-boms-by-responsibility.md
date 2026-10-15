# 0008. Split the `boms` module into capture, reporting and deviation analysis

- **Status:** Superseded by [0009](0009-module-structure.md)
- **Date:** 2026-10-15

## Context

We identified logical components with the Actor/Action approach from *Fundamentals of Software
Architecture* (ch. 8):

| Actor | Action | Component |
|---|---|---|
| QC inspector, management | Record, edit or delete a daily analysis | Daily Analysis Capture |
| All roles | List, filter, view details and export daily analyses | Analysis Reporting |
| All roles | Review how far daily analyses deviate from their standard | Deviation Analysis |

Today all three live in one module, `backend/src/modules/boms`. Its queries show this:

- capture: `get-bom` and the commands;
- reporting: `list-boms`, `report-boms`, `export-boms`, `bom-filter-options`;
- deviation analysis: `list-dashboard-products`, `get-product-daily-boms`.

The book's **conjunction test** fails on this module. Stated as one sentence, it "records daily
analyses *and* serves filtered reports *and* exports them *and* scores them against their
standards". The module also carries **knowledge** that isn't its responsibility: through the
`bom-dashboard-handler-reuse-is-narrow` carve-out, it queries `standard-boms` to compute
Σ|actual − standard|.

The module names also show a mild **Entity Trap**: they follow entities (`boms`, `standard-boms`)
rather than what the code does. For `materials` and `components` this is fine, because they really
are thin CRUD. `boms` is not.

The three parts also lean on different characteristics:

- **capture** leans on auditability and integrity;
- **reporting** and **deviation analysis** are read-heavy and are where performance will first
  matter.

That is the book's Bid Capture / Auctioneer Capture argument for separating them.

## Decision

*Proposed.* We will give each responsibility its own component.

- **Daily Analysis Capture** stays in `modules/boms`, as the aggregate, its commands, and `get-bom`.
- **Analysis Reporting** becomes its own leaf directory with an explicit boundary. It holds the
  list, report, export and filter-options queries and `BomReportRepository`. `standard-boms` gets
  the same split.
- **Deviation Analysis** becomes a new module, `modules/deviation-analysis`. It owns the dashboard
  queries and reads standard BOMs and daily BOMs through narrow queries. It acts as the mediator
  between the two, so `boms` no longer needs to know about standard BOMs.

`.dependency-cruiser.cjs` will gain a rule per component so the boundaries are enforced, not just
conventional. HTTP routes stay the same, so the API contract and the frontend are unaffected.

## Consequences

- Each component can be described in one sentence, and a change to scoring touches only
  Deviation Analysis.
- `boms` loses its dependency on `standard-boms`. The coupling does not disappear: it moves to
  `deviation-analysis`, which now depends on both. This is the book's caveat about the Law of
  Demeter, and here the coupling lands where it is named and cheap to see.
- If performance is ever promoted
  ([0002](0002-architecture-characteristics.md)), the read-side components are where caching or a
  separate read model would go. They are also the first candidate for a service-based split
  ([0003](0003-modular-monolith.md)).
- The move costs a refactor with no new user-visible behaviour. It should be done while the module
  is still small, or alongside the next feature that touches the dashboard.

## Compliance

- New dependency-cruiser rules:
  - reporting may not import capture's command side;
  - `deviation-analysis` is the only module allowed to query both `boms` and `standard-boms`;
  - `bom-dashboard-handler-reuse-is-narrow` is removed from `boms`.
- `make lint-swagger` and `make lint-api-contract` stay green with no regeneration diff, which
  proves the HTTP contract did not change.

## Notes

- This ADR was raised by the architecture review that produced
  [0002](0002-architecture-characteristics.md).
- Implementation belongs to `backend-engineer` once this ADR is Accepted.

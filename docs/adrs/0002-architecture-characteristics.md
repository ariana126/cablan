# 0002. Auditability, simplicity and agility are the driving characteristics

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Cablan is a quality-control system for a cable manufacturer. Management registers master data
(materials, components, products) and a *standard analysis* (standard BOM) for each MI code. QC
inspectors record a *daily analysis* (daily BOM) for each production order. Every role then reviews
how far production drifts from the standard, through reports, Excel exports and the deviation
dashboard.

We ran the characteristics worksheet from *Fundamentals of Software Architecture* (ch. 5):

| Candidate | Source | Outcome |
|---|---|---|
| Auditability | Explicit: `audit-logging/viewing-audit-log.feature` | **Top three** |
| Simplicity / cost (feasibility) | Implicit: one factory, small team, one PaaS | **Top three** |
| Agility (= modularity + testability + deployability) | Implicit: AI implements, humans validate | **Top three** |
| Data integrity | Implicit: weights drive QC judgements | Considered. Supported through auditability and the per-aggregate invariants |
| Security | Implicit: four roles, exposed on the internet | Considered. Baseline hygiene; nothing structural beyond role checks |
| Performance (reports, dashboard, export) | Implicit | Considered. First to drop under the elimination test |
| Availability | Implicit | Considered. Inspectors work in shifts, but a short outage is not a disaster |

We also looked at the following and decided they are **not** architecture characteristics here:

- **Scalability and elasticity.** Tens of users, not thousands, and no bursts.
- **Internationalisation, RTL and accessibility.** They are real requirements, but they belong to
  design and UX, not structure. They are enforced by `lint-styles` and `lint-accessibility`.
- **Interoperability.** The only integration is Excel export, which runs in the browser.

## Decision

We will treat **auditability**, **simplicity** and **agility** as Cablan's three driving
architecture characteristics. They are unordered: none of them ranks above the others.

- **Auditability.** Every change to business data and users can be traced to an actor, a time,
  and field-level previous and new values. A committed change without an audit entry is a defect.
- **Simplicity.** We choose the least moving parts that meet the requirements: one deployable
  backend, one database, no broker, no scheduler.
- **Agility.** A change to one feature can be made, tested and shipped without understanding or
  breaking the rest. We measure this through its parts:
  - *modularity*: module boundaries enforced by `lint-architecture`;
  - *testability*: unit tests plus executable Gherkin;
  - *deployability*: a commit that passes CI is deployed automatically.

Business justification:
- QC records are evidence about production, so we must be able to answer "who changed this weight,
  and when?"
- The organisation is small. Every extra component costs money to run and staff to understand.
- The product is still being discovered feature by feature, so it must stay cheap to change.

## Consequences

- When a choice trades one characteristic for another, these three win. Performance, scalability
  and fault tolerance get no structural support until a new ADR changes this list.
- Where simplicity conflicts with auditability, we treat it as an explicit decision rather than
  letting it happen by accident. The first such conflict is [0007](0007-transactional-audit-trail.md).
- **Things that would reopen this ADR:**
  - a compliance obligation for the audit trail, such as ISO 9001 or customer audits, which would
    raise integrity requirements;
  - daily-BOM volume or retention that makes query-time reporting slow, which would promote
    performance;
  - a second site or tenant.

## Compliance

- **Auditability:** the `audit-logging` acceptance scenarios, plus the fitness function proposed
  in [0007](0007-transactional-audit-trail.md).
- **Simplicity:** reviewers reject a new runtime component (broker, cache, scheduler, extra
  service) unless an ADR justifies it.
- **Agility:** the nine CI gates mirrored by `make run-guardrails`; see
  [0006](0006-govern-architecture-with-fitness-functions.md).

## Notes

- The stakeholders chose the top three on 2026-10-15.

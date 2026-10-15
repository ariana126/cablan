# 0003. Use a modular monolith

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

We had to decide whether Cablan should be one deployable unit or several, and how to partition
the code. The deciding question (*Fundamentals of Software Architecture*, ch. 19) is whether one
set of architecture characteristics serves the whole system:

- **It does.** [0002](0002-architecture-characteristics.md) names one set (auditability,
  simplicity, agility), and no part of the system needs to scale, fail or deploy differently from
  the rest. That makes Cablan a single **architecture quantum**.
- **The domain is semantically coupled.** It forms one chain: material → component → product →
  standard BOM → daily BOM → deviation score. Each step validates against the one before it. The
  book warns that a heavily coupled domain fits a deliberately coupled style, not a distributed
  one.

Options considered:

| Option | For | Against |
|---|---|---|
| Layered monolith (technical partitioning) | Simplest to start | Each feature is spread across every layer, which hurts agility. Data coupling closes off any later split |
| **Modular monolith (domain partitioning)** | Cost and simplicity ★★★★★, modularity ★★★★. Matches how change arrives (one feature at a time) | Boundaries need strict governance. Scalability, elasticity and fault tolerance ★ |
| Service-based | Fault isolation, independent deploys | More to run on Hamravesh. Needs cross-service workflows for a chained domain |
| Microservices | Maximum independence | Distributed transactions and network fallacies across a semantically coupled domain. Far beyond our team and budget |

## Decision

We will build Cablan as a **modular monolith**. There is one NestJS backend, partitioned by
domain into modules under `backend/src/modules/`: `identity`, `materials`, `components`,
`products`, `standard-boms`, `boms` and `audit-logging`. Shared infrastructure lives in
`backend/src/framework/`.

Inside each module the code is layered `domain` → `application` → `infrastructure`, and only
inward dependencies are allowed. This is hexagonal style within the module, and keeps
framework code out of the domain.

The frontend is a separate deployable (an nginx-served Angular app that proxies `/api`). It belongs
to the same quantum, because it calls the backend synchronously and has no characteristics of its
own.

## Consequences

- One image, one database and one deploy pipeline keep simplicity high and running cost low.
- A feature is a vertical slice through one module, which makes `develop-feature` slices and their
  tests local to that module.
- **The style's main risk is boundary erosion.** It is too easy to import a class from another
  module, and doing so turns the system into a Big Ball of Mud.
  [0006](0006-govern-architecture-with-fitness-functions.md) is the price we pay to avoid that.
- One crash or memory leak takes down the whole backend, and the whole backend scales as one unit.
  We accept this, given 0002.
- **If we ever need to split, the path is service-based, not microservices.** The likely first
  candidate is a separate read-side for reporting and deviation analysis on the same database.
  Signs that it is time:
  - changes take too long;
  - a change in one area breaks unrelated areas;
  - people get in each other's way;
  - startup is slow.

## Compliance

- `make lint-architecture` (dependency-cruiser) enforces the `modules-isolated` rule and the
  layering rules. See [0006](0006-govern-architecture-with-fitness-functions.md).
- `backend/Dockerfile.prod` produces the single backend deployment unit, and
  `.github/workflows/deploy.yml` ships exactly one backend app and one frontend app.

## Notes

- Recorded retroactively. The structure has existed since the first feature slices (2026-08).

# 0006. Govern the architecture with automated fitness functions

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Agility ([0002](0002-architecture-characteristics.md)) and the modular monolith
([0003](0003-modular-monolith.md)) only hold up as long as the module boundaries do. Reviewing
code catches a boundary violation too late, and when the schedule is tight it isn't reliable.
Most of Cablan's code is written by AI agents, which makes this worse: an agent will happily take
the shortest path across a boundary unless something stops it.

*Fundamentals of Software Architecture* (ch. 6) calls any objective, automated check of an
architecture characteristic a **fitness function**. Fitness functions exist to guard what is
important but not urgent.

## Decision

We will enforce the architecture with automated fitness functions. Each one gets a root `make`
target, a CI job in `.github/workflows/ci.yml`, and a line in `make run-guardrails`. A task is not
done until `make run-guardrails` is green.

| Characteristic | Fitness function |
|---|---|
| Modularity | `make lint-architecture`: dependency-cruiser checks no cycles, domain → application → infrastructure layering, no framework libraries in the domain, the framework not depending on modules, and `modules-isolated` with narrow carve-outs |
| Testability | `make run-unit-tests` (Jest + Vitest), and `make run-acceptance-tests` (executable Persian Gherkin, published as living documentation) |
| Deployability | `.github/workflows/deploy.yml` deploys only commits for which CI has passed on `main` |
| Interface stability | `make lint-swagger` (the spec matches the code) and `make lint-api-contract` (the frontend's copy matches that spec) |
| Usability and accessibility (design-level) | `make lint-styles` (design-system tokens only, logical CSS properties for RTL) and `make lint-accessibility` (axe WCAG A/AA, light and dark) |
| Code hygiene | `make lint`, `make format` |

When a new architectural rule is needed, we will add it as a fitness function, not as an
unenforced convention.

## Consequences

- Boundary erosion is caught at commit time rather than discovered months later.
- An exception to a rule is explicit, has a name, and can be reviewed (see the carve-outs in
  [0005](0005-synchronous-in-process-communication.md)).
- CI takes longer and runs nine jobs, and the acceptance and accessibility jobs cold-build
  Chromium images. We accept the cost in exchange for agility.
- Changes under `.claude/**` and `*.md` skip CI, so these ADRs and the hooks are not checked
  automatically.

## Compliance

This ADR is followed when every row in the table above has a matching CI job and a matching
`run-guardrails` step. The root `CLAUDE.md` lists all nine.

**Gaps to close:**

- **Auditability has no fitness function yet.** See [0007](0007-transactional-audit-trail.md).
- **There is no coupling budget.** We could add a check that fails when any module has more than
  N cross-module carve-outs.
- **There is no performance baseline** for the dashboard or exports at realistic data volume.

## Notes

- Recorded retroactively.

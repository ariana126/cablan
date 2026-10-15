# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Cablan's structure is held in place by decisions that until now were spread across several places:
the `CLAUDE.md` files, `.dependency-cruiser.cjs` comments, the retros in `docs/retros/`, and commit
messages. Most of the code is written by AI agents and checked by humans. That makes it especially
important to write down *why* a structure exists. An agent, or a new developer, can read *how* the
code works, but cannot work out the trade-off that was accepted, and may "fix" it away.

## Decision

We will record every architecturally significant decision as an ADR in `docs/adrs/`, using the
template in `docs/adrs/README.md`. We use Nygard's test for "significant": the decision affects
structure, non-functional characteristics, dependencies, interfaces, or construction techniques.

## Consequences

- Each decision has one system of record. The `CLAUDE.md` files and PR descriptions should link
  to the ADR rather than repeat its reasoning.
- Reversing a decision means writing a new ADR, so the history of how our thinking changed stays
  readable.
- Writing ADRs takes time. We accept that cost only for decisions that pass the significance test.
  Ordinary design choices inside a module stay in that module's `CLAUDE.md`.

## Compliance

During review of any change that alters module boundaries, data ownership, inter-module
communication, or a guardrail, ask: "which ADR covers this, and does it need a new one?"

## Notes

- This record was created as part of an architecture review based on *Fundamentals of Software
  Architecture* (2nd ed.).

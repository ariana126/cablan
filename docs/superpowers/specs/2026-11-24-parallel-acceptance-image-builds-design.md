# Parallel image builds for the acceptance run — design

Date: 2026-11-24 · Size: small change

## Intent

CI's acceptance job is the long pole of every run (31–41 min; the next job is ~14 min).
About 6.5 min of it is three Docker image builds done one after another, because
`make run-acceptance-tests` runs `backend test-up` → `frontend test-up` → `acceptance-tests up`,
and each `up --build` builds its own image before starting. Building the three images at the same
time should cut that to roughly the slowest single build — about 4 min saved per run — while
every image is still built from scratch, so CI keeps proving a clean build works.

## Goals, non-goals, anti-goals

- **Goal:** the three test images of the acceptance run build concurrently, before any stack starts.
- **Non-goals:** the accessibility job (explicitly left out), Docker layer caching, sharding the
  suite, any change to the scenarios.
- **Anti-goals:** losing the from-scratch build proof; the root Makefile learning a project's
  Compose files or env files; changing the start-up order of the stacks; interleaved, unreadable
  build logs.

## Approaches

- **A — Make-level parallel builds, sequential start-up (picked).** Each project exposes a target
  that builds its test image; the root runs the three with `make -j3 --output-sync=target`, then
  the existing ordered `test-up`/`up` calls, which find their images already built. Keeps the root
  a pure delegator. Chosen for that, at near-full saving.
- **B — `docker buildx bake` across all three Compose files.** Marginally better scheduling, but
  the root would have to name each project's Compose and env files. Rejected.
- **C — A, plus starting the three stacks concurrently.** ~30 s more, but drops the start-up order
  root `CLAUDE.md` requires and makes a start-up failure harder to read. Rejected.

## Design

- **backend:** new `test-build` target — builds the test stack's image (`$(COMPOSE_TEST) build`),
  `setup` as prerequisite, with a `## ` help comment.
- **frontend:** the same `test-build` target for its test stack.
- **acceptance-tests:** no change — its existing `build` target already builds its image.
- **root `Makefile`:** `run-acceptance-tests` first runs
  `$(MAKE) -j3 --output-sync=target backend/test-build frontend/test-build acceptance-tests/build`,
  then the existing four lines unchanged. A failing build fails the target before anything starts.
  A comment says why the builds are parallel but the start-ups are not.
- **docs:** root `CLAUDE.md`'s paragraph on `make run-acceptance-tests` gains a sentence on the
  parallel build step; backend/frontend `CLAUDE.md` mention `test-build` where they list targets,
  if they do.

## Left to the builder

- Exact recipe wording and comments in each Makefile.
- Whether `--output-sync=target` or `=recurse` reads better in the CI log (target is the default
  choice: each project's build log lands as one block when that build finishes).

## Verification

A dispatched CI run on a `wip/*` branch (per `CLAUDE.local.md`): all ten checks green, and the
acceptance job's log shows the three builds overlapping, with the build phase before
`npm test` well under the current ~7.5 min.

# Parallel Acceptance Image Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `make run-acceptance-tests` builds the backend, frontend and acceptance-tests test images concurrently before starting the stacks in their existing order.

**Architecture:** Each project exposes a "build my test image" target; the root runs the three with
`$(MAKE) -j3 --output-sync=target`, then the unchanged ordered start-up lines, whose `up --build`
now finds every layer already built. No caching: every image still builds from scratch in CI.

**Tech Stack:** GNU Make 4.x (`-j`, `--output-sync`), Docker Compose v2.

**Spec:** `docs/superpowers/specs/2026-11-24-parallel-acceptance-image-builds-design.md`

## Global Constraints

- Root `Makefile` stays a pure delegator: it names targets, never a project's Compose or env files.
- Start-up order unchanged: backend `test-up` → frontend `test-up` → acceptance-tests `up` → `run`.
- Every target with a `## ` comment so `make help` lists it.
- Accessibility job, layer caching, sharding: out of scope.
- Per root `CLAUDE.md`: each project's files are edited only by its agent (`backend-engineer`,
  `frontend-engineer`, `qa-engineer`); the orchestrator edits the root `Makefile` and root docs.
- Heavy checks run on a dispatched `wip/*` CI run (`CLAUDE.local.md`), not locally.

## Review Focus

1. **Fresh checkout, no `.env` files** (CI's situation): every build target must create its env
   files first, or `docker compose build` fails on the missing `env_file`. Today
   `acceptance-tests`' `build` has no `setup` prerequisite — Task 3 adds it; Tasks 1–5 check with
   a dry run from a state without `.env`.
2. **One build fails while the others run:** the root target must exit non-zero and start no stack.
   `-j3` without `-k` stops scheduling after the failure and Make exits 2 — Task 4's dry run
   confirms the recipe has no `|| true` or `-` prefix.
3. **Two `setup` runs racing under `-j3`:** each project's `setup` touches only its own directory,
   so the three are independent — nothing to add, but no task may make a build target call another
   project's setup.
4. **Typo'd passthrough target succeeds silently** (subproject `%:` catch-all): a misspelled
   `backend/test-buld` would skip the backend build and still exit 0. Task 4's dry run must show a
   real `docker compose … build` line for each of the three.
5. **Readable CI log:** with `--output-sync=target` each build's output lands as one block; the
   job log must still show the three builds overlapping in time (Task 5).

---

### Task 1: backend `test-build`

**Agent:** `backend-engineer` · **Files:** Modify `backend/Makefile`, `backend/CLAUDE.md` (its
test-stack command list, beside `make test-up`).

**Produces:** `make -C backend test-build` — builds the test stack's image(s) only.

- [ ] **Step 1:** Add `test-build: setup ## Build (if needed) the test stack's image, without starting it` with recipe `$(COMPOSE_TEST) build`; add it to `.PHONY` if the file keeps one.
- [ ] **Step 2: Verify:** `make -C backend -n test-build` prints `docker compose --env-file .env.test -f docker-compose.yml -f docker-compose.test.yml build`; `make -C backend help` lists `test-build`.
- [ ] **Step 3:** Document it in `backend/CLAUDE.md` next to `make test-up`.

### Task 2: frontend `test-build`

**Agent:** `frontend-engineer` · **Files:** Modify `frontend/Makefile`, `frontend/CLAUDE.md` (only
if it lists the test-stack targets).

**Produces:** `make -C frontend test-build`, same contract as Task 1.

- [ ] **Step 1:** Add `test-build: setup ## Build (if needed) the test server's image, without starting it` with recipe `$(COMPOSE_TEST) build`.
- [ ] **Step 2: Verify:** `make -C frontend -n test-build` prints the `$(COMPOSE_TEST) … build` line (no `a11y` profile, no `up`); `make -C frontend help` lists it.

### Task 3: acceptance-tests `build` creates its `.env`

**Agent:** `qa-engineer` · **Files:** Modify `acceptance-tests/Makefile`.

**Produces:** `make -C acceptance-tests build` safe on a fresh checkout.

- [ ] **Step 1:** Change `build:` to `build: setup` (recipe unchanged).
- [ ] **Step 2: Verify:** `mv .env .env.bak; make -n build` lists the `cp .env.example .env` guard before `docker compose build`; restore `.env.bak`.

### Task 4: root `run-acceptance-tests` builds in parallel

**Agent:** orchestrator · **Files:** Modify `Makefile` (`run-acceptance-tests`), `CLAUDE.md` (the
paragraph starting "`make run-acceptance-tests` brings up the backend test stack").

**Consumes:** `backend/test-build`, `frontend/test-build`, `acceptance-tests/build` (Tasks 1–3).

- [ ] **Step 1:** Make the recipe's first line `@$(MAKE) -j3 --output-sync=target backend/test-build frontend/test-build acceptance-tests/build`, keeping the four existing lines after it, with a comment: builds are independent so they run together; start-up stays ordered because the frontend and suite talk to the backend.
- [ ] **Step 2: Verify:** `make -n run-acceptance-tests` shows three `docker compose … build` lines (backend test, frontend test, acceptance-tests) before the first `up` line, and the `up` lines in today's order.
- [ ] **Step 3:** Add one sentence to root `CLAUDE.md`'s paragraph: the three images build in parallel first (`-j3`, output grouped per project), then the stacks start in order.

### Task 5: prove it in CI

**Agent:** orchestrator.

- [ ] **Step 1:** `make fix-violations` is not needed (Makefiles and Markdown only); per `CLAUDE.local.md`, branch `wip/parallel-acceptance-builds`, commit, push, `gh workflow run ci.yml --ref wip/parallel-acceptance-builds`, watch in the background.
- [ ] **Step 2: Verify:** all ten jobs green; in the acceptance job log, the three `Built` lines fall within one overlapping window, and the time from job start to `docker compose exec app npm test` is well under the ~7.5 min baseline (run 45438723523).
- [ ] **Step 3:** On green, squash onto `main` with real commits (messages confirmed with the user), delete the wip branch.

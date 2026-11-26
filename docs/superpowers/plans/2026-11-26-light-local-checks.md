# Light Local Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This machine runs only the dev servers and light checks, from slim images. Every heavy check
refuses to run here and points at the wip-branch CI run instead.

**Architecture:**
- An opt-in environment variable, set only in this machine's Claude settings, turns each heavy
  Makefile target into a refusal, and narrows `up` to the dev stack.
- Dockerfiles gain light stages, and dev services get fixed image names, so worktree stacks share one
  image per project.
- Staging gets log rotation.
- CI and other developers see no behaviour change apart from the image names and the
  acceptance-tests light stage.

**Tech Stack:** GNU Make, Docker Compose v2 (Compose 5.6, Docker 29), Dockerfiles on `node:24-bookworm-slim`.

**Spec:** `docs/superpowers/specs/2026-11-26-light-local-checks-design.md`

## Global Constraints

- Variable name: `CABLAN_HEAVY_CHECKS_IN_CI`. A non-empty value means "heavy checks are CI-only
  here". An empty or unset value means today's behaviour, exactly.
- Refusal message, which goes to stderr, followed by exit 1. Every subproject uses this exact text, with `$@` as the target:
  `make $@ runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set). Dispatch CI on your wip branch: gh workflow run ci.yml --ref wip/<slug>. To run it here anyway: CABLAN_HEAVY_CHECKS_IN_CI= make $@`
- Skip notice when `up` leaves the test stack out (stdout, exit 0):
  `Skipping the test stack: it runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set).`
- Image names: `cablan-backend-dev`, `cablan-frontend-dev`, `cablan-acceptance-tests-deps`,
  `cablan-acceptance-tests-suite`.
- Worktree stack names: `<default project name>-i<issue>`; teardown: `docker compose -p <name> down -v`.
- Staging logging: `driver: json-file`, `max-size: 10m`, `max-file: "3"`.
- Each subproject stays independent: its Makefile carries its own guard lines and includes nothing
  from outside the project. Backend and frontend files never mention acceptance-tests.
- Ownership: `backend/` belongs to the backend-engineer, `frontend/` to the frontend-engineer,
  `acceptance-tests/` to the qa-engineer. Root files, `deploy/`, `.claude/` and `docs/` belong to
  the orchestrator.
- Disk: build no production image locally except the one-off check in Task 2, and remove that
  image straight afterwards. Run no heavy target locally while verifying, other than to see it
  refuse.

## Review Focus

1. **CI with the variable unset.** `make -n` of each heavy target must show the same commands as
   before, and the wip CI run must pass all ten jobs (Task 7).
2. **Root `make up` with the guard set.** It must succeed: dev stacks up, the test stacks
   skipped, and the acceptance suite skipped with a notice (Task 4, Step 6; Task 7, Step 2).
3. **The empty-value override.** `CABLAN_HEAVY_CHECKS_IN_CI= make -n -C backend test-up` must
   print the compose command, not the refusal (Task 2, Step 2).
4. **`down`/`reset` with the guard set.** They must still stop a test stack left running from
   before (Task 2, Step 6).
5. **A worktree-named stack.** `COMPOSE_PROJECT_NAME=cablan-backend-i999 make -C backend up` must
   reuse `cablan-backend-dev` and must not create a `cablan-backend-i999-app` image (Task 2, Step 7).

---

### Task 1: The guard variable and the root `run-guardrails` guard (orchestrator)

**Files:**
- Modify: `.claude/settings.local.json` (gitignored; add `env`)
- Modify: `Makefile` (`run-guardrails` recipe)

**Interfaces:**
- Produces: `CABLAN_HEAVY_CHECKS_IN_CI=1` in the environment of every Claude session and
  subagent on this machine. Tasks 2–4 verify against it.

- [ ] **Step 1: Add the variable.** Add `"env": { "CABLAN_HEAVY_CHECKS_IN_CI": "1" }` to
  `.claude/settings.local.json`, keeping `enabledMcpjsonServers`.
- [ ] **Step 2: Guard `run-guardrails`.** Make its first recipe line refuse with the Global
  Constraints message when `$(CABLAN_HEAVY_CHECKS_IN_CI)` is non-empty. Leave the ten `$(MAKE)`
  lines unchanged.
- [ ] **Step 3: Verify.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make run-guardrails; echo $?`: the message, then `1`, and no
    `lint-api-contract` output before it.
  - `CABLAN_HEAVY_CHECKS_IN_CI= make -n run-guardrails`: the ten `make` lines.
- [ ] **Step 4: Verify that sessions see it.** In a new Claude session, `echo $CABLAN_HEAVY_CHECKS_IN_CI` prints `1`.

### Task 2: The backend (backend-engineer)

**Files:**
- Modify: `backend/Makefile` (guard definition; `run-integration-tests`, `test-build`, `test-up`, `up`)
- Modify: `backend/docker-compose.yml` (`app.image`)
- Modify: `backend/Dockerfile`, `backend/Dockerfile.prod` (the apt lines)
- Modify: `backend/CLAUDE.md` (document the guard, the image name, `--renew-anon-volumes`, the toolchain removal)

**Interfaces:**
- Consumes: `CABLAN_HEAVY_CHECKS_IN_CI` (Task 1).
- Produces: the image `cablan-backend-dev`, shared by `cablan-backend`, `cablan-backend-test` and
  any `cablan-backend-i<N>` project.

- [ ] **Step 1: Guard the heavy targets.**
  - `test-build`, `test-up` and `run-integration-tests` refuse when the variable is set: the
    message first, before any `docker` command.
  - `run-integration-tests` keeps `test-up` as its prerequisite, so its refusal names `test-up`.
    That is acceptable.
- [ ] **Step 2: Verify the guard.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C backend test-up; echo $?` prints the message, then `1`.
    The same goes for `test-build`.
  - `CABLAN_HEAVY_CHECKS_IN_CI= make -n -C backend test-up` prints
    `docker compose --env-file .env.test … up --build -d --wait`.
- [ ] **Step 3: Make `up` dev-only under the guard.**
  - The first line becomes `docker compose up --build -d --wait --renew-anon-volumes`.
  - The test stack's line runs only when the variable is empty, and also gets
    `--renew-anon-volumes`. Otherwise it prints the skip notice.
  - Update the `## ` help text to say "the test stack too unless CABLAN_HEAVY_CHECKS_IN_CI is set".
- [ ] **Step 4: Name the image.** Add `image: cablan-backend-dev` beside `build: .` on
  `app` in `docker-compose.yml`. The test override inherits it.
- [ ] **Step 5: Remove the toolchain.**
  - In `Dockerfile`, drop `python3 build-essential` and keep `procps`.
  - In `Dockerfile.prod`, delete both apt `RUN` lines and their bcrypt comments.
  - Rebuild with `make -C backend build`.
  - Check that bcrypt loads and hashes:
    `docker compose -f backend/docker-compose.yml run --rm --no-deps app node -e "const b=require('bcrypt');process.exit(b.compareSync('x',b.hashSync('x',4))?0:1)"`
    should exit 0.
  - Then `make -C backend build-prod`, then
    `docker run --rm --entrypoint node cablan-backend:prod -e "<same script>"` should exit 0,
    then `docker rmi cablan-backend:prod`.
  - **If `npm ci` fails without the toolchain**, restore both Dockerfiles, report it, and carry on
    with Steps 6–8.
- [ ] **Step 6: Verify `up`/`down` with the guard.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C backend up` prints the skip notice, and
    `docker ps --filter name=cablan-backend-test` lists nothing new.
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -n -C backend down` still prints both `down` lines.
- [ ] **Step 7: Verify a worktree-named stack.**
  - `COMPOSE_PROJECT_NAME=cablan-backend-i999 APP_PORT=3999 POSTGRES_PORT=5999 STUDIO_PORT=5998 CABLAN_HEAVY_CHECKS_IN_CI=1 make -C backend up`
    becomes healthy.
  - `docker images --format '{{.Repository}}' | grep -c '^cablan-backend-i999'` prints `0`.
  - Then `docker compose -p cablan-backend-i999 down -v`.
  - Use different port values for the Studio port and Postgres if `5999` clashes.
- [ ] **Step 8: Run the light checks.** `make -C backend lint`, `format`, `lint-architecture`,
  `run-unit-tests` all green. Run nothing heavy.

### Task 3: The frontend (frontend-engineer)

**Files:**
- Modify: `frontend/Makefile` (guard definition; `lint-accessibility`, `test-build`, `test-up`, `up`)
- Modify: `frontend/docker-compose.yml` (`app.image`)
- Modify: `frontend/CLAUDE.md` (document the guard, the image name, `--renew-anon-volumes` and its `.angular` cost)

**Interfaces:**
- Consumes: `CABLAN_HEAVY_CHECKS_IN_CI` (Task 1).
- Produces: the image `cablan-frontend-dev`, shared by `cablan-frontend`, `cablan-frontend-test`
  and any `cablan-frontend-i<N>` project.

- [ ] **Step 1: Guard the heavy targets.** `lint-accessibility`, `test-build` and `test-up`
  refuse when the variable is set, before any `docker` command.
- [ ] **Step 2: Verify the guard.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C frontend lint-accessibility; echo $?` prints the
    message, then `1`. The same goes for `test-up`.
  - `CABLAN_HEAVY_CHECKS_IN_CI= make -n -C frontend lint-accessibility` prints both compose lines.
- [ ] **Step 3: Make `up` dev-only under the guard.** Same shape as Task 2, Step 3:
  `--renew-anon-volumes` on both lines, the test line conditional, the skip notice, and the help text.
- [ ] **Step 4: Name the image.** Add `image: cablan-frontend-dev` on `app`. Leave the `a11y`
  service's image unnamed.
- [ ] **Step 5: Verify.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C frontend up` prints the skip notice and the dev server
    answers on `:4200`.
  - `docker images --format '{{.Repository}}' | grep -x cablan-frontend-dev` matches.
- [ ] **Step 6: Run the light checks.** `make -C frontend lint`, `lint-styles`, `format`,
  `run-unit-tests` all green.

### Task 4: acceptance-tests (qa-engineer)

**Files:**
- Modify: `acceptance-tests/Dockerfile` (stages `deps` and `suite`)
- Modify: `acceptance-tests/docker-compose.yml` (`app` → `target: suite`, `image: cablan-acceptance-tests-suite`; new `check` service)
- Modify: `acceptance-tests/Makefile` (guard; `up`, `build`, `run`, the living-documentation targets; the light targets on `check`; new `typecheck`)
- Modify: `acceptance-tests/CLAUDE.md`

**Interfaces:**
- Consumes: `CABLAN_HEAVY_CHECKS_IN_CI` (Task 1).
- Produces:
  - the service `check`: `target: deps`, `image: cablan-acceptance-tests-deps`,
    `profiles: [check]`, the same `./:/app` and `/app/node_modules` volumes, and no
    `network_mode`;
  - the target `make -C acceptance-tests typecheck` (`tsc --noEmit` in `check`).

- [ ] **Step 1: Split the Dockerfile.**
  - `deps` holds the base, `WORKDIR`, `package*.json`, `patches/`, `npm ci` (with the Playwright
    download skipped) and `COPY . .`.
  - `suite` (`FROM deps`) adds the JRE, the `PLAYWRIGHT_DOWNLOAD_HOST` arg,
    `playwright install --with-deps chromium` and the `CMD`.
  - Keep the existing comments, each beside its own line.
- [ ] **Step 2: Wire Compose.**
  - `app` builds `target: suite` as `cablan-acceptance-tests-suite`.
  - Add `check` as in the Interfaces block.
- [ ] **Step 3: Point the light targets at `check`.**
  - `lint`, `fix-lint`, `format` and `fix-format` run `docker compose run --rm check …`.
  - Add `typecheck: setup ## TypeScript check (read-only)`, which runs `tsc --noEmit` in `check`.
- [ ] **Step 4: Guard.**
  - `run`, `render-living-documentation` and `open-living-documentation` refuse when the
    variable is set.
  - `up` prints `Skipping the acceptance suite container: it runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set).`
    and exits 0.
  - `build` builds only `check` (`docker compose --profile check build check`).
  - With the variable empty, `up` and `build` stay exactly as today, building `app`.
- [ ] **Step 5: Verify the light path.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C acceptance-tests lint format typecheck` are all green.
  - `docker images --format '{{.Repository}} {{.Size}}' | grep cablan-acceptance-tests` shows
    only `-deps`, well under 1 GB.
- [ ] **Step 6: Verify the guard.**
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C acceptance-tests run; echo $?` prints the message, then `1`.
  - `CABLAN_HEAVY_CHECKS_IN_CI=1 make -C acceptance-tests up; echo $?` prints the skip notice,
    then `0`.
  - `CABLAN_HEAVY_CHECKS_IN_CI= make -n -C acceptance-tests up` prints `docker compose up --build -d`.

### Task 5: Staging log rotation (orchestrator)

**Files:**
- Modify: `deploy/staging/compose.yml`

- [ ] **Step 1: Add the logging.** Add a top-level `x-logging: &logging` with the Global
  Constraints values, and `logging: *logging` on `db`, `backend` and `frontend`.
- [ ] **Step 2: Verify.**
  `IMAGE_TAG=x REGISTRY=r BACKEND_APP_NAME=b FRONTEND_APP_NAME=f POSTGRES_PASSWORD=p JWT_SECRET=j DEFAULT_ADMIN_USERNAME=u DEFAULT_ADMIN_PASSWORD=p docker compose -f deploy/staging/compose.yml config | grep -c 'max-size: 10m'`
  prints `3`. Do not touch the running staging stack. The next deploy applies the change.

### Task 6: Instructions and documentation (orchestrator)

**Files:**
- Modify: `CLAUDE.local.md` (the local/CI split from the spec's Decision 1; the variable; "the
  light checks run locally, the heavy ones by wip CI dispatch")
- Modify: `CLAUDE.md`:
  - under Commands, the opt-in guard, how to override it, and that `up` goes dev-only under it;
  - the worktree stack convention (spec Decision 7);
  - the staging logging, in the staging section;
  - the "holds no logic" sentence now names the `run-guardrails` guard as well.
- Modify: `.claude/agents/backend-engineer.md`, `frontend-engineer.md`, `qa-engineer.md`: one
  line each, saying "on a machine with `CABLAN_HEAVY_CHECKS_IN_CI` set, run only your light
  checks; a refused target is CI's, so report it rather than overriding".
- Modify: the memory files `checks-in-ci-not-local.md` and `disk-space-guardrails.md`, and the
  `MEMORY.md` index lines

- [ ] **Step 1: Write the edits above.** Restate no subproject CLAUDE.md content.
- [ ] **Step 2: Verify.** `grep -c CABLAN_HEAVY_CHECKS_IN_CI CLAUDE.md CLAUDE.local.md .claude/agents/*.md`
  gives a non-zero count for every file.

### Task 7: Verification, cleanup and landing (orchestrator)

- [ ] **Step 1: Check that CI's commands are unchanged.** With the variable unset,
  `make -n run-acceptance-tests`, `make -n run-integration-tests` and `make -n lint-accessibility`
  print the same command sequences as on `main`, apart from the added `--renew-anon-volumes` and
  the acceptance build's target. Compare against the same commands' output from a throwaway
  `git worktree add` of `main`, then remove that worktree.
- [ ] **Step 2: Check root `make up` with the guard.** `make up` with the variable set ends at exit 0.
  `make ps` shows the dev backend, its db and the dev frontend, and no `-test` or `acceptance-tests`
  container.
- [ ] **Step 3: Clean up the old images.** Remove the stopped containers and the images that
  no longer have a use:
  - the containers `cablan-backend-test-app-1`, `cablan-backend-test-db-1`,
    `cablan-frontend-test-app-1`, `cablan-acceptance-tests-app-1` and the old `cablan-frontend-app-1`;
  - the images `cablan-backend-app`, `cablan-backend-test-app`, `cablan-frontend-app`,
    `cablan-frontend-test-app`, `cablan-acceptance-tests-app`.

  Never touch `cablan-staging-*`, `authelia`, `postgres:16-alpine`, `darkube-cli:v1.1` or the
  `cablan-backend_pgdata` volume. Record `df -h /` before and after.
- [ ] **Step 4: Run CI on a wip branch.** Follow `CLAUDE.local.md`'s flow:
  - commit to `wip/light-local-checks`, push, then `gh workflow run ci.yml --ref wip/light-local-checks`;
  - watch the run in the background;
  - expect all ten jobs green;
  - route each failure to the agent that owns the file.
- [ ] **Step 5: Land it.**
  - After a green run, `git merge --squash` onto `main`.
  - Propose commit messages for the user to confirm. Suggested split: `build(backend)`,
    `build(frontend)`, `build(acceptance-tests)`, `ci(staging)`,
    `docs: light local checks design, plan and instructions`.
  - Delete the wip branch.
  - Promoting to staging is the user's call.

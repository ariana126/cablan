# Light local checks, heavy checks in CI — design

## Problem

The dev machine has a 47 GB disk. It is also the team server: staging, Authelia and the
self-hosted GitHub runner run on it. That disk keeps filling up mid-run. Docker is most of the
cause:

- **Test images on the dev machine.** `make backend/up` and `make frontend/up` start the test
  stacks as well as the dev stacks. Every time an agent wants a dev server, the test images get
  built too. They only serve the acceptance and integration suites, and those run in CI.
- **A test-only image for light checks.** The acceptance-tests image is 2.8 GB because it carries
  Chromium and a JRE. Its `lint`/`format` targets still use it, even though they only need
  `node_modules`.
- **A compiler toolchain nothing uses.** The backend images install `python3 build-essential`
  (about 350 MB each) so that `bcrypt` can compile. `bcrypt` 6 ships prebuilt binaries.
- **One image per worktree.** Compose names a built image `<project>-<service>`. Every worktree
  stack under its own project name (`cablan-backend-i132`) builds its own copy of a 2 GB image.
- **Leftovers that pile up.** Anonymous `node_modules` volumes are orphaned on each re-create.
  Worktree stacks are never torn down. Staging's container logs are never rotated.

The machine already has an hourly prune timer (`docker-disk-cleanup.timer`, outside this repo).
This design is about producing less waste in the first place.

## Decisions

1. **The split.**
   - **Local:** the dev servers; backend `lint`, `format`, `lint-architecture`, `lint-swagger`,
     `generate-swagger` and unit tests; frontend `lint`, `lint-styles`, `format` and unit tests;
     acceptance-tests `lint`, `format` and typecheck; root `lint-api-contract`,
     `sync-api-contract` and `fix-violations`.
   - **CI only:** `run-integration-tests`, `lint-accessibility`, `run-acceptance-tests`,
     `run-guardrails`, and anything that builds or starts a test stack or the acceptance suite
     container.
2. **The guard applies to this machine only.**
   - When the environment variable `CABLAN_HEAVY_CHECKS_IN_CI` is non-empty, every CI-only target
     exits 1 with a message pointing at the wip-branch CI run.
   - It is set in this machine's gitignored `.claude/settings.local.json`. GitHub's runners and
     other developers never set it, so their behaviour is unchanged.
   - An empty value (`CABLAN_HEAVY_CHECKS_IN_CI= make …`) overrides it.
   - The guard lives in each subproject's Makefile, so direct `make -C <project>` calls are caught
     as well. The root adds a guard only to `run-guardrails`, so that a refusal comes before any
     light check runs rather than after.
3. **`up` and `down` follow the guard.**
   - With the guard set, backend and frontend `up` start only the dev stack.
   - acceptance-tests `up` prints that the suite container is CI-only and exits 0, so that the
     root `make up` still brings up the dev environment.
   - acceptance-tests `build` builds only the light stage.
   - `down`/`reset` still stop both stacks.
4. **Light stages.** The acceptance-tests Dockerfile is split into a `deps` stage (Node, patches,
   `npm ci`, source) and a `suite` stage (plus the JRE and Chromium). `lint`, `fix-lint`,
   `format`, `fix-format` and a new `typecheck` target use `deps`. `up`, `run` and the
   living-documentation targets use `suite`.
5. **No compiler toolchain in the backend.** `python3 build-essential` comes out of `Dockerfile`
   and `Dockerfile.prod`, provided `bcrypt` loads and hashes without it.
6. **One image name per project.**
   - The dev services get a fixed `image:` name (`cablan-backend-dev`, `cablan-frontend-dev`,
     `cablan-acceptance-tests-deps`/`-suite`), so every Compose project name reuses one image.
   - The trade-off: a worktree that changes dependencies rebuilds the shared tag. The next build
     from `main` restores it.
7. **Worktree stack convention.** A worktree that needs a stack of its own names it
   `<default name>-i<issue>` (for example `COMPOSE_PROJECT_NAME=cablan-backend-i132`). It tears the
   stack down with `docker compose -p <name> down -v` once it is finished. The board automation's
   teardown, a separate project, matches the same names.
8. **Fresh anonymous volumes.**
   - Backend and frontend `up` pass `--renew-anon-volumes`, so `node_modules` always comes from the
     current image.
   - The old volume becomes an orphan that the prune timer removes.
   - The frontend's `/app/.angular` cache is renewed as well. The cost is a slower first page load
     after an `up`.
9. **Staging log rotation.** Every service in `deploy/staging/compose.yml` uses `json-file` with
   `max-size: 10m`, `max-file: 3`. It takes effect on the next deploy, and Docker is not restarted.

## Out of scope

- Moving staging off this machine, or growing the disk.
- Slimming the production backend's runtime dependencies.
- The board automation's teardown, which has its own project.

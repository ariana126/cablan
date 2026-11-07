# GitLab Flow with a Staging Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move CI/CD off `main` onto environment branches — `staging` runs CI, builds the images once and deploys them to a persistent staging stack on the team server behind Authelia; `production` ships those same images to Hamravesh, gated on a successful staging deploy.

**Architecture:** Four GitHub workflows change triggers or are added (`ci.yml`, `publish-living-documentation.yml`, new `deploy-staging.yml`, `deploy.yml`). A new root-level `deploy/staging/` directory holds the staging Compose stack and its Makefile, reached through a `staging/%` passthrough in the root Makefile. The server side (runner label, env file, nginx block, firewall) is a one-time manual setup outside the repo.

**Tech Stack:** GitHub Actions, Docker Compose, GNU Make, nginx + Authelia (`auth_request`), Hamravesh registry + `darkube` CLI, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-07-gitlab-flow-staging-design.md`

## Global Constraints

- All files touched are cross-cutting (root, `.github/`, `deploy/`, `docs/`) — the orchestrator edits them directly; no subproject agent is needed.
- No backend/frontend/acceptance-tests file changes, so `make run-guardrails` is **not** run; validation is `actionlint` + `docker compose config` + the live rollout (memory: guardrails-skip-ci-only).
- `actionlint` runs as `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color`.
- Promotion is a non-force push of the **remote** tip: `git fetch origin && git push origin origin/main:refs/heads/staging` (and `origin/staging:refs/heads/production`).
- Image refs: `${HAMRAVESH_REGISTRY}/${DARKUBE_BACKEND_APP_NAME}:<short-sha>` and `${HAMRAVESH_REGISTRY}/${DARKUBE_FRONTEND_APP_NAME}:<short-sha>`; short SHA = first 7 chars.
- Staging ports: nginx `18091` (public, Authelia), frontend container `127.0.0.1:18092`.
- Staging env file on the server: `/home/github-runner/cablan-staging.env` (mode 600, owner `github-runner`); never in the repo.
- Compose project name `cablan-staging`; DB volume `cablan-staging-db`; `down` never uses `-v`.
- Runner labels: new jobs use `[self-hosted, staging]`; `hamravesh` stays reserved for `deploy.yml`'s fallbacks.
- Third-party actions already in each workflow keep their existing pins; the darkube CLI stays pinned by its current digest (`# v1.1`).
- Commits follow the repo's `type(scope): subject` style and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Confirm commit messages with the user before committing on `main`.

## Review Focus

1. **A `production` push of a commit staging never deployed** (docs-only promotion, or a hand-pushed commit) — expected: `verify-staging` fails, nothing rolls out. Pinned in Task 6, Step 6.
2. **`deploy-staging.yml` triggered by a *failed* CI run on staging** — `workflow_run` fires on every completion; expected: no build, no deploy. Pinned by the `if:` check in Task 3, Step 3 and asserted in Task 3, Step 4.
3. **Promoting from a stale local checkout** — expected: the remote tip is promoted, never the local branch. Pinned in Task 1, Step 5 (`make -n` shows `origin/main`).
4. **A staging deploy that leaves the old stack running on failure** — `up --wait` failing must fail the job (red), not report green. Pinned in Task 1, Step 4 (exit-status check) and seen live in Task 6.
5. **Staging data loss through an operational target** — `make staging/down` must keep the volume. Pinned in Task 1, Step 4.

---

### Task 1: The staging stack and the root Make targets

**Files:**
- Create: `deploy/staging/compose.yml`
- Create: `deploy/staging/.env.example`
- Create: `deploy/staging/Makefile`
- Modify: `Makefile` (passthrough block near line 143; new promotion targets beside `help`'s other `##` targets)

**Interfaces:**
- Produces: `make staging/deploy IMAGE_TAG=<short-sha>` (env file overridable via `STAGING_ENV_FILE=`), `make staging/ps`, `make staging/logs`, `make staging/down`, `make promote-staging`, `make promote-production`. Task 3 calls `make staging/deploy`.

- [ ] **Step 1: Write `deploy/staging/.env.example`**

  Keys, with placeholders and a one-line comment each: `REGISTRY`, `BACKEND_APP_NAME`, `FRONTEND_APP_NAME`, `STAGING_PORT=18092`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_ADMIN_NAME`. Header comment: the real file lives at `/home/github-runner/cablan-staging.env`, not in the repo; `IMAGE_TAG` is passed by the deploy.

- [ ] **Step 2: Write `deploy/staging/compose.yml`**

  `name: cablan-staging`. Services, all `restart: unless-stopped`:
  - `db`: `postgres:16-alpine`; `POSTGRES_USER=cablan`, `POSTGRES_DB=cablan`, `POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?}`; volume `cablan-staging-db:/var/lib/postgresql/data`; healthcheck `pg_isready -U cablan -d cablan`. No `ports`.
  - `backend`: `image: ${REGISTRY:?}/${BACKEND_APP_NAME:?}:${IMAGE_TAG:?}`; `DATABASE_URL=postgresql://cablan:${POSTGRES_PASSWORD}@db:5432/cablan`, `JWT_SECRET`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_ADMIN_NAME` (all `:?`-required); `depends_on: db: condition: service_healthy`; healthcheck copied from `backend/docker-compose.yml:17-29` (the `node -e fetch(.../api/health)` form, port 3000, `start_period: 60s` since it migrates on boot). No `ports`.
  - `frontend`: `image: ${REGISTRY}/${FRONTEND_APP_NAME}:${IMAGE_TAG}`; `API_PROXY_TARGET=http://backend:3000`; `ports: ["127.0.0.1:${STAGING_PORT:-18092}:80"]`; `depends_on: backend: condition: service_healthy`; healthcheck `wget -qO- http://localhost/ >/dev/null`.
  - `volumes: cablan-staging-db: { name: cablan-staging-db }`.

- [ ] **Step 3: Write `deploy/staging/Makefile`**

  `STAGING_ENV_FILE ?= /home/github-runner/cablan-staging.env`; `COMPOSE = docker compose -f compose.yml --env-file $(STAGING_ENV_FILE)`. Targets, each with a `## ` comment:
  - `deploy`: fail with a clear message if `IMAGE_TAG` is empty; `IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE) pull`; `IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE) up -d --wait --remove-orphans`; then remove this stack's images whose tag ≠ `$(IMAGE_TAG)` (`docker image ls "$$REGISTRY/$$APP" --format '{{.Repository}}:{{.Tag}}'` for each of the two repos, read from the env file, `grep -v ":$(IMAGE_TAG)$$"`, `xargs -r docker image rm`); finally `docker image prune -f`. Cleanup failures must not mask a failed `up` — `up` runs first and its non-zero exit stops make.
  - `ps`, `logs` (`logs -f --tail=200`), `down` (`$(COMPOSE) down` — **no** `-v`; comment saying why).
  - A comment at the top: this directory is not a project in the root `PROJECTS`; `make up`/guardrails never touch it.
  - **No** `%:` / `@:` catch-all (unlike the subproject Makefiles), so a typo'd `make staging/dploy` errors instead of silently succeeding.

- [ ] **Step 4: Verify the stack renders and the targets behave**

  ```bash
  cd deploy/staging
  IMAGE_TAG=abc1234 docker compose -f compose.yml --env-file .env.example config >/dev/null && echo OK
  make deploy STAGING_ENV_FILE=.env.example 2>&1 | grep -i 'IMAGE_TAG'     # expected: the "IMAGE_TAG is required" message, non-zero exit
  make -n down STAGING_ENV_FILE=.env.example | grep -c -- ' -v'           # expected: 0
  make -n deploy IMAGE_TAG=abc1234 STAGING_ENV_FILE=.env.example | grep -n 'up -d --wait'   # expected: one line, before any 'image rm'
  ```
  Expected: `OK`; the error message; `0`; the `up` line precedes the cleanup lines.

- [ ] **Step 5: Add root targets**

  In `Makefile`:
  - After the `acceptance-tests/%` rule: `staging/%: FORCE` → `@$(MAKE) -C deploy/staging $*`, and extend the passthrough comment to mention it.
  - New targets with `## ` comments, plus a comment that they are the root Makefile's only targets with logic of their own:
    - `promote-staging: ## Fast-forward origin/staging to origin/main (triggers CI → staging deploy)` → `git fetch origin && git push origin origin/main:refs/heads/staging`
    - `promote-production: ## Fast-forward origin/production to origin/staging (triggers the Hamravesh deploy)` → `git fetch origin && git push origin origin/staging:refs/heads/production`
  - Add both to `.PHONY`.

  Verify:
  ```bash
  make help | grep -E 'promote-(staging|production)'      # expected: 2 lines
  make -n promote-staging                                   # expected: shows origin/main:refs/heads/staging, no --force/-f
  make -n staging/ps                                        # expected: make -C deploy/staging ps
  ```

- [ ] **Step 6: Commit** (message confirmed with the user)

  ```bash
  git add deploy/staging Makefile
  git commit -m "build(staging): staging compose stack and promotion targets"
  ```

---

### Task 2: CI and living documentation move from `main` to `staging`

**Files:**
- Modify: `.github/workflows/ci.yml:9-10` (the `push.branches`)
- Modify: `.github/workflows/publish-living-documentation.yml:3-6,13` (trigger + comments)

- [ ] **Step 1: Edit triggers**

  `ci.yml`: `push.branches: [ staging ]`; add a comment above `on:` — "Nothing runs on main: PRs and wip dispatches check work before it lands; a push to staging (a promotion) is the full gate, and its success triggers deploy-staging.yml." `publish-living-documentation.yml`: `push.branches: [ staging ]`; rewrite the two comments that say "main" to say staging / "a newer promotion supersedes an in-flight one".

- [ ] **Step 2: Lint**

  Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color .github/workflows/ci.yml .github/workflows/publish-living-documentation.yml`
  Expected: no output, exit 0.

- [ ] **Step 3: Check no workflow still triggers on `main`**

  Run: `grep -n "branches: *\[ *main" .github/workflows/*.yml`
  Expected: no matches for `ci.yml` / `publish-living-documentation.yml` (`deploy.yml` changes in Task 4).

- [ ] **Step 4: Commit** — `ci: run CI and publish living documentation from staging, not main`

---

### Task 3: `deploy-staging.yml`

**Files:**
- Create: `.github/workflows/deploy-staging.yml`

**Interfaces:**
- Consumes: `make staging/deploy IMAGE_TAG=…` (Task 1); `make backend/build-prod` → local image `cablan-backend:prod`; `make frontend/build-prod` → `cablan-frontend-prod:latest` (existing).
- Produces: workflow file name `deploy-staging.yml`, whose successful run for a SHA is what Task 4's gate queries; registry tags `<registry>/<app>:<short-sha>` for both apps.

- [ ] **Step 1: Header and triggers**

  `name: Deploy staging`. `on: workflow_run: { workflows: ['CI'], types: [completed], branches: [staging] }` and `workflow_dispatch:`. `concurrency: { group: deploy-staging, cancel-in-progress: false }`. `permissions: contents: read`. Top comment: what this does, that it is the only place images are built, that production reuses these tags, and that `workflow_run` reads this file from `main`.

- [ ] **Step 2: `build-backend` / `build-frontend`**

  Move both jobs verbatim from current `deploy.yml` (checkout `@fbc6f39… # v5.1.0` at the SHA, `make */build-prod`, login, tag, push), including their comments. Their `SHA` expression stays `github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha`.

- [ ] **Step 3: Gate conditions**

  Each build job: `if: (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/staging') || github.event.workflow_run.conclusion == 'success'`. (A dispatch on another ref does nothing — staging only ever runs staging's code.)

- [ ] **Step 4: `deploy` job**

  `needs: [build-backend, build-frontend]`, `runs-on: [self-hosted, staging]`. Steps: checkout (same pin) at the SHA; `docker login "$REGISTRY" -u … -p …` with the same three registry vars/secret; `make staging/deploy IMAGE_TAG="${SHA:0:7}"`; a final `if: always()` step `docker logout "$REGISTRY"`. Comment: the stack's env file lives on the server, see root CLAUDE.md.

  Verify the gate shape:
  ```bash
  grep -c "workflow_run.conclusion == 'success'" .github/workflows/deploy-staging.yml   # expected: 2
  grep -n "self-hosted" .github/workflows/deploy-staging.yml                            # expected: only [self-hosted, staging]
  ```

- [ ] **Step 5: Lint**

  Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color .github/workflows/deploy-staging.yml`
  Expected: exit 0. (actionlint may warn that `staging` is an unknown runner label — add `.github/actionlint.yaml` with `self-hosted-runner: { labels: [hamravesh, staging] }` to declare both.)

- [ ] **Step 6: Commit** — `ci(staging): build images once and deploy them to the staging server`

---

### Task 4: `deploy.yml` — production from `production`, gated, no rebuild

**Files:**
- Modify: `.github/workflows/deploy.yml` (whole file)

**Interfaces:**
- Consumes: `deploy-staging.yml` runs and the `<short-sha>` tags it pushed (Task 3).

- [ ] **Step 1: Triggers and settings**

  `on: push: branches: [production]` + `workflow_dispatch:`. `concurrency: { group: deploy-production, cancel-in-progress: false }`. `permissions: { contents: read, actions: read }`. Rewrite the header comment: ships the image staging already ran; never builds.

- [ ] **Step 2: Remove `build-backend` / `build-frontend`** (now in `deploy-staging.yml`).

- [ ] **Step 3: Add `verify-staging`**

  `runs-on: ubuntu-latest`; `outputs: tag: ${{ steps.check.outputs.tag }}`. One step `id: check` with `GH_TOKEN: ${{ github.token }}`:
  - Fail with `::error::` unless `"$GITHUB_REF" == refs/heads/production`.
  - `count=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/deploy-staging.yml/runs?head_sha=$GITHUB_SHA&status=success" --jq '.total_count')`; fail with `::error::$GITHUB_SHA was never deployed to staging — promote it through staging first` when `count` is `0`.
  - `echo "tag=${GITHUB_SHA:0:7}" >> "$GITHUB_OUTPUT"`.

- [ ] **Step 4: Rewire the rollout jobs**

  `deploy-backend` / `deploy-frontend`: `needs: verify-staging`; `SHORT_SHA` from `needs.verify-staging.outputs.tag`; `darkube deploy --ref production …`. Fallbacks: `needs: [verify-staging, deploy-backend]` (resp. frontend), `if: always() && needs.verify-staging.result == 'success' && needs.deploy-backend.result == 'failure'`, same tag source, `--ref production`. Drop every `workflow_run.head_sha` expression from this file.

- [ ] **Step 5: Lint and shape checks**

  ```bash
  docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color .github/workflows/deploy.yml   # expected: exit 0
  grep -nE "build-prod|docker push|workflow_run|--ref main" .github/workflows/deploy.yml                 # expected: no matches
  grep -c "needs.verify-staging.outputs.tag" .github/workflows/deploy.yml                                # expected: 4
  ```

- [ ] **Step 6: Commit** — `ci(deploy): deploy production from the production branch, gated on staging`

---

### Task 5: Documentation and ADR

**Files:**
- Modify: `CLAUDE.md` ("Continuous integration" trigger paragraph and `paths-ignore` notes, the living-documentation paragraphs, the whole "Continuous deployment" section, the `make ps` note, the root-commands block)
- Modify: `README.md` (CI/deploy description)
- Modify: `CLAUDE.local.md` (one line in "The flow", step 4)
- Create: `docs/adrs/0010-promote-through-environment-branches.md`
- Modify: `docs/adrs/README.md` (index row)

- [ ] **Step 1: ADR 0010** — template from `docs/adrs/README.md`; Status Accepted, Date 2026-11-07; Context / Decision / Consequences / Compliance as listed in spec §4. Compliance: the `verify-staging` job is the fitness function for "production only ships staged commits". Add the index row.

- [ ] **Step 2: Root `CLAUDE.md`** — new "Branches and environments" section replacing "Continuous deployment", covering spec §1–§3: the flow diagram, `make promote-*`, what runs on which branch, `deploy-staging.yml`'s jobs, the staging stack (`make staging/*`, ports, env-file path, persistent volume, runner label `staging` vs `hamravesh`), the server-side setup list, the production gate and how to read its failure, the "workflow_run reads workflows from main" and "docs-only promotions don't deploy" caveats. Keep the Hamravesh secrets table and fallback paragraph, updated (`--ref production`, builds now in `deploy-staging.yml`). In "Continuous integration": triggers are PR, push to `staging`, dispatch. Living documentation: publishes on push to `staging`. `make ps`: mention `cablan-staging`. Commands block: add `promote-staging`, `promote-production`, `staging/deploy`.

- [ ] **Step 3: `README.md`** — same flow at README depth (diagram + the two promote commands + staging URL port).

- [ ] **Step 4: `CLAUDE.local.md`** — under step 4 add: "Landing on `main` deploys nothing; `make promote-staging` is what ships it to staging."

- [ ] **Step 5: Consistency check**

  ```bash
  grep -nE "push(es)? to \`?main|on \`main\`|deploy-main|--ref main" CLAUDE.md README.md CLAUDE.local.md
  ```
  Expected: no stale claim that anything runs or deploys on `main` (the wip squash-onto-main text is fine).

- [ ] **Step 6: Commit** — `docs: GitLab Flow environment branches and ADR 0010` (plus the spec and this plan, if not committed earlier).

---

### Task 6: Server setup and rollout (live; needs the user)

On `cablan-server`; nothing here is committed to the repo. The orchestrator runs these itself — `gh` is logged in as `ariana126` (scopes `repo`, `workflow`) and `ariana` has passwordless `sudo` — but confirms with the user before each outward-facing step (label, firewall, pushes).

- [ ] **Step 1: Runner label** — `gh api -X POST repos/ariana126/cablan/actions/runners/21/labels -f 'labels[]=staging'` (runner 21 = `cablan-server-hamravesh`). Verify: `gh api repos/ariana126/cablan/actions/runners --jq '.runners[].labels[].name'` lists `staging` beside `hamravesh`.

- [ ] **Step 2: Env file** — create `/home/github-runner/cablan-staging.env` from `deploy/staging/.env.example` with real values: `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD` and `JWT_SECRET` are the values the user supplied in the planning conversation (2026-11-07) — **never written into the repo, this plan, or a commit**; `POSTGRES_PASSWORD` fresh via `openssl rand -hex 32`; registry/app names from the repo variables (`gh variable list`). Write it with `sudo install -m 600 -o github-runner -g github-runner` from a scratchpad file, then delete the scratchpad copy. Verify: `sudo stat -c '%a %U' /home/github-runner/cablan-staging.env` → `600 github-runner`.

- [ ] **Step 3: nginx** — `/etc/nginx/conf.d/cablan-staging.conf`: copy `cablan-living-doc.conf`, change `listen` to `18091`, replace `root/index/try_files` with `proxy_pass http://127.0.0.1:18092;` + `proxy_set_header Host $http_host; X-Forwarded-Proto https; X-Forwarded-For $remote_addr;`, `client_max_body_size 20m` (BOM imports). `sudo nginx -t && sudo systemctl reload nginx`. Open the port with `sudo ufw allow 18091/tcp` (ufw is what opened `18090`); verify with `sudo ufw status | grep 18091`. Write `~/auth-gateway/staging-setup.md` (log + revert steps), mirroring `living-doc-setup.md`.

- [ ] **Step 4: Land on `main`** — push the commits from Tasks 1–5 (after user confirmation). Expected: no workflow run is triggered (`gh run list --limit 3` shows nothing new for this push).

- [ ] **Step 5: First promotion to staging** — `make promote-staging`. Watch: CI (10 jobs) green → `Deploy staging` runs → `make staging/ps` shows three healthy containers. Check: `curl -sf http://127.0.0.1:18092/api/health`; open `https://<host>:18091` → Authelia login → Cablan login page; log in with the staging admin. The living-documentation publish ran for the same push.

- [ ] **Step 6: Gate negative check** — `gh workflow run deploy.yml --ref staging`. Expected: `verify-staging` fails with the "not production" error; no rollout jobs run.

- [ ] **Step 7: First promotion to production** — `make promote-production`. Expected: `verify-staging` passes, Darkube rolls out the same `<short-sha>` the staging stack runs (compare `docker inspect` on staging with the deploy log's `--image-tag`).

- [ ] **Step 8: Persistence check** — create a record on staging, run `make staging/deploy IMAGE_TAG=<same sha>` by hand (as `github-runner` or with `STAGING_ENV_FILE`), confirm the record survives.

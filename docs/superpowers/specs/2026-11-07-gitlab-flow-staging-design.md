# GitLab Flow with a staging environment — design

Date: 2026-11-07

## Intent

Move the repo from "everything happens on `main`" to a GitLab-Flow-style environment-branch model:

- Feature work still lands on `main`, as today. **Nothing runs on a push to `main`.**
- `main` is promoted to a **`staging`** branch. There the full guardrails (CI's ten checks) run, and
  when they pass a **production-like staging environment is deployed on the team server**, behind
  the same Authelia login as the server's other panels.
- `staging` is promoted by hand to a **`production`** branch, and the existing Hamravesh deploy runs
  from there.

In short: the flow that today hangs off `main` moves to `staging`, except that its deploy targets
staging rather than production, and production gets its own branch.

### Decisions taken during brainstorming

| Question | Decision |
|---|---|
| Staging database | **Persistent** across deploys, like production. A new image migrates it on boot, so a migration that would break production breaks staging first. |
| CI before `main` | Keep the `pull_request` trigger and `workflow_dispatch` (the wip-branch flow in `CLAUDE.local.md`). Only the push-to-`main` trigger goes. |
| Production trigger | Push to `production`, **gated**: the deploy refuses unless that exact commit was deployed to staging successfully. |
| Build strategy | **Build once, promote the image.** The image deployed to staging is the image shipped to production; production never rebuilds. |
| Where images are built | On **GitHub-hosted runners** (as today), pushed to the Hamravesh registry. The team server only pulls and runs. |
| CI's own GitHub-minutes cost | **Out of scope** — a separate task. |

### Non-goals

- Reducing CI's runner-minutes (separate task).
- Rollback tooling. Rolling production back is re-dispatching `deploy.yml` on an older `production`
  commit, or fast-forwarding a revert through the flow; no dedicated mechanism is added.
- Provisioning the server from the repo. As with the living documentation today, the server side
  (runner label, env file, nginx, firewall) is a documented one-time manual step.
- Seeding staging with production data.

## 1. Branches and promotion

```
feature/wip ──PR/merge──▶ main ──ff──▶ staging ──ff──▶ production
                          (nothing)    (CI → build    (gate → Hamravesh)
                                        → staging
                                        → living doc)
```

- `staging` and `production` are long-lived branches created from the current `main`.
- **Promotion is always a fast-forward push**, never a merge commit or a force-push, so every commit
  on `production` is one `staging` already had, and every commit on `staging` is one `main` had.
- Two root Make targets do it, so nobody has to remember the refspec:
  - `make promote-staging` → `git push origin main:staging`
  - `make promote-production` → `git push origin staging:production`

  A plain (non-force) push refuses anything that is not a fast-forward, which is the guard. Both
  push the **remote** branches' tips (`origin/main`, `origin/staging`) after a `git fetch`, not
  whatever happens to be checked out locally, so a stale local branch can't be promoted by mistake.
- These are the only two root targets with logic of their own (a fetch and a push); the root
  Makefile otherwise only delegates. That exception is noted beside them.

## 2. Workflows

### `ci.yml` — unchanged jobs, new triggers

```yaml
on:
  pull_request:  { paths-ignore: [...] }   # unchanged
  push:
    branches: [ staging ]                  # was: main
    paths-ignore: [...]                    # unchanged
  workflow_dispatch:                       # unchanged — the wip-branch flow
```

The ten jobs, the concurrency group and the artifact uploads are untouched.

**Consequence of `paths-ignore` on `staging`:** a promotion whose net diff is docs-only (`*.md`,
`.claude/**`) triggers no CI, therefore no staging deploy. That is correct — nothing deployable
changed — but it also means such a commit never gets a successful staging deploy, so the
production gate (§2, `deploy.yml`) would refuse it. Promoting a docs-only commit to `production` is
pointless anyway (production would ship the same images); if it is ever needed, `workflow_dispatch`
CI on `staging` produces the run the gate needs.

### `deploy-staging.yml` — new

Triggered by `workflow_run` of **CI** completing on `staging` (the pattern `deploy.yml` uses on
`main` today), plus `workflow_dispatch` on `staging` as the manual re-run. Every job runs only when
the triggering CI run's conclusion is `success`. The SHA everywhere is
`workflow_run.head_sha` (or `github.sha` on dispatch). Concurrency group `deploy-staging`,
**no** cancel-in-progress.

Jobs:

1. **`build-backend` / `build-frontend`** (`ubuntu-latest`) — moved verbatim from today's
   `deploy.yml`: checkout the SHA, `make backend/build-prod` / `make frontend/build-prod`, tag
   `<HAMRAVESH_REGISTRY>/<DARKUBE_*_APP_NAME>:<short-sha>`, push.
2. **`deploy`** (`runs-on: [self-hosted, staging]`, needs both builds) — checkout the SHA (for the
   compose file and Makefile), `docker login` to the Hamravesh registry, then
   `make staging/deploy IMAGE_TAG=<short-sha>` (see §3).

The images are environment-agnostic already — the backend reads `DATABASE_URL`, `JWT_SECRET`,
`DEFAULT_ADMIN_*` at runtime and the frontend's nginx reads `API_PROXY_TARGET` at container start —
so the same tag runs on staging and on Darkube.

The self-hosted runner's `hamravesh` label stays reserved for `deploy.yml`'s fallback jobs; the new
job uses a separate `staging` label on the same runner, so each label keeps one meaning.

### `publish-living-documentation.yml` — trigger moves

`push: branches: [ main ]` becomes `push: branches: [ staging ]`. Everything else is unchanged. The
published documentation therefore describes what is on staging.

### `deploy.yml` — production, from `production`, no rebuild

```yaml
on:
  push:
    branches: [ production ]
  workflow_dispatch:
```

- Concurrency group renamed `deploy-production`, still **no** cancel-in-progress.
- `permissions: { contents: read, actions: read }` (the gate reads workflow runs).
- **Jobs:**
  1. **`verify-staging`** (`ubuntu-latest`) — refuses (fails) unless:
     - the dispatched ref is `production` (a dispatch on any other ref fails here), and
     - the commit carries a **`deploy/staging` success commit status**, which `deploy-staging.yml`'s
       deploy job sets on the exact SHA as its last step. A successful staging deploy implies CI
       passed on that commit *and* both images were pushed with that tag, so this one check covers
       both. (Amended during implementation: the first draft queried deploy-staging runs by
       `head_sha`, but a `workflow_run`-triggered run is recorded against the default branch, so
       its `head_sha` need not be the staged commit.)
     It outputs the short SHA for the jobs below.
  2. **`deploy-backend` / `deploy-frontend`** — as today, minus their build dependency:
     `needs: verify-staging`, `darkube deploy --ref production --image-tag <short-sha> …`.
  3. **`deploy-backend-fallback` / `deploy-frontend-fallback`** — as today, on
     `[self-hosted, hamravesh]`, conditioned on `verify-staging` succeeding and the hosted rollout
     failing.
- The `build-*` jobs are **removed** from this workflow (they now live in `deploy-staging.yml`).

## 3. The staging stack

### In the repo: `deploy/staging/`

A new root-level directory (cross-cutting, like `.github/`; owned by the orchestrator, not a
subproject agent):

- **`compose.yml`** — Compose project `name: cablan-staging` (prefixed, so `make ps` shows it):
  - `db` — `postgres:16-alpine`, named volume `cablan-staging-db`, healthcheck `pg_isready`. Not
    published.
  - `backend` — `${REGISTRY}/${BACKEND_APP_NAME}:${IMAGE_TAG}`, `DATABASE_URL` pointing at `db`,
    `JWT_SECRET` and `DEFAULT_ADMIN_*` from the env file, `depends_on: db: service_healthy`,
    healthcheck on `GET /api/health`. Not published.
  - `frontend` — `${REGISTRY}/${FRONTEND_APP_NAME}:${IMAGE_TAG}`,
    `API_PROXY_TARGET=http://backend:3000`, published **only on `127.0.0.1:${STAGING_PORT}`**
    (default `18092`) — nginx on the host is the only way in.
  - `restart: unless-stopped` on all three, so staging survives a server reboot.
- **`.env.example`** — every key the stack needs, with placeholder values: `REGISTRY`,
  `BACKEND_APP_NAME`, `FRONTEND_APP_NAME`, `STAGING_PORT`, `POSTGRES_PASSWORD`, `JWT_SECRET`,
  `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_ADMIN_NAME`. `IMAGE_TAG` is not in
  it — the deploy passes it.
- **`Makefile`** — reached from the root as `make staging/<target>`:
  - `deploy` (requires `IMAGE_TAG`) — `docker compose --env-file $(STAGING_ENV_FILE) pull`, then
    `up -d --wait`, then `docker image prune -f` for dangling images, and removes this stack's
    older image tags so the server's disk doesn't creep up with every promotion.
  - `ps`, `logs`, `down` — operational conveniences. `down` never takes `-v`: the volume is the
    persistent staging data.
  - `STAGING_ENV_FILE` defaults to `/home/github-runner/cablan-staging.env` — **outside the repo**,
    so secrets are never committed and a fresh checkout per deploy doesn't lose them.

The root Makefile gains a `staging/%` passthrough rule (`$(MAKE) -C deploy/staging $*`, beside
the existing `backend/%`, `frontend/%`, `acceptance-tests/%` rules), but staging is **not** added to
`PROJECTS`: `make up`, `make run-guardrails` and the rest never touch it.

### On the server (one-time, manual, documented)

Done by hand like the living documentation's server side; written up in the root `CLAUDE.md` and
in `~/auth-gateway/` next to `living-doc-setup.md`:

1. **Runner label** — add `staging` to the existing runner
   (`actions.runner.ariana126-cablan.cablan-server-hamravesh`), via the repo's runner settings.
2. **Env file** — `/home/github-runner/cablan-staging.env`, `chmod 600`, owned by `github-runner`,
   with real values for the keys in `deploy/staging/.env.example`.
3. **nginx** — `/etc/nginx/conf.d/cablan-staging.conf`: a `listen 18091 ssl` server modelled on
   `cablan-living-doc.conf` — same certificate, same `/_authelia` `auth_request` block, same 401 →
   `:19091` redirect — but `proxy_pass http://127.0.0.1:18092` with the usual
   `Host`/`X-Forwarded-*` headers. Kept in its own file so re-running the auth-gateway setup
   doesn't erase it.
4. **Firewall** — open `18091/tcp`. `18092` stays closed (it's bound to loopback anyway, and
   `auth-gateway-docker-lock` already blocks external access to Docker-published ports).
5. **Authelia access control** — confirm the existing rule covers the new port's URL (same host,
   so it should).

Staging's app login (the Cablan admin) sits **behind** Authelia — a visitor passes Authelia first,
then signs in to the app.

## 4. Documentation

- **Root `CLAUDE.md`** — replace the "Continuous integration" trigger paragraph and the whole
  "Continuous deployment" section with a "Branches and environments" section describing §1–§3:
  the promotion targets, what runs on which branch, the staging stack and its server side, the
  production gate. Update the living-documentation paragraphs (now from `staging`) and the
  `make ps` note (a `cablan-staging` project now exists).
- **`README.md`** — the same flow, at README depth.
- **`CLAUDE.local.md`** — the wip flow is unchanged (it ends with a squash onto `main`); add one
  line that landing on `main` no longer deploys anything — promotion does.
- **ADR 0010** — "Promote through environment branches (GitLab Flow)": context (deploy-on-main,
  rebuild per deploy), decision (env branches, fast-forward promotion, build once and promote the
  image, gated production), consequences (docs-only promotions don't deploy; a `production` commit
  must have been staged; staging data persists and must be cared for). Add it to
  `docs/adrs/README.md`.

## 5. Rollout order

1. Land the repo changes on `main` (nothing runs on `main` any more, so this is inert).
2. Do the server's one-time setup (§3).
3. Create `staging` from `main` (`make promote-staging`) → CI → staging build + deploy. Verify the
   app on `https://<host>:18091` behind Authelia, and the living documentation updated.
4. Create `production` from `staging` (`make promote-production`) → gate passes → Darkube rollout.
   This is the first production deploy under the new flow; it ships the image staging just ran.

Before step 4, production is untouched; until step 3, nothing deploys at all, so there is a
window where `main` moves without deploying — intended.

## 6. Verification

- `actionlint` over all four workflows (the memory-recorded check for CI-only changes).
- `make staging/deploy IMAGE_TAG=…` run by hand on the server against a tag pushed by the first
  staging run, then `curl` through `127.0.0.1:18092` (`/` and `/api/health`).
- The rollout itself (§5) is the end-to-end test: one promotion to `staging`, one to `production`.
- Negative check of the gate: dispatch `deploy.yml` on a `production` SHA with no staging deploy
  (or on another ref) and confirm `verify-staging` fails before anything rolls out.

## Risks

- **Disk on the server.** Pulling two images per promotion adds up; `staging/deploy` prunes, and
  the existing disk-space guidance still applies.
- **Hamravesh registry growth.** Tags accumulate per promotion. Watch the quota; a retention policy
  can come later.
- **Persistent staging data** means a bad migration leaves staging broken until fixed forward —
  which is the point (it would have broken production), but there is no automated reset.
- **`workflow_run` runs the workflow file from the default branch (`main`)**, not from `staging`.
  `deploy-staging.yml` must therefore exist on `main` for staging deploys to trigger — which holds
  as long as workflow changes flow `main → staging` like everything else.

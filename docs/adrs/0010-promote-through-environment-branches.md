# 0010. Promote through environment branches, building each image once

- **Status:** Accepted
- **Date:** 2026-11-07

## Context

Until now everything hung off `main`: a push ran CI's ten checks, published the living
documentation, and — once CI passed — `deploy.yml` rebuilt both production images and rolled them
out to Hamravesh. Three forces made that the wrong shape:

- **No place to look before production.** The first environment running the production images
  against a persistent database was production itself. A migration that breaks on existing data,
  or a misconfigured image, was found there.
- **Landing work and shipping it were one act.** Merging to `main` deployed, so `main` could not
  collect several changes to be released together, and every docs or tooling commit that slipped
  past `paths-ignore` cost a full CI run and a deploy.
- **Production shipped a rebuild.** Each deploy built from source, and the base images
  (`node:24-bookworm-slim`, `nginx:1.27-alpine`) float, so what reached Hamravesh was never
  byte-for-byte what CI had exercised.

Alternatives considered:

- **Deploy staging from `main` and promote by tag.** Keeps one long-lived branch, but "what is on
  staging" and "what is on production" become tag archaeology instead of a branch you can read.
- **Build the staging images on the team server.** Free of GitHub minutes and warm-cached, but the
  server has already run out of disk during guardrails, and a fresh hosted runner is the cleaner
  build. Rejected: GitHub-hosted builds, pushed to Hamravesh's registry.
- **Rebuild for production from the promoted commit.** Simpler workflow, but loses the guarantee
  that production runs the bytes staging ran.

## Decision

We will promote through **environment branches** — `main` → `staging` → `production` — in the
style of GitLab Flow:

- Nothing runs on a push to `main`. Work is checked before it lands by pull-request CI or a `wip/*`
  dispatch.
- **Promotion is a fast-forward push only** (`make promote-staging`, `make promote-production`),
  never a merge commit or a force-push, so every commit on `production` was on `staging` and every
  commit on `staging` was on `main`.
- On `staging`, CI's ten checks run; when they pass, `deploy-staging.yml` **builds both production
  images once**, pushes them to Hamravesh's registry tagged with the short commit SHA, and runs
  them on a production-like stack on the team server — its own persistent Postgres, behind the
  same Authelia login as the server's other panels. The living documentation publishes from
  `staging` too.
- On `production`, `deploy.yml` **never builds**: it rolls out the tags staging ran, and refuses
  any commit that does not carry a successful `deploy/staging` commit status.

## Consequences

Easier:

- Staging catches migration and configuration failures on a persistent database before
  production does.
- Production ships exactly the images staging ran, and a production deploy no longer builds —
  faster, and fewer GitHub-hosted minutes.
- What each environment runs is readable from its branch.

Harder:

- Two promotions instead of a merge. Shipping is a deliberate act, by design.
- A docs-only promotion triggers no CI (CI's `paths-ignore`), so it gets no staging deploy and the
  production gate refuses it — harmless, since production would ship the same images, and a
  manual CI dispatch on `staging` covers the rare need.
- Staging's data persists, so a bad migration leaves staging broken until fixed forward; there is
  no automated reset.
- Images and their tags accumulate in Hamravesh's registry, one pair per promotion.
- `workflow_run` reads `deploy-staging.yml` from `main`, so a change to it acts once on `main`.
- The team server now carries a staging stack, a second runner label (`staging`) and an nginx
  site, all provisioned by hand outside the repo.

## Compliance

- `deploy.yml`'s **`verify-staging`** job is the fitness function for "production only ships
  staged commits": it fails the deploy before any rollout unless the ref is `production` and the
  commit has a `deploy/staging` success status, which `deploy-staging.yml` sets only after CI
  passed, both images were pushed and the stack came up healthy.
- Fast-forward-only promotion is enforced by the promotion targets using plain, non-force pushes.
  Branch protection forbidding force-pushes on `staging` and `production` would make it hold for
  hand-typed pushes too; it is not configured yet.

## Notes

Design: `docs/superpowers/specs/2026-11-07-gitlab-flow-staging-design.md`. Plan:
`docs/superpowers/plans/2026-11-07-gitlab-flow-staging.md`. Operational detail: the root
`CLAUDE.md`, "Branches and environments".

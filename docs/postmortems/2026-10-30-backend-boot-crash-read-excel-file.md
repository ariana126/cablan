# Postmortem: production backend crashes on boot — `Cannot find module 'read-excel-file/node'`

| Field | Value |
| --- | --- |
| Date found | 2026-10-30 (production log, 00:05 +0330) |
| Severity | Production backend down — the process exits before it serves a request |
| Introduced by | `69fe51a` feat(importing-materials), 2026-10-29 14:31 +0330 |
| Shipped by | Deploy run `40866189461` (`workflow_run`, 2026-10-29 11:32Z) and re-dispatch `40908795061` (2026-10-29 16:09Z), both of `0878d2a`, both green |
| Fixed by | Moving `read-excel-file` from `devDependencies` to `dependencies` in `backend/package.json` (see [Resolution](#resolution)) |
| Status | Fixed on `main`; ships on the next green CI → deploy |

## Summary

The production backend container applied its migrations and then crashed while loading the
application module graph:

```
Error: Cannot find module 'read-excel-file/node'
Require stack:
- /app/dist/src/modules/products/infrastructure/spreadsheet/xlsx-material-import-sheet-reader.js
- /app/dist/src/modules/products/infrastructure/products.module.js
- /app/dist/src/app.module.js
- /app/dist/src/main.js
```

`read-excel-file` was a **devDependency**, but production code imported it. The production image
installs only `dependencies`, so the package was not there at runtime. Every CI check passed,
and so did both deploy runs, because nothing in the pipeline ever starts the production image.

## Timeline (+0330)

| When | What |
| --- | --- |
| 2026-10-14 | `0662ce3` (Excel exports) adds `read-excel-file` as a **devDependency**. That was correct then: only `xlsx-workbook.spec.ts` used it, to read back the workbooks the backend writes. |
| 2026-10-29 14:31 | `69fe51a` (importing-materials) adds `XlsxMaterialImportSheetReader`, production code that imports `read-excel-file/node` to parse the uploaded accounting export. The dependency stays in `devDependencies`. |
| 2026-10-29 | CI passes all ten checks on `main`. `deploy.yml` builds `Dockerfile.prod`, pushes it and runs `darkube deploy`. Green. |
| 2026-10-29 19:39 | The deploy is re-dispatched by hand. Green again, same commit. |
| 2026-10-30 00:05 | Production log shows migrations applied (`No pending migrations to apply`) and then the `MODULE_NOT_FOUND` crash. |
| 2026-10-30 | Root cause identified and fixed on `main`. |

It is not known from the repo alone exactly when production first started crash-looping, or
whether Darkube kept the previous pod serving while the new one failed. The panel's pod and event
history will show that.

## Root cause

`backend/Dockerfile.prod`'s runtime stage deliberately reinstalls with `npm ci --omit=dev`, so
that jest, eslint, the Nest CLI and similar tools stay out of the image. So anything compiled into
`dist/` must be in `dependencies`. Being installed is not enough.

`69fe51a` turned a test-only dependency into a runtime one without moving it. Nothing flags that:

- **TypeScript and the build** resolve against the `deps`/`build` stages' full `node_modules`,
  devDependencies included. `npm run build` succeeds.
- **Every CI check** (unit, integration, acceptance, accessibility, swagger) runs in the dev or
  test image, which has devDependencies installed. The app boots fine there.
- **`lint-swagger`** boots the app too, but in the dev image as well.
- **`deploy.yml`** builds the prod image (`make backend/build-prod`), but building never executes
  `main.js`. Then `darkube deploy` only tells Darkube to roll out the new tag and returns. It does
  not wait for the rollout to become healthy, so a pod that never starts still gives a green deploy.

The one environment that runs with production-only dependencies is production itself.

## Impact

The production backend could not start, so the API was down (and the frontend with it, for
anything beyond static assets). No data was affected. The process exits after `prisma migrate
deploy`, and that release's migration, `20261029120000_material_import`, had already been applied
by then. The log says `No pending migrations to apply`.

## Resolution

`read-excel-file@^9.3.12` was moved to `dependencies` with npm, so `package-lock.json` no longer
marks it or its transitive packages (`saxen`, `unzipper-esm`, `worker-f`, `node-int64`)
`"dev": true`. Same version, no code change.

Verified:

- **No other offenders.** Every bare-specifier import in non-test `backend/src/**/*.ts` resolves to
  a `dependencies` entry, a `tsconfig` path alias, or (`express` in
  `actor-context.middleware.ts`) a type-only import that compilation erases.
- **The prod image boots.** `cablan-backend:prod` rebuilt from the fixed lockfile resolves
  `read-excel-file/node`, and `node dist/src/main` logs `Nest application successfully started`.
  It gets past module loading and stops only on configuration that the test run left unset.
- Backend lint, Prettier and unit tests (142 suites, 929 tests) pass, and so does the full CI run
  on the fix.

## What went well

- The log named the missing module and the full require stack, so diagnosis took minutes.
- The entrypoint runs migrations before the app starts. They succeeded, so the crash left the
  schema in a consistent state, and the old image could have been rolled back to if needed.

## What went wrong

- The design decided it without checking. The importing-materials spec
  (`docs/superpowers/specs/2026-10-29-importing-materials-design.md`, line 45) says the parser
  "reads the first sheet with `read-excel-file` (**already a backend dependency**)". It was only a
  devDependency. The plan (`docs/superpowers/plans/2026-10-29-importing-materials.md`, line 79)
  carried that forward. Nobody asked whether the package was a runtime dependency, so nobody
  moved it.
- A dependency's classification was decided once, by the code that first used it, and never
  revisited when production code started using it.
- "CI green" was read as "deployable", but no CI check covers the production image's dependency set.
- "Deploy green" was read as "deployed", but `darkube deploy` does not report rollout health.

## Related documents

- **Causing task:** the importing-materials feature (issue #74). Its design, plan and approved
  Gherkin are in `f889750`, its implementation is `69fe51a`, and its CLAUDE.md updates are `0878d2a`.
  - Design: `docs/superpowers/specs/2026-10-29-importing-materials-design.md`
  - Plan: `docs/superpowers/plans/2026-10-29-importing-materials.md`
  - **Retro: none.** No `docs/retros/` entry exists for importing-materials, so there is no record of how its guardrails went or whether anyone
    tried the prod image.
- **Where the dependency came from:** `0662ce3` (Excel exports, 2026-10-14) added it as a
  devDependency. `docs/retros/2026-09-01-exporting-bom.md` mentions `read-excel-file` only for
  a stale `node_modules` volume in **acceptance-tests**, which is unrelated to the backend's
  dependency classification.

## Action items

| # | Action | Type |
| --- | --- | --- |
| 1 | Move `read-excel-file` to `dependencies` (done, this fix). | Fix |
| 2 | Add a gate that **boots the production image**: `make backend/build-prod`, run it against a throwaway Postgres, and wait for `GET /api/health` to answer. As a root target, a CI job and a `run-guardrails` line, per root `CLAUDE.md`. Same idea for `frontend/Dockerfile.prod`. | Prevent |
| 3 | Cheaper complement to #2: a lint rule (`import/no-extraneous-dependencies` with `devDependencies` limited to `**/*.spec.ts`, test helpers and config files) that fails when non-test code imports a devDependency. It catches this at `make lint`, before any image is built. | Prevent |
| 4 | Make `deploy.yml` verify the rollout: after `darkube deploy`, poll the app's public health endpoint (or the Darkube CLI's status, if it has one) and fail the job if the new version does not come up. | Detect |
| 5 | Document the rollback path (redeploy a previous image tag via `workflow_dispatch` or the Hamravesh panel) in root `CLAUDE.md`'s Continuous deployment section. | Recover |

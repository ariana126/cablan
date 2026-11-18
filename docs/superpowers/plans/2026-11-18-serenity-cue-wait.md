# Serenity Cue-Wait Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Serenity/JS's fixed ~10 ms post-activity wait by upgrading every `@serenity-js/*` package from 3.44.1 to 3.49.0.

**Architecture:** A dependency bump in `acceptance-tests/` only, with the existing `dashify` patch regenerated for the new version. Verified by a `wip/*` CI run, the living documentation's scenario count and branding, and a re-profile.

**Tech Stack:** npm + patch-package; Serenity/JS 3.49.0; Cucumber; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-serenity-cue-wait-design.md`

## Global Constraints

- All eight packages at exactly `3.49.0`: assertions, console-reporter, core, cucumber, playwright, rest, serenity-bdd, web.
- No `.feature`, step-definition or screenplay behaviour change.
- `dashify` patch present for 3.49.0; the 3.44.1 patch file removed.
- `package-lock.json` changed only through npm (it is guard-protected against direct edits).
- The agent reads `acceptance-tests/CLAUDE.md` first and records the change there; it does not commit.

## Review Focus

- A Persian-only scenario or Rule name → still gets a non-empty id after the bump (patch applied on `npm ci` in the image) (Task 1 Step 3).
- `npm ci` in a fresh image → patch-package applies the 3.49.0 patch, not "no patch for version" (Task 1 Step 4).
- Step resolution → no step becomes undefined or ambiguous after the bump (Task 1 Step 4, `--dry-run`).
- `@cucumber/gherkin` override still effective with 3.49.0's peers (Task 1 Step 2).
- Rendered `index.html` → RTL, logo and translations intact (Task 2 Step 2).

---

### Task 1: Bump Serenity/JS to 3.49.0 (qa-engineer)

**Files:**
- Modify: `acceptance-tests/package.json` (eight `@serenity-js/*` ranges → `^3.49.0` or exact `3.49.0`, matching the file's existing style)
- Modify (via npm only): `acceptance-tests/package-lock.json`
- Create: `acceptance-tests/patches/@serenity-js+serenity-bdd+3.49.0.patch`
- Delete: `acceptance-tests/patches/@serenity-js+serenity-bdd+3.44.1.patch`
- Modify: `acceptance-tests/CLAUDE.md` (any version/patch-file references)

- [ ] **Step 1:** In the container, install the eight packages at 3.49.0 with npm so the lockfile updates; confirm `npm ls @serenity-js/core` shows a single 3.49.0.
- [ ] **Step 2:** Check whether `@serenity-js/cucumber@3.49.0` / `@cucumber/cucumber` now depend on a `@cucumber/gherkin` with the Persian keywords; keep the 42.0.0 override unless they do, and report which.
- [ ] **Step 3:** Re-apply the `dashify` change (`/\W/g` → `/[^\p{L}\p{N}]+/gu`, with its explanatory comment updated to "checked up to 3.49.0") to 3.49.0's `dashify.js` and regenerate the patch with `npx patch-package @serenity-js/serenity-bdd`; delete the 3.44.1 patch.
- [ ] **Step 4:** Rebuild the image (`make acceptance-tests/build`) so `npm ci` + `postinstall` run fresh; confirm patch-package reports applying the 3.49.0 patch; then `make acceptance-tests/lint`, `make acceptance-tests/format`, and in the container `npx tsc --noEmit` and `npx cucumber-js --dry-run --format summary` (no undefined/ambiguous steps, same scenario count 790).
- [ ] **Step 5:** Confirm the fix is present: `node_modules/@serenity-js/core/lib/stage/StageManager.js` checks `hasAllOperationsCompletedExcept` before its `setInterval`. Update `acceptance-tests/CLAUDE.md`.

### Task 2: Verify and land (orchestrator)

- [ ] **Step 1:** `make fix-violations`; WIP-commit on `wip/serenity-cue-wait`; push; dispatch `ci.yml`; watch in the background.
- [ ] **Step 2: Pass criteria** — all ten jobs green; per-feature counts identical to run 44203145103; download `living-documentation` and confirm its `index.html` reports 790 scenarios, contains Persian scenario titles, `dir="rtl"`, the logo and translated chrome.
- [ ] **Step 3:** Re-profile (inter-activity gap distribution and total) and report before/after.
- [ ] **Step 4:** Squash onto `main` (`build(acceptance-tests): …` + `docs(…)`), push, delete the `wip/*` branch.

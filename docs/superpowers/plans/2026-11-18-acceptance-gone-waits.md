# Acceptance "Gone" Waits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the 250 ms floor from every "gone" wait and the 30 s stall from the dashboard approve/reject waits.

**Architecture:** One shared count-based `Expectation` in `acceptance-tests/screenplay/common/`, used by every `WaitUntil(…, not(isPresent()))`; the two dashboard tasks wait on the panel's order-number cells instead of a button inside a vanished card. Verified by a `wip/*` CI run and a re-profile.

**Tech Stack:** Serenity/JS 3.49.0 Screenplay, Playwright 1.64, Cucumber.

**Spec:** `docs/superpowers/specs/2026-11-18-acceptance-gone-waits-design.md`

## Global Constraints

- acceptance-tests only; no `.feature`, step wording, backend or frontend change.
- A "gone" check never reads an error other than "no such element" as gone.
- `WaitUntil` (100 ms polling, 5 s timeout, `common/polling.ts`) stays the waiting mechanism.
- No local patch to Serenity/JS.
- The agent reads `acceptance-tests/CLAUDE.md` first and records the convention there; it does not commit.

## Review Focus

- An element inside a parent that itself vanished (`.of(card)` where the card is gone) → the new check returns "gone" immediately, not after 30 s (Task 1 Step 1 probe).
- An element that never left → `WaitUntil` still fails at 5 s with a readable message naming the element (Task 1 Step 1 probe).
- A filtered `PageElements…where(…).first()` subject → no `.first()` of an empty list error, no hang (Task 2).
- Approve as a role whose card stays in view (example #2, یاشار) → still proves the approve button left the card (Task 2).
- Rejection path: dialog closes, then the card leaves → both waits fast (Task 2).

---

### Task 1: Shared count-based "gone" expectation, applied everywhere (qa-engineer)

**Files:**
- Create: `acceptance-tests/screenplay/common/is-gone.ts` (or add to `polling.ts` if the agent judges it the better home — one place either way)
- Modify: `acceptance-tests/screenplay/common/polling.ts` (its doc note on the remaining 250 ms)
- Modify: every file with `WaitUntil(…, not(isPresent()))` — `grep -rn "not(isPresent())" screenplay step-definitions` (31 sites, 17 files at plan time), plus hand-written loops doing the same
- Modify: `acceptance-tests/CLAUDE.md`

**Interfaces:**
- Produces: `isGone(): Expectation<PageElement>` — met when the element's native Playwright locator `count()` is 0; a parent that no longer exists also counts as gone; any other error is rethrown.

- [ ] **Step 1: Probe first.** Write a throwaway scenario-free probe (or a temporary step run with `--name` against one scenario in the container) showing, for a vanished-parent element, the duration of `not(isPresent())` vs `isGone()`, and that an element still present makes `WaitUntil(x, isGone())` fail at ~5 s naming the element. Remove the probe after; report the numbers.
- [ ] **Step 2: Implement `isGone()`** per Interfaces. Resolving the parent chain must not trigger Playwright's 30 s actionability/auto-wait anywhere (count, not waitFor/textContent).
- [ ] **Step 3: Replace every `WaitUntil(x, not(isPresent()))` with `WaitUntil(x, isGone())`.** Leave `Ensure.that(…, not(isPresent()))` assertions unless they are waits in disguise; list any you changed and why.
- [ ] **Step 4: Verify in the container:** `make acceptance-tests/lint`, `make acceptance-tests/format`, `npx tsc --noEmit`, `npx cucumber-js --dry-run --format summary` → 790 scenarios, none undefined/ambiguous; `grep -rn "not(isPresent())" screenplay step-definitions` shows only deliberate assertions.
- [ ] **Step 5:** Update `polling.ts`'s note and `acceptance-tests/CLAUDE.md` ("gone" waits use `isGone()`, never `not(isPresent())`, and why).

### Task 2: Dashboard approve/reject wait on the panel, not the vanished card (qa-engineer)

**Files:**
- Modify: `acceptance-tests/screenplay/bom-analyzing/daily-bom-approval.ts` (`ApproveDailyBom.fromTheDashboard`, `RejectDailyBom.fromTheDashboard`)
- Possibly modify: `acceptance-tests/screenplay/ui/bom-dashboard-page.ts` (a locator for "pending card with order number N in panel P" if none fits)

**Interfaces:**
- Consumes: `isGone()` from Task 1; `BomDashboardPage.orderNumberCellsInPanel` (or equivalent existing locator).

- [ ] **Step 1:** Read why example #2 (یاشار) is fast and #1 (مصطفی) stalls — does the card stay in view for one and leave for the other? Record it in the report.
- [ ] **Step 2:** Make each task's final wait prove the outcome without resolving a child of a filtered card that may no longer exist: wait until the panel shows no card with that order number still offering «تایید» / «عدم تایید» — whether the card left the view or stayed with the button gone. Rejection keeps its dialog-closed wait first.
- [ ] **Step 3:** Run the three affected scenarios plus the rejection-from-dashboard scenarios locally only if the stack is cheap to start; otherwise rely on the CI run (CLAUDE.local.md). Re-run Task 1 Step 4 checks.

### Task 3: Verify and land (orchestrator)

- [ ] **Step 1:** `make fix-violations`; WIP-commit on `wip/acceptance-gone-waits`; push; dispatch `ci.yml`; watch in the background.
- [ ] **Step 2: Pass criteria** — all ten jobs green; per-feature counts identical to run 44223217499 (790 total).
- [ ] **Step 3:** Re-profile with the scratchpad `profile_acceptance.py`: no "does not become present"/gone wait over 1 s; the three 30 s waits gone; report test-run and job wall clock before/after.
- [ ] **Step 4:** Squash onto `main` (`perf(acceptance-tests): …` + `docs(…)`), confirm messages with the user, push, delete the `wip/*` branch; update the speed follow-ups memory.

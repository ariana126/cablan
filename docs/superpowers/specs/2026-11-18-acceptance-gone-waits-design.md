# Acceptance "gone" waits — design

Date: 2026-11-18 · Size: small change (acceptance-tests only) · Follows
`2026-11-18-serenity-cue-wait-design.md`

## Intent

After two speed rounds the acceptance test run is ~29 min (CI run 44223217499). Two waits for
"something has disappeared" remain costly:

1. **The 250 ms floor.** Every `WaitUntil(x, not(isPresent()))` (31 call sites, 17 files) pays at
   least 250 ms per check: Serenity/JS 3.49's `PlaywrightLocator.isPresent()` calls
   `locator.first().waitFor({ state: 'attached', timeout: 250 })`, which for an element that is
   already gone always runs to its timeout. Measured cost ~1–1.5 min.
2. **Three 30 s waits.** `ApproveDailyBom.fromTheDashboard` (`screenplay/bom-analyzing/daily-bom-approval.ts`)
   ends with `WaitUntil(cardApproveButton().of(card), not(isPresent()))`. In «تایید آنالیز روزانه از
   داشبورد #1» and «آنالیز روزانه ای که از داشبورد تایید می شود …» that one interaction took 30.05 s
   and passed, though `WaitUntil`'s timeout is 5 s — a single check hung for Playwright's default
   30 s. The card is `PageElements…where(Text.of(order-number cell), equals(n)).first()`; once
   approved it leaves the default «در انتظار تایید» view, and resolving a button inside a filtered
   card that no longer exists stalls until Playwright's timeout, which `isPresent` then reads as
   "absent". Where the card stays (example #2, یاشار) the wait is fast. **Not an app bug.**

## Goals / non-goals / anti-goals

- Goal: remove the 250 ms floor from every "gone" wait, and the 30 s stall from the dashboard
  approval/rejection waits (~3 min of the run).
- Non-goal: any other wait, calendar picking, logins, CI infrastructure.
- Anti-goal: a "gone" check that passes when the element never left (e.g. on an error), any change
  to what a scenario verifies, to `.feature` files or to step wording.

## Approaches

1. **A shared count-based "gone" expectation — chosen.** One expectation in `screenplay/common/`
   that asks the browser how many elements match (Playwright `locator.count()`, no wait) and is met
   at zero; `WaitUntil` keeps doing the polling (100 ms) and the 5 s timeout.
2. Patch Serenity's 250 ms with patch-package — rejected: a second local patch to a third-party
   package for something expressible in the suite's own code.
3. Leave `not(isPresent())` and only fix the dashboard waits — rejected: leaves the ~1–1.5 min floor.

## Design

- **`isGone()` (name is the builder's call), in `screenplay/common/`.** An `Expectation` over a
  `PageElement` met when the element's native locator matches nothing. Any error other than "no
  such element" is rethrown, never read as gone. Documented beside `WaitUntil` in `polling.ts`'s
  neighbourhood, replacing that file's note about the remaining 250 ms.
- **Every `WaitUntil(x, not(isPresent()))` uses it** (and any hand-written loop doing the same).
  `Ensure.that(x, not(isPresent()))` assertions are left alone unless they are waits in disguise.
- **Dashboard approval and rejection** (`ApproveDailyBom.fromTheDashboard`,
  `RejectDailyBom.fromTheDashboard`) stop resolving a button inside the vanished card: they wait
  until the product's panel no longer shows a pending card with that order number, using the
  page's existing order-number cells (`orderNumberCellsInPanel` or equivalent). Where the card can
  legitimately stay in view, the wait must still prove the approve/reject button has gone from
  that card — the builder confirms both paths (examples #1 and #2) take well under a second.
- `acceptance-tests/CLAUDE.md` records the convention: "gone" waits use the shared expectation,
  never `not(isPresent())`.

## Verification

- Local: lint, format, `tsc --noEmit`, `cucumber-js --dry-run` in the container.
- CI on a `wip/*` branch: all ten jobs green; per-feature scenario counts identical to run
  44223217499 (790).
- Re-profile: no "does not become present" wait over 1 s; the three 30 s waits gone; report the
  run before/after.
- Expect a latent race or two to surface (both earlier rounds did); fix at the root, not by
  adding sleeps.

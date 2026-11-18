# Serenity cue-wait overhead — design

Date: 2026-11-18 · Size: small change (acceptance-tests only) · Follows
`2026-11-18-acceptance-run-speed-design.md`

## Intent

After the first speed round the acceptance test run is ~41 min (CI run 44203145103). Profiling its
Serenity JSON showed a fixed **~11 ms pause after every activity** (105k activities; median gap 11 ms
between siblings and after a parent's last child; ~1 ms after Cucumber hooks) — **~18 of 41 min**.

Cause: `@serenity-js/core` 3.44.1 `PerformActivities` awaits `stage.waitForNextCue()` after every
activity, and `StageManager.waitForAsyncOperationsToComplete` polls `setInterval(…, 10)` with no
initial check, so it always waits ≥10 ms even when nothing is pending. **3.49.0** (published
2026-10-10) checks once synchronously first and resolves immediately; 3.45–3.48 do not. The async
operations it waits for (Photographer screenshots, ArtifactArchiver writes, SerenityBDDReporter) are
announced synchronously during event dispatch, so the immediate check sees them.

## Goals / non-goals / anti-goals

- Goal: remove the per-activity pause by upgrading every `@serenity-js/*` package to 3.49.0.
- Non-goal: any other speed work; any change to what a scenario verifies, to `.feature` files or to
  step doors.
- Anti-goal: a living documentation that silently drops or mislabels scenarios, or loses its
  branding (RTL, logo, translations).

## Approaches

1. **Upgrade to 3.49.0 — chosen** (maintained upstream fix; root CLAUDE.md prefers packages).
2. Patch `StageManager` on 3.44.1 with patch-package — rejected: a second local patch duplicating an
   upstream fix.

## Design

- All eight `@serenity-js/*` packages (assertions, console-reporter, core, cucumber, playwright,
  rest, serenity-bdd, web) to `3.49.0` together, through npm so `package-lock.json` stays
  authoritative.
- 3.49.0's `dashify` still uses `\W`: regenerate the patch as
  `patches/@serenity-js+serenity-bdd+3.49.0.patch` and delete the 3.44.1 one (CLAUDE.md, Gotchas).
- Keep the `@cucumber/gherkin` 42.0.0 override unless 3.49.0's dependencies already ship the Persian
  keywords (builder checks and reports; keeping it is the default).
- Update `acceptance-tests/CLAUDE.md` where it names the version or the patch file.

## Verification

- Local (cheap): lint, format, `tsc --noEmit`, `cucumber-js --dry-run` in the container.
- CI on a `wip/*` branch: all ten jobs green; per-feature scenario counts identical to run
  44203145103; the downloaded living documentation renders all 790 scenarios with Persian names,
  and `index.html` keeps RTL, logo and translated labels (CLAUDE.md's post-bump spot check).
- Re-profile: the ~11 ms inter-activity gap drops to ~1 ms; report before/after.

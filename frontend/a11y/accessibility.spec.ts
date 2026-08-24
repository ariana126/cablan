import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type { Result } from 'axe-core';

import { ACCESS_TOKEN_STORAGE_KEY } from '../src/app/core/identity/access-token-storage-key';

/**
 * Every route the audit visits, split by whether reaching it needs a session.
 *
 * **Add a path to one of these lists whenever you add a route** — a page missing from them is a page
 * nothing checks. This is the one manual step the gate depends on.
 *
 * `/` still falls through to the not-found page via the wildcard route, same as `/no-such-page`, so
 * auditing both costs nothing. `/login` is Cablan's first real page.
 */
const publicRoutes = ['/', '/no-such-page', '/login'];
const authenticatedRoutes: string[] = ['/users', '/materials'];

/**
 * Every route is audited once per colour scheme, because half of what this gate checks is contrast
 * and the app has two sets of colours. `mat.theme()` emits every colour token as a CSS
 * `light-dark()` pair (see src/styles/_theme.scss), so the dark scheme is not a variant someone
 * opted into — it is what any visitor whose OS prefers dark actually sees, and it was ungraded
 * until this list existed.
 *
 * Both schemes are named explicitly rather than letting one of them ride on Chromium's default.
 * The default is a property of the runner, not a decision of ours: a CI image or a developer's
 * machine that preferred dark would silently change which half of the palette this gate covers,
 * and the run would still be green either way. Naming both removes the question.
 */
const colourSchemes = ['light', 'dark'] as const;

/**
 * The rules the gate enforces: every axe rule that maps to a WCAG A or AA success criterion,
 * and nothing else. `best-practice` is excluded because its rules (`region`,
 * `page-has-heading-one`, `heading-order`) are editorial rather than normative, and AAA and
 * `experimental` because they exceed the AA bar this project sets — an axe upgrade that adds
 * an experimental rule must not turn CI red on its own.
 *
 * Note what a green run does not prove: axe detects roughly a third of WCAG failures. See the
 * accessibility section of ../CLAUDE.md for the review checklist covering the rest. In particular
 * a form's *error* state is not reachable by navigation, so nothing here grades it.
 */
const wcagAaTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** A count tells you nothing. Print the rule, why it matters, and which elements broke it. */
function describeViolations(violations: Result[]): string {
  return violations
    .map((violation) => {
      const elements = violation.nodes
        .map((node) => `      ${node.target.join(' ')}\n        ${node.failureSummary}`)
        .join('\n');

      return [
        `  ${violation.id} (${violation.impact}) — ${violation.help}`,
        `    ${violation.helpUrl}`,
        elements,
      ].join('\n');
    })
    .join('\n\n');
}

async function auditRoute(
  page: Page,
  route: string,
  colorScheme: (typeof colourSchemes)[number],
): Promise<void> {
  // Before `goto`, so the first paint is already in the target scheme. Emulating afterwards would
  // work too — `light-dark()` re-resolves on the media change — but it leaves a frame in the other
  // scheme, and there is no reason to give the audit a transitional state to race with.
  await page.emulateMedia({ colorScheme });

  await page.goto(route);
  // `goto` resolves on load, but Angular renders after it. Without this the audit would
  // grade an empty <app-root> and pass without having looked at anything.
  await expect(page.locator('app-root')).not.toBeEmpty();

  const { violations } = await new AxeBuilder({ page }).withTags(wcagAaTags).analyze();

  // Assert on the rule ids, not the violation objects: the diff stays one line per broken
  // rule instead of a hundred lines of axe's JSON, and the detail is in the message above it.
  expect(
    violations.map((violation) => violation.id),
    `\n${describeViolations(violations)}\n`,
  ).toEqual([]);
}

for (const route of publicRoutes) {
  for (const colourScheme of colourSchemes) {
    test(`${route} has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
      page,
    }) => {
      await auditRoute(page, route, colourScheme);
    });
  }
}

// A session is seeded with `page.addInitScript` — SessionStore reads its key as it is constructed,
// and the guard redirects on the very first navigation, so the key must exist before any page
// script runs — and the one call each page makes is stubbed with `page.route`, fulfilled inside the
// browser so the audit never reaches the backend. Both endpoints are stubbed for every route in this
// list: each page only ever calls its own, so stubbing the other is harmless and this list needs no
// per-route mapping. This proves the page's markup is accessible, not that any particular real
// payload is; see ../CLAUDE.md's Accessibility section for that trade-off.
for (const route of authenticatedRoutes) {
  for (const colourScheme of colourSchemes) {
    test(`${route} has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
      page,
    }) => {
      await page.addInitScript(
        (key) => window.localStorage.setItem(key, 'an-a11y-audit-token'),
        ACCESS_TOKEN_STORAGE_KEY,
      );
      await page.route('**/api/users', (route) =>
        route.fulfill({
          json: [{ id: '1', name: 'کاربر نمونه', username: 'sample.user', role: 'system_admin' }],
        }),
      );
      await page.route('**/api/materials', (route) =>
        route.fulfill({ json: [{ id: '1', name: 'مادهٔ اولیهٔ نمونه' }] }),
      );

      await auditRoute(page, route, colourScheme);
    });
  }
}

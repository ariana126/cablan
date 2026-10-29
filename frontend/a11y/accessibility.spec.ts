import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type { Result } from 'axe-core';

import {
  ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
} from '../src/app/core/identity/access-token-storage-key';
import { fakeAccessToken } from '../src/app/core/identity/testing/fake-access-token';

/**
 * Every route the audit visits, split by whether reaching it needs a session.
 *
 * **Add a path to one of these lists whenever you add a route** — a page missing from them is a page
 * nothing checks. This is the one manual step the gate depends on.
 *
 * `/login` is the only public route: it is the page you see before you have a session, and every
 * other URL sends a visitor without one there. That includes `/no-such-page` — the wildcard route
 * renders the not-found page only for a live session, so an outsider cannot probe which pages exist —
 * which is why it is audited with a session below, as is `/`, the home page.
 *
 * The seeded session is a System Admin (see the `/api/users/me` stub), which is deliberate: that is
 * the role the navigation drawer renders every category for, so the audit grades the fullest tree
 * rather than a trimmed one. Visiting a page opens the categories that hold it, so between them the
 * routes below grade every branch of the drawer expanded.
 *
 * `/?category=reports` is home drilled two levels in — the state that renders its level heading and
 * gives the toolbar breadcrumb home's own levels.
 */
const publicRoutes = ['/login'];
const authenticatedRoutes: string[] = [
  '/no-such-page',
  '/',
  '/?category=reports',
  '/users',
  '/materials',
  '/components',
  '/products',
  '/standard-boms',
  '/boms',
  '/boms/dashboard',
  '/audit-log',
  '/equipment',
  '/maintenance-activities',
  '/pm-plans',
  '/pm-schedule/daily',
  '/pm-schedule/overview',
];

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

/**
 * Resolves once the page's DOM has stopped changing for `quietMs`, or after `ceilingMs` regardless.
 *
 * `app-root` being non-empty is not "rendered". Angular is zoneless here, so a lazily routed page is
 * built in two steps separated by a scheduled task: its elements are *created* when the router
 * activates it (Material has already given each `matInput` its `mat-input-N` id), and its bindings —
 * a form field's `<label for>`, a combobox's `aria-expanded`/`aria-controls` — are only *written* in
 * the change-detection pass that follows. Chromium can hand control to axe between the two, and axe
 * then grades a half-built page: "form elements must have labels" on inputs that are labelled a
 * frame later. A real visitor never sees that frame as a state, so it is not what this gate is for.
 *
 * Angular's own `Testability` cannot answer "is it settled" (it is zone-based, and always reports
 * stable without a zone), hence watching the DOM. Neither the quiet window nor the ceiling hides a
 * defect: a page that is still unlabelled once it has stopped changing fails exactly as before.
 */
async function waitForRenderToSettle(page: Page, quietMs = 300, ceilingMs = 5000): Promise<void> {
  await page.evaluate(
    ([quiet, ceiling]) =>
      new Promise<void>((resolve) => {
        let quietTimer: ReturnType<typeof setTimeout>;
        const finish = (): void => {
          observer.disconnect();
          clearTimeout(quietTimer);
          clearTimeout(ceilingTimer);
          resolve();
        };
        const observer = new MutationObserver(() => {
          clearTimeout(quietTimer);
          quietTimer = setTimeout(finish, quiet);
        });
        const ceilingTimer = setTimeout(finish, ceiling);
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        quietTimer = setTimeout(finish, quiet);
      }),
    [quietMs, ceilingMs] as const,
  );
}

async function auditRoute(
  page: Page,
  route: string,
  colorScheme: (typeof colourSchemes)[number],
  reachState?: (page: Page) => Promise<void>,
): Promise<void> {
  // Before `goto`, so the first paint is already in the target scheme. Emulating afterwards would
  // work too — `light-dark()` re-resolves on the media change — but it leaves a frame in the other
  // scheme, and there is no reason to give the audit a transitional state to race with.
  await page.emulateMedia({ colorScheme });

  await page.goto(route);
  // `goto` resolves on load, but Angular renders after it. Without this the audit would
  // grade an empty <app-root> and pass without having looked at anything.
  await expect(page.locator('app-root')).not.toBeEmpty();
  // ...and non-empty is only the shell. Wait for the page itself to finish its two-step render.
  await waitForRenderToSettle(page);
  // A state navigation alone cannot reach (a panel opened by a click), driven before grading.
  if (reachState !== undefined) {
    await reachState(page);
    await waitForRenderToSettle(page);
  }

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

// A session is seeded with `page.addInitScript` — SessionStore reads its keys as it is constructed,
// and the guard redirects on the very first navigation, so the keys must exist before any page
// script runs. The token has to be a readable JWT received just now, by the browser's own clock, or
// SessionStore discards it and every route below quietly audits the login page instead — and the one call each page makes is stubbed with `page.route`, fulfilled inside the
// browser so the audit never reaches the backend. Both endpoints are stubbed for every route in this
// list: each page only ever calls its own, so stubbing the other is harmless and this list needs no
// per-route mapping. This proves the page's markup is accessible, not that any particular real
// payload is; see ../CLAUDE.md's Accessibility section for that trade-off.
/** One correction of a daily BOM (issue #73), as the report and the dashboard both send it. */
const SAMPLE_EDIT_HISTORY = [
  {
    editedBy: 'کاربر نمونه',
    editedAt: '2026-06-22T05:30:00.000Z',
    reason: 'خطای ترازو',
    heading:
      'کاربر کاربر نمونه در 1405/04/01 ساعت 09:00 به علت خطای ترازو تغییرات زیر را انجام داد',
    changes: ['وزن جز مغزی نمونه مواد اولیه مادهٔ اولیهٔ نمونه از 3 به 1.25 تغییر کرد'],
  },
];

async function seedAuthenticatedPage(page: Page): Promise<void> {
  await page.addInitScript(
    ({ tokenKey, receivedAtKey, token }) => {
      window.localStorage.setItem(tokenKey, token);
      window.localStorage.setItem(receivedAtKey, String(Date.now()));
    },
    {
      tokenKey: ACCESS_TOKEN_STORAGE_KEY,
      receivedAtKey: ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY,
      token: fakeAccessToken(),
    },
  );
  await page.route('**/api/users', (route) =>
    route.fulfill({
      json: [{ id: '1', name: 'کاربر نمونه', username: 'sample.user', role: 'system_admin' }],
    }),
  );
  // Registered after the '**/api/users' stub above, because Playwright consults routes in
  // reverse registration order — the broader glob would otherwise swallow this one and answer
  // "who am I" with an array. Every authenticated route needs it: the navigation drawer asks on
  // every page, not just the one whose data it is.
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      json: { id: '1', name: 'کاربر نمونه', username: 'sample.user', role: 'system_admin' },
    }),
  );
  await page.route('**/api/materials', (route) =>
    route.fulfill({ json: [{ id: '1', name: 'مادهٔ اولیهٔ نمونه', code: 'RM-001' }] }),
  );
  await page.route('**/api/components', (route) =>
    route.fulfill({ json: [{ id: '1', name: 'جز نمونه' }] }),
  );
  await page.route('**/api/products', (route) =>
    route.fulfill({
      json: [
        {
          id: '1',
          name: 'محصول نمونه',
          components: [
            {
              id: '1',
              name: 'جز نمونه',
              materials: [{ id: '1', name: 'مادهٔ اولیهٔ نمونه' }],
            },
          ],
        },
      ],
    }),
  );
  await page.route('**/api/standard-boms', (route) =>
    route.fulfill({
      json: [
        {
          id: '1',
          miCode: '1234',
          brand: 'Legrand',
          standardLength: 305,
          active: true,
          description: 'آنالیز استاندارد نمونه',
          productId: '1',
          components: [
            {
              id: '1',
              name: 'جز نمونه',
              materials: [{ id: '1', name: 'مادهٔ اولیهٔ نمونه', weight: 150 }],
            },
          ],
        },
      ],
    }),
  );
  await page.route('**/api/boms/report/filter-options', (route) =>
    route.fulfill({
      json: {
        orderNumbers: ['ORD-1000'],
        trackingNumbers: ['TRK-1000'],
        brands: ['برند نمونه'],
        componentNames: ['جز نمونه'],
        standardBomMiCodes: ['1234'],
        productNames: ['محصول نمونه'],
        registeredByUsers: ['کاربر نمونه'],
        approvalStatuses: ['approved', 'pending', 'rejected'],
        reviewers: ['کاربر نمونه'],
      },
    }),
  );
  await page.route('**/api/boms/report', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '1',
            orderNumber: 'SO-1234',
            trackingNumber: 'TN-5678',
            registeredAt: '2026-06-22T04:00:00.000Z',
            registeredBy: 'کاربر نمونه',
            standardBomMiCode: '1234',
            brand: 'برند نمونه',
            productName: 'محصول نمونه',
            approvalStatus: 'approved',
            reviewedBy: 'کاربر نمونه',
            managementNote: null,
            // Corrected once, so the row carries its «جزئیات ویرایش» button.
            editHistory: SAMPLE_EDIT_HISTORY,
          },
          {
            id: '2',
            orderNumber: 'SO-1235',
            trackingNumber: 'TN-5679',
            registeredAt: '2026-06-22T05:00:00.000Z',
            registeredBy: 'کاربر نمونه',
            standardBomMiCode: '1234',
            brand: 'برند نمونه',
            productName: 'محصول نمونه',
            approvalStatus: 'pending',
            reviewedBy: null,
            managementNote: null,
          },
          {
            id: '3',
            orderNumber: 'SO-1236',
            trackingNumber: 'TN-5680',
            registeredAt: '2026-06-22T06:00:00.000Z',
            registeredBy: 'کاربر نمونه',
            standardBomMiCode: '1234',
            brand: 'برند نمونه',
            productName: 'محصول نمونه',
            approvalStatus: 'rejected',
            reviewedBy: 'کاربر نمونه',
            managementNote: 'وزن نمونه خارج از محدوده است',
          },
        ],
        total: 3,
      },
    }),
  );
  await page.route('**/api/boms/dashboard', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            productId: '1',
            productName: 'محصول نمونه',
            dailyBomCount: 1,
            lastRegisteredAt: '2026-06-22T04:00:00.000Z',
          },
        ],
      },
    }),
  );
  await page.route('**/api/boms/dashboard/**/daily-boms', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '1',
            orderNumber: 'SO-1234',
            trackingNumber: 'TN-5678',
            registeredAt: '2026-06-22T04:00:00.000Z',
            registeredBy: 'کاربر نمونه',
            description: 'توضیحات نمونه',
            standardBomMiCode: '1234',
            approvalStatus: 'pending',
            reviewedBy: null,
            managementNote: null,
            // Corrected once, so the card shows its «جزئیات ویرایش» heading and list.
            editHistory: SAMPLE_EDIT_HISTORY,
            score: 4,
            lines: [
              {
                componentId: 'c1',
                componentName: 'مغزی نمونه',
                materialId: 'm1',
                materialName: 'مادهٔ اولیهٔ نمونه',
                actualWeight: 1.25,
                standardWeight: 2.75,
                difference: 1.5,
              },
              {
                componentId: 'c2',
                componentName: 'روکش نمونه',
                materialId: 'm2',
                materialName: 'مادهٔ اولیهٔ دیگر',
                actualWeight: 3.5,
                standardWeight: 1,
                difference: 2.5,
              },
            ],
          },
          {
            id: '2',
            orderNumber: 'SO-1235',
            trackingNumber: 'TN-5679',
            registeredAt: '2026-06-22T05:00:00.000Z',
            registeredBy: 'کاربر نمونه',
            description: '',
            standardBomMiCode: '1234',
            approvalStatus: 'rejected',
            reviewedBy: 'کاربر نمونه',
            managementNote: 'وزن نمونه خارج از محدوده است\nبار دوم بررسی شود',
            score: 0,
            lines: [
              {
                componentId: 'c1',
                componentName: 'مغزی نمونه',
                materialId: 'm1',
                materialName: 'مادهٔ اولیهٔ نمونه',
                actualWeight: 2.5,
                standardWeight: 2.5,
                difference: 0,
              },
            ],
          },
        ],
      },
    }),
  );
  // Registering a daily BOM answers its id, which the preview dialog then reads its lines for.
  await page.route('**/api/boms', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 201, json: { id: '99' } })
      : route.fallback(),
  );
  await page.route('**/api/boms/*/weight-differences', (route) =>
    route.fulfill({
      json: {
        lines: [
          {
            componentId: 'c1',
            componentName: 'مغزی نمونه',
            materialId: 'm1',
            materialName: 'مادهٔ اولیهٔ نمونه',
            actualWeight: 3.5,
            standardWeight: 1,
            difference: 2.5,
          },
          {
            componentId: 'c1',
            componentName: 'مغزی نمونه',
            materialId: 'm2',
            materialName: 'مادهٔ اولیهٔ دیگر',
            actualWeight: 1.25,
            standardWeight: 2.75,
            difference: 1.5,
          },
          {
            componentId: 'c2',
            componentName: 'روکش نمونه',
            materialId: 'm3',
            materialName: 'مادهٔ اولیهٔ سوم',
            actualWeight: 2.5,
            standardWeight: 2.5,
            difference: 0,
          },
        ],
      },
    }),
  );
  await page.route('**/api/standard-boms/report/filter-options', (route) =>
    route.fulfill({
      json: {
        brands: ['برند نمونه'],
        activeStatuses: [true, false],
        productNames: ['محصول نمونه'],
        componentNames: ['جز نمونه'],
      },
    }),
  );
  await page.route('**/api/standard-boms/report', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '1',
            miCode: '1234',
            brand: 'برند نمونه',
            productName: 'محصول نمونه',
            active: true,
          },
        ],
        total: 1,
      },
    }),
  );
  await page.route('**/api/audit-log', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '1',
            occurredAt: '2026-06-22T09:45:00.000Z',
            actorName: 'کاربر نمونه',
            recordType: 'StandardBom',
            recordId: '66666666-6666-6666-6666-666666666666',
            action: 'Edited',
          },
        ],
        total: 1,
      },
    }),
  );
  await page.route('**/api/audit-log/*/changes', (route) =>
    route.fulfill({
      json: {
        changes: [{ field: 'standardLength', previousValue: '305', newValue: '310' }],
      },
    }),
  );
  await stubMaintenance(page);
  // Unstubbed, it reaches whatever backend the dev server proxies to and comes back 401 for the
  // fake token — which ends the session, and the page under audit becomes the login page.
  await page.route('**/api/audit-log/filter-options', (route) =>
    route.fulfill({
      json: {
        actors: ['کاربر نمونه'],
        recordTypes: ['StandardBom', 'MaterialImport'],
        actions: ['Edited', 'Imported'],
      },
    }),
  );
}

/**
 * The maintenance pages (issue #69). The stubs cover every PM status pill — on time, late, missed,
 * overdue, due and upcoming — and a retired piece of equipment, so each tone and marker is graded
 * in both schemes. Counts are two characters or more so axe grades their contrast rather than
 * skipping them as too short.
 */
async function stubMaintenance(page: Page): Promise<void> {
  await page.route('**/api/equipment', (route) =>
    route.fulfill({
      json: [
        { id: 'e1', name: 'اکسترودر نمونه', retired: false },
        { id: 'e2', name: 'دستگاه کنار گذاشته', retired: true },
      ],
    }),
  );
  await page.route('**/api/equipment/*', (route) =>
    route.fulfill({
      json: {
        id: 'e1',
        name: 'اکسترودر نمونه',
        retired: false,
        planItems: [
          {
            id: 'p1',
            activityId: 'a1',
            activityName: 'تعویض روغن',
            intervalDays: 30,
            firstDueDate: '2026-09-23',
            nextDueDate: '2026-10-23',
          },
        ],
      },
    }),
  );
  await page.route('**/api/equipment/*/maintenance-history', (route) =>
    route.fulfill({
      json: [
        {
          id: 'x2',
          activityName: 'تعویض روغن',
          dueDate: '2026-10-23',
          performedAt: '2026-10-25T07:00:00.000Z',
          performedBy: 'کاربر نمونه',
          status: 'late',
          notes: null,
        },
        {
          id: 'x1',
          activityName: 'تعویض روغن',
          dueDate: '2026-09-23',
          performedAt: '2026-09-23T07:00:00.000Z',
          performedBy: 'کاربر نمونه',
          status: 'on_time',
          notes: 'فیلتر روغن هم تعویض شد',
        },
      ],
    }),
  );
  await page.route('**/api/maintenance-activities', (route) =>
    route.fulfill({
      json: [
        { id: 'a1', name: 'تعویض روغن' },
        { id: 'a2', name: 'بررسی تابلو برق' },
      ],
    }),
  );
  const task = {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر نمونه',
    activityId: 'a1',
  };
  await page.route('**/api/pm-schedule/daily', (route) =>
    route.fulfill({
      json: [
        {
          ...task,
          planItemId: 'p1',
          activityName: 'تعویض روغن',
          dueDate: '2026-10-23',
          status: 'due',
          daysOverdue: 0,
        },
        {
          ...task,
          planItemId: 'p2',
          activityName: 'بررسی تابلو برق',
          dueDate: '2026-10-11',
          status: 'overdue',
          daysOverdue: 12,
        },
      ],
    }),
  );
  const occurrence = (dueDate: string, status: string, performed: boolean) => ({
    equipmentId: 'e1',
    equipmentName: 'اکسترودر نمونه',
    planItemId: 'p1',
    activityName: 'تعویض روغن',
    dueDate,
    status,
    performedAt: performed ? `${dueDate}T07:00:00.000Z` : null,
    performedBy: performed ? 'کاربر نمونه' : null,
  });
  await page.route('**/api/pm-schedule/overview', (route) =>
    route.fulfill({
      json: [
        occurrence('2026-07-26', 'on_time', true),
        occurrence('2026-08-25', 'late', true),
        occurrence('2026-09-24', 'missed', false),
        occurrence('2026-10-11', 'overdue', false),
        occurrence('2026-10-23', 'due', false),
        occurrence('2026-11-22', 'upcoming', false),
      ],
    }),
  );
}

/** `/pm-plans` with a piece of equipment chosen — its plan table and history only mount then. */
async function chooseEquipmentOnPmPlans(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'تجهیز', exact: true }).fill('اکسترودر');
  await page.getByRole('option', { name: 'اکسترودر نمونه', exact: true }).click();
  await expect(page.getByRole('button', { name: 'افزودن فعالیت به برنامه' })).toBeVisible();
}

for (const route of authenticatedRoutes) {
  for (const colourScheme of colourSchemes) {
    test(`${route} has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
      page,
    }) => {
      await seedAuthenticatedPage(page);
      await auditRoute(page, route, colourScheme);
    });
  }
}

/**
 * The dashboard's per-product panel only mounts once a product is chosen, so no `goto` reaches it.
 * It is graded here because it is where the dashboard's review happens: the seeded user is a System
 * Admin, so each card carries its approval status and reviewer, «تایید» and «عدم تایید» while
 * pending, and a pencil per line (the two approval filter buttons sit in the band above, graded on
 * the bare route). The lines cover both weight-difference pills — one below its standard, one
 * above — and one line on its standard, whose cell is empty. The stub holds one pending and one
 * rejected daily BOM, so both the review buttons and a two-line management note are graded, and the
 * desktop audit opens one line's inline weight editor first, so its input (named only by
 * `aria-label`) and «ذخیره» are graded too.
 *
 * Two things keep axe from quietly skipping those cells, which it reports as *incomplete* rather
 * than as a violation — so the run would stay green over unreadable text:
 * - **The lines table is scrolled into view before grading.** The panel opens below the fold, inside
 *   the shell's own scroll container, where axe cannot determine a background ("partially obscured")
 *   and grades nothing.
 * - **Every tinted or outlined stub value is more than one character** (`۱٫۵`, `۲٫۵`). axe skips text it deems
 *   too short to be real content, and a lone digit qualifies.
 */
for (const colourScheme of colourSchemes) {
  test(`/boms/dashboard with a product's daily BOMs open has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/boms/dashboard', colourScheme, async (opened) => {
      await opened.getByRole('button', { name: 'محصول نمونه', exact: true }).click();
      const lines = opened.getByRole('table', { name: 'اجزا و مواد اولیه' }).first();
      await expect(lines).toBeVisible();
      await opened
        .getByRole('button', { name: 'ویرایش وزن مواد اولیه مادهٔ اولیهٔ نمونه جز مغزی نمونه' })
        .first()
        .click();
      await expect(
        opened.getByLabel('وزن مواد اولیه مادهٔ اولیهٔ نمونه جز مغزی نمونه', { exact: true }),
      ).toBeVisible();
      await lines.scrollIntoViewIfNeeded();
    });
  });
}

/**
 * The rejection dialog a pending card's «عدم تایید» opens is reachable only by a click, so no `goto`
 * grades it — and its locators are the acceptance suite's (the «دلیل عدم تایید» field and the submit
 * named «عدم تایید»). It is graded in its error state: submitted empty, so the required field's
 * error is on screen and its contrast is graded too — a state no other audit reaches.
 */
for (const colourScheme of colourSchemes) {
  test(`/boms/dashboard's rejection dialog, with its reason missing, has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/boms/dashboard', colourScheme, async (opened) => {
      await opened.getByRole('button', { name: 'محصول نمونه', exact: true }).click();
      await opened.getByRole('button', { name: 'عدم تایید', exact: true }).first().click();
      const dialog = opened.getByRole('dialog');
      await expect(dialog.getByRole('textbox', { name: 'دلیل عدم تایید' })).toBeVisible();
      await dialog.getByRole('button', { name: 'عدم تایید', exact: true }).click();
      await expect(dialog.getByText('دلیل عدم تایید را وارد کنید.')).toBeVisible();
    });
  });
}

/**
 * The reason dialog a card's inline weight «ذخیره» opens (issue #73) is reachable only by clicks. It
 * is graded in its refused state: «ثبت» with no reason, answered by the stubbed
 * `edit-reason-required`, so the field's error is on screen and its contrast graded too.
 */
for (const colourScheme of colourSchemes) {
  test(`/boms/dashboard's edit-reason dialog, with its reason refused, has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await page.route('**/api/boms/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 400,
            contentType: 'application/problem+json',
            json: {
              type: 'https://my-api-doc.dev/problems/edit-reason-required',
              title: 'Edit Reason Required',
              status: 400,
            },
          })
        : route.fallback(),
    );
    await auditRoute(page, '/boms/dashboard', colourScheme, async (opened) => {
      await opened.getByRole('button', { name: 'محصول نمونه', exact: true }).click();
      await opened
        .getByRole('button', { name: 'ویرایش وزن مواد اولیه مادهٔ اولیهٔ نمونه جز مغزی نمونه' })
        .first()
        .click();
      await opened.getByRole('button', { name: 'ذخیره', exact: true }).click();
      const dialog = opened.getByRole('dialog');
      await expect(dialog.getByRole('textbox', { name: 'دلیل ویرایش' })).toBeVisible();
      await dialog.getByRole('button', { name: 'ثبت', exact: true }).click();
      await expect(dialog.getByText('نوشتن دلیل ویرایش لازم است')).toBeVisible();
    });
  });
}

/** `/pm-plans` with equipment chosen: the plan table, its row actions and the history (issue #69). */
for (const colourScheme of colourSchemes) {
  test(`/pm-plans with equipment chosen has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/pm-plans', colourScheme, chooseEquipmentOnPmPlans);
  });
}

/**
 * The add-item dialog, submitted empty, so all three of its field errors — the activity picker, the
 * interval and the Jalali first due date — are on screen and graded.
 */
for (const colourScheme of colourSchemes) {
  test(`/pm-plans' add-item dialog, submitted empty, has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/pm-plans', colourScheme, async (opened) => {
      await chooseEquipmentOnPmPlans(opened);
      await opened.getByRole('button', { name: 'افزودن فعالیت به برنامه' }).click();
      const dialog = opened.getByRole('dialog', { name: 'افزودن فعالیت به برنامه' });
      await dialog.getByRole('button', { name: 'ثبت', exact: true }).click();
      await expect(dialog.getByText('اولین موعد را انتخاب کنید.')).toBeVisible();
    });
  });
}

/** The daily list's record dialog, opened from a row's «ثبت انجام». */
for (const colourScheme of colourSchemes) {
  test(`/pm-schedule/daily's record dialog has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/pm-schedule/daily', colourScheme, async (opened) => {
      await opened
        .getByRole('button', { name: 'ثبت انجام تعویض روغن اکسترودر نمونه', exact: true })
        .click();
      await expect(opened.getByRole('textbox', { name: 'توضیحات' })).toBeVisible();
    });
  });
}

/** The edit-details dialog a corrected `/boms` row's «جزئیات ویرایش» opens (issue #73). */
for (const colourScheme of colourSchemes) {
  test(`/boms with a daily BOM's edit details open has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/boms', colourScheme, async (opened) => {
      await opened.getByRole('button', { name: 'جزئیات ویرایش', exact: true }).first().click();
      const dialog = opened.getByRole('dialog', { name: 'جزئیات ویرایش' });
      await expect(dialog.getByRole('list', { name: 'جزئیات ویرایش' })).toBeVisible();
    });
  });
}

/**
 * The preview `/boms` opens once a daily BOM is registered (issue #50) is reachable only by
 * registering one, so the form is filled and submitted against the stubs above (`POST /api/boms`
 * answers id 99). Its lines cover both weight-difference pills — one above its standard, one below —
 * and one line on its standard, whose cell is empty; every pill value is more than one character so
 * axe grades its contrast rather than skipping it.
 */
async function openBomPreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'افزودن آنالیز روزانه' }).click();
  const form = page.getByRole('dialog', { name: 'ثبت آنالیز روزانه جدید' });
  await form.getByLabel('کد MI آنالیز استاندارد').fill('1234');
  await page.getByRole('option', { name: '1234 — Legrand' }).click();
  await form.getByLabel('شماره سفارش').fill('SO-9999');
  await form.getByLabel('شماره ردیابی').fill('TN-9999');
  await form.getByLabel('وزن «مادهٔ اولیهٔ نمونه» (گرم)').fill('150');
  await form.getByRole('button', { name: 'ثبت آنالیز' }).click();
  const preview = page.getByRole('dialog', { name: 'پیش‌نمایش آنالیز روزانه' });
  await expect(preview.getByRole('table', { name: 'اختلاف وزن مواد اولیه' })).toBeVisible();
}

for (const colourScheme of colourSchemes) {
  test(`/boms with a registered daily BOM's preview open has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/boms', colourScheme, openBomPreview);
  });
}

/**
 * The accounting-Excel change list `/materials` opens (issue #74) is reachable only by choosing a
 * file, so the hidden input is given one and the preview is stubbed: a registration, a code change
 * whose code is taken (an error row) and a rename. It is graded in its refused state — «تایید»
 * answered by a stubbed `material-import-has-invalid-rows` — so the error rows' tint and the
 * dialog's alert are on screen and their contrast graded too.
 */
async function openMaterialImportChangeList(page: Page): Promise<void> {
  await page.route('**/api/materials/import-preview', (route) =>
    route.fulfill({
      json: {
        changes: [
          {
            row: 3,
            kind: 'register',
            name: 'آلومینیوم',
            code: 'A-1',
            materialId: null,
            previousName: null,
            previousCode: null,
            errors: [],
          },
          {
            row: 4,
            kind: 'changeCode',
            name: 'مادهٔ اولیهٔ نمونه',
            code: 'B-1',
            materialId: '1',
            previousName: 'مادهٔ اولیهٔ نمونه',
            previousCode: 'RM-001',
            errors: ['code-taken', 'material-targeted-twice'],
          },
          {
            row: 5,
            kind: 'rename',
            name: 'برنج زرد',
            code: 'B-1',
            materialId: '2',
            previousName: 'برنج',
            previousCode: 'B-1',
            errors: [],
          },
        ],
      },
    }),
  );
  await page.route('**/api/materials/imports', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/problem+json',
      json: {
        type: 'https://my-api-doc.dev/problems/material-import-has-invalid-rows',
        title: 'Material Import Has Invalid Rows',
        status: 400,
        rows: [{ row: 4, name: 'مادهٔ اولیهٔ نمونه', code: 'B-1', errors: ['code-taken'] }],
      },
    }),
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: 'Book1.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('stubbed'),
  });
  const dialog = page.getByRole('dialog', { name: 'لیست تغییرات بارگذاری از اکسل' });
  await expect(dialog.getByRole('button', { name: 'حذف ردیف 4' })).toBeVisible();
  await dialog.getByRole('button', { name: 'تایید', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
}

for (const colourScheme of colourSchemes) {
  test(`/materials with a refused Excel change list open has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await auditRoute(page, '/materials', colourScheme, openMaterialImportChangeList);
  });
}

/**
 * A bulk import's details in `/audit-log` (issue #74): its lines as sentences and, for the seeded
 * System Admin, «برگرداندن» — pressed against a stubbed 409 `material-import-not-latest`, so the
 * dialog's alert is graded too. The list and changes stubs are overridden for this audit only.
 */
async function openRefusedMaterialImportReversion(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'جزئیات تغییرات import-1', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'جزئیات تغییرات بارگذاری گروهی' });
  await expect(dialog.getByRole('list', { name: 'تغییرات بارگذاری گروهی' })).toBeVisible();
  await dialog.getByRole('button', { name: 'برگرداندن', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
}

async function stubMaterialImportEntry(page: Page): Promise<void> {
  await page.route('**/api/audit-log', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '9',
            occurredAt: '2026-10-29T09:45:00.000Z',
            actorName: 'کاربر نمونه',
            recordType: 'MaterialImport',
            recordId: 'import-1',
            action: 'Imported',
          },
        ],
        total: 1,
      },
    }),
  );
  await page.route('**/api/audit-log/*/changes', (route) =>
    route.fulfill({
      json: {
        changes: [
          { field: 'importedMaterial:A-1', previousValue: '', newValue: 'آلومینیوم' },
          { field: 'materialCode:مسی', previousValue: 'M-101', newValue: 'M-201' },
          { field: 'materialName:B-1', previousValue: 'برنج', newValue: 'برنج زرد' },
        ],
      },
    }),
  );
  await page.route('**/api/materials/imports/*/reversion', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      json: {
        type: 'https://my-api-doc.dev/problems/material-import-not-latest',
        title: 'Material Import Not Latest',
        status: 409,
      },
    }),
  );
}

for (const colourScheme of colourSchemes) {
  test(`/audit-log with a bulk import's refused reversion open has no WCAG A or AA accessibility violations (${colourScheme})`, async ({
    page,
  }) => {
    await seedAuthenticatedPage(page);
    await stubMaterialImportEntry(page);
    await auditRoute(page, '/audit-log', colourScheme, openRefusedMaterialImportReversion);
  });
}

/**
 * The same audit on a phone held upright (issue #41), plus the check the issue was about: nothing on
 * the page scrolls sideways.
 *
 * Below 40rem of sheet width every list table folds into labelled cards (`appStackedTable`,
 * `src/styles/_stacked-table.scss`), and the dashboard's analysis headers re-flow — layouts no
 * desktop-width run ever renders, so their markup and contrast are only graded here.
 *
 * Overflow is measured on **every** scroll container, not on the document: the app's scroller is
 * `mat-sidenav-content`, so a page wider than the screen leaves `document.documentElement`'s
 * `scrollWidth` equal to the viewport and would pass a document-only check while scrolling sideways
 * in the visitor's hand. That is exactly how issue #41 looked. An element counts when its own
 * `overflow-x` lets it scroll and its content is wider than its box; a 1px allowance absorbs
 * sub-pixel rounding.
 */
const phone = { width: 375, height: 812 };

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const scrollers = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        const overflowX = getComputedStyle(element).overflowX;
        return (
          (overflowX === 'auto' || overflowX === 'scroll') &&
          element.scrollWidth > element.clientWidth + 1
        );
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}.${Array.from(element.classList).join('.')} (${element.scrollWidth}px of content in ${element.clientWidth}px)`,
      ),
  );
  const documentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(scrollers, 'these scroll sideways at phone width').toEqual([]);
  expect(documentOverflow, 'the document is wider than the screen').toBeLessThanOrEqual(0);
}

test.describe('on a phone, portrait', () => {
  test.use({ viewport: phone, hasTouch: true });

  for (const route of publicRoutes) {
    for (const colourScheme of colourSchemes) {
      test(`${route} has no violations and no sideways scroll at ${phone.width}px (${colourScheme})`, async ({
        page,
      }) => {
        await auditRoute(page, route, colourScheme);
        await expectNoSidewaysScroll(page);
      });
    }
  }

  for (const route of authenticatedRoutes) {
    for (const colourScheme of colourSchemes) {
      test(`${route} has no violations and no sideways scroll at ${phone.width}px (${colourScheme})`, async ({
        page,
      }) => {
        await seedAuthenticatedPage(page);
        await auditRoute(page, route, colourScheme);
        await expectNoSidewaysScroll(page);
      });
    }
  }

  for (const colourScheme of colourSchemes) {
    test(`/pm-plans with equipment chosen has no violations and no sideways scroll at ${phone.width}px (${colourScheme})`, async ({
      page,
    }) => {
      await seedAuthenticatedPage(page);
      await auditRoute(page, '/pm-plans', colourScheme, chooseEquipmentOnPmPlans);
      await expectNoSidewaysScroll(page);
    });
  }

  for (const colourScheme of colourSchemes) {
    test(`/boms with a registered daily BOM's preview open has no violations and no sideways scroll at ${phone.width}px (${colourScheme})`, async ({
      page,
    }) => {
      await seedAuthenticatedPage(page);
      await auditRoute(page, '/boms', colourScheme, openBomPreview);
      await expectNoSidewaysScroll(page);
    });
  }

  for (const colourScheme of colourSchemes) {
    test(`/materials with a refused Excel change list open has no violations and no sideways scroll at ${phone.width}px (${colourScheme})`, async ({
      page,
    }) => {
      await seedAuthenticatedPage(page);
      await auditRoute(page, '/materials', colourScheme, openMaterialImportChangeList);
      await expectNoSidewaysScroll(page);
    });
  }

  for (const colourScheme of colourSchemes) {
    test(`/boms/dashboard with a product's daily BOMs open has no violations and no sideways scroll at ${phone.width}px (${colourScheme})`, async ({
      page,
    }) => {
      await seedAuthenticatedPage(page);
      await auditRoute(page, '/boms/dashboard', colourScheme, async (opened) => {
        await opened.getByRole('button', { name: 'محصول نمونه', exact: true }).click();
        const lines = opened.getByRole('table', { name: 'اجزا و مواد اولیه' }).first();
        await expect(lines).toBeVisible();
        // The inline weight editor is the widest thing a line card can hold; open it so the
        // sideways-scroll check measures it too.
        await opened
          .getByRole('button', { name: 'ویرایش وزن مواد اولیه مادهٔ اولیهٔ نمونه جز مغزی نمونه' })
          .first()
          .click();
        await lines.scrollIntoViewIfNeeded();
      });
      await expectNoSidewaysScroll(page);
    });
  }
});

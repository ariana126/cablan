import { expect, test } from '@playwright/test';

/**
 * The design system's non-colour foundations, checked in a real browser: the six Cablan type
 * tokens, the 8px control shape, button and field density, and the layout primitives. Like
 * `design-tokens.spec.ts` this needs computed styles, which jsdom cannot give, so it lives in the
 * accessibility gate.
 */

const typeTokens = [
  { name: 'cablan-page-title', size: '24px', weight: '700', lineHeight: '32px' },
  { name: 'cablan-section-title', size: '18px', weight: '600', lineHeight: '28px' },
  { name: 'cablan-card-title', size: '16px', weight: '600', lineHeight: '24px' },
  { name: 'cablan-table-header', size: '13px', weight: '600', lineHeight: '18px' },
  { name: 'cablan-data', size: '14px', weight: '400', lineHeight: '20px' },
  { name: 'cablan-meta', size: '12px', weight: '500', lineHeight: '16px' },
] as const;

const pageColumns = [
  { className: 'page', maxWidth: '1152px' },
  { className: 'page page--home', maxWidth: '1024px' },
  { className: 'page page--narrow', maxWidth: '544px' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('app-root')).not.toBeEmpty();
});

test('the six Cablan type tokens resolve to the design system sizes', async ({ page }) => {
  const resolved = await page.evaluate(
    (names) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      const result: Record<string, string> = {};
      for (const name of names) {
        probe.style.font = '';
        probe.style.font = `var(--${name})`;
        const style = getComputedStyle(probe);
        result[name] = `${style.fontSize} ${style.fontWeight} ${style.lineHeight}`;
      }
      probe.remove();
      return result;
    },
    typeTokens.map((token) => token.name),
  );

  for (const token of typeTokens) {
    expect(resolved[token.name], token.name).toBe(
      `${token.size} ${token.weight} ${token.lineHeight}`,
    );
  }
});

test('buttons are 40px tall with the 8px control corner', async ({ page }) => {
  const button = page.locator('button[type="submit"]');
  const box = await button.boundingBox();
  const radius = await button.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);

  expect(box?.height).toBe(40);
  expect(radius).toBe('8px');
});

test('outlined fields are 48px tall (density -2) with the 8px control corner', async ({ page }) => {
  const field = page.locator('.mdc-text-field--outlined').first();
  const box = await field.boundingBox();
  const radius = await field.locator('.mdc-notched-outline__leading').evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomLeftRadius,
      style.borderBottomRightRadius,
    ];
  });

  expect(box?.height).toBe(48);
  expect(radius).toContain('8px');
});

test('.stack--hair gaps its children by 4px', async ({ page }) => {
  const gap = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'stack stack--hair';
    probe.append(document.createElement('span'), document.createElement('span'));
    document.body.append(probe);
    const value = getComputedStyle(probe).rowGap;
    probe.remove();
    return value;
  });

  expect(gap).toBe('4px');
});

for (const column of pageColumns) {
  test(`.${column.className.replace(' ', '.')} is capped at ${column.maxWidth}`, async ({
    page,
  }) => {
    const maxWidth = await page.evaluate((className) => {
      const probe = document.createElement('div');
      probe.className = className;
      document.body.append(probe);
      const value = getComputedStyle(probe).maxWidth;
      probe.remove();
      return value;
    }, column.className);

    expect(maxWidth).toBe(column.maxWidth);
  });
}

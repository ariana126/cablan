import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * The design system's colour roles, checked against the running app.
 *
 * `design/tokens.json` is a byte copy of the Cablan design system's token file; the SCSS in
 * `src/styles/` is the source of truth and this file is what it must agree with. Each colour token
 * is resolved the only way a browser can resolve a `light-dark()` pair — by painting it — in both
 * colour schemes, and compared with the value the design system lists for that scheme.
 *
 * This lives in `a11y/` because it needs a real browser (jsdom has no cascade and cannot evaluate
 * `light-dark()`), and it runs in the existing `make lint-accessibility` gate.
 */

interface ColourToken {
  name: string;
  value: Record<'light' | 'dark', string>;
}

const tokensFile = JSON.parse(readFileSync(join(__dirname, '../design/tokens.json'), 'utf8')) as {
  color: { tokens: ColourToken[] };
};

/**
 * Palette values Material emits for its own components' internals. The design system lists them but
 * marks them "do not use in app styles", so they are reported, not asserted.
 */
const materialInternals = new Set(['mat-sys-neutral10', 'mat-sys-neutral-variant20']);

const asserted = tokensFile.color.tokens.filter((token) => !materialInternals.has(token.name));

function toRgb(hex: string): string {
  const digits = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(digits.slice(offset, offset + 2), 16),
  );
  return `rgb(${red}, ${green}, ${blue})`;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every design-system colour token resolves to its listed value (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/login');

    const resolved = await page.evaluate(
      (names) => {
        const probe = document.createElement('div');
        document.body.append(probe);
        const result: Record<string, string> = {};
        for (const name of names) {
          probe.style.color = '';
          probe.style.color = `var(--${name})`;
          result[name] = getComputedStyle(probe).color;
        }
        probe.remove();
        return result;
      },
      asserted.map((token) => token.name),
    );

    const mismatches = asserted
      .filter((token) => resolved[token.name] !== toRgb(token.value[scheme]))
      .map(
        (token) =>
          `  ${token.name}: expected ${toRgb(token.value[scheme])}, got ${resolved[token.name]}`,
      );

    expect(mismatches, `\n${mismatches.join('\n')}\n`).toEqual([]);
  });
}

/**
 * The design-system gate. `make lint-styles` runs this; CI runs the same target.
 *
 * Its job is narrow and worth stating plainly: make it impossible to author a colour, a spacing
 * value, a radius or a type size by hand. Cablan's UI is Angular Material (Material Design 3), so
 * those values already exist as `--mat-sys-*` tokens (and `--cablan-space-*` for spacing, which
 * Material does not ship). A literal is not merely off-style — it is frozen in one colour scheme,
 * so it silently breaks the moment the page renders in the other one.
 *
 * Two holes a CSS linter cannot see, both closed in eslint.config.js instead:
 *   - styles written inline in a `.ts` file  → `@angular-eslint/component-max-inline-declarations`
 *   - a `style="…"` attribute in a template  → `@angular-eslint/template/no-inline-styles`
 * Weakening either one reopens a hole in this gate, not just in ESLint's.
 *
 * The `overrides` block at the bottom is load-bearing: the three files that *define* the tokens are
 * the only place a literal is legal, and without the exemption this config would fail on its own
 * source.
 */
module.exports = {
  extends: ['stylelint-config-standard-scss'],
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: ['dist/**', 'node_modules/**', 'a11y/report/**'],

  rules: {
    // BEM. stylelint-config-standard-scss's default pattern rejects the `--modifier` suffix, and
    // the codebase has used BEM since before this gate existed (`.stack--tight`).
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
      { message: 'Expected class selector to be kebab-case BEM (block__element--modifier)' },
    ],

    'color-no-hex': [
      true,
      {
        message:
          'Use a --mat-sys-* colour token. A hex is frozen in one colour scheme and cannot follow the theme into dark mode.',
      },
    ],
    'color-named': [
      'never',
      { message: 'Use a --mat-sys-* colour token rather than a named colour.' },
    ],

    // The colour functions are banned outright rather than merely discouraged: every one of them
    // produces a literal, and `light-dark()` — the one function that does vary by scheme — is
    // Material's to emit, not ours to call.
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'lab', 'lch'],

    'declaration-no-important': [
      true,
      {
        message:
          '!important overriding Material internals is banned. Use mat.theme-overrides() scoped to a container instead.',
      },
    ],

    // RTL. The app is dir="rtl", so a physical property does not mirror — it just puts the element
    // on the wrong side in Persian. The logical equivalents (margin-inline-start, inset-inline-end,
    // text-align: start) are the same code in both directions.
    'property-disallowed-list': [
      [
        '/^margin-(left|right)$/',
        '/^padding-(left|right)$/',
        '/^border-(left|right)$/',
        'left',
        'right',
        'float',
        'clear',
        'text-align',
      ],
      {
        message:
          'The app is dir="rtl": use the logical property (margin-inline-start, inset-inline-end, text-align: start, …) so the layout mirrors instead of breaking.',
      },
    ],

    // Material's internal class names are implementation detail and are renamed between releases.
    // A component that needs to look different has a documented API or a theme override.
    'selector-disallowed-list': [
      ['/\\.mat-/', '/::ng-deep/', '/\\.cdk-/'],
      {
        message:
          "Reaching into Material's internal class names couples you to markup that changes between releases. Use mat.theme-overrides() or the component's documented API.",
      },
    ],

    // The core rule. Every listed property must take a var(), never a literal.
    //
    // `ignoreValues` is deliberately short. It covers CSS-wide keywords, the values that mean
    // "no box at all" rather than a measurement, and the two unitless numbers (`0`, `1`) that are
    // identical in every design system. Adding a length here would punch a hole straight through
    // the gate — if a value is needed often enough to want an exemption, it wants a token.
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'fill',
        'stroke',
        'background',
        'background-color',
        'box-shadow',
        'border-radius',
        '/^margin/',
        '/^padding/',
        '/gap$/',
        'font',
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'letter-spacing',
      ],
      {
        // No autofix: there is no way to guess *which* token was meant, and a wrong token is worse
        // than a visible error.
        disableFix: true,
        ignoreValues: [
          'inherit',
          'initial',
          'unset',
          'revert',
          'currentColor',
          'transparent',
          'none',
          'auto',
          'normal',
          '0',
          '1',
        ],
        message:
          'Every colour, spacing, radius and type value must be a token: var(--mat-sys-*) for colour, type and shape; var(--cablan-space-*) for spacing. The full list is in .claude/skills/cablan-design-system/SKILL.md.',
      },
    ],
  },

  overrides: [
    {
      // The token definitions themselves. `_theme.scss` calls mat.theme(), `_tokens.scss` declares
      // the spacing scale and `_fonts.scss` the @font-face — all three necessarily hold literals,
      // because they are what every other file's var() resolves to.
      files: ['src/styles/_theme.scss', 'src/styles/_tokens.scss', 'src/styles/_fonts.scss'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        'function-disallowed-list': null,
        'scale-unlimited/declaration-strict-value': null,
      },
    },
  ],
};

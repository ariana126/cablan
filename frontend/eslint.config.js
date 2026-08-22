// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    // The orval-generated API client. `ng lint` sees src/**/*.ts, src/**/*.html and a11y/**/*.ts
    // (angular.json's lintFilePatterns), and there is nothing to fix in code no one hand-edits.
    ignores: ['src/app/api/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Half of the design-system gate. stylelint cannot parse CSS embedded in a .ts file, so
      // styles written inline would dodge every rule in stylelint.config.js — no token check, no
      // RTL check, no !important check. Capping `styles` at zero forces component CSS into a
      // .scss file the gate can actually read.
      //
      // Only `styles` is capped. Inline *templates* stay allowed and are still preferred for
      // small components: `processor: angular.processInlineTemplates` above already lints those,
      // so a template gets the same treatment inline as it would in a file. The rule's own
      // default for `template` is 3 lines, which would quietly impose a policy nobody asked for
      // and which CLAUDE.md contradicts — hence the explicit lift rather than an omission.
      '@angular-eslint/component-max-inline-declarations': [
        'error',
        { styles: 0, template: Infinity, animations: Infinity },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // templateAccessibility covers ARIA validity, labels and alternative text, but not
      // these two. They are the statically checkable slice of focus management: a positive
      // tabindex pulls an element out of DOM order and wrecks the tab sequence, and a button
      // with no type silently submits the form around it. The rest of focus management —
      // focus moved and returned, trapped in a modal, visibly indicated — is a review item;
      // see the accessibility section of CLAUDE.md.
      '@angular-eslint/template/no-positive-tabindex': 'error',
      '@angular-eslint/template/button-has-type': 'error',
      // The other half of the design-system gate. A `style="color: #fff"` attribute is CSS that
      // never reaches a stylesheet, so stylelint never sees it — this is the only place that can
      // catch it. `allowBindToStyle` keeps `[style.width]` legal, which is what CLAUDE.md already
      // prefers over ngStyle; ngStyle itself stays banned, as it is everywhere else here.
      '@angular-eslint/template/no-inline-styles': [
        'error',
        { allowNgStyle: false, allowBindToStyle: true },
      ],
    },
  },
]);

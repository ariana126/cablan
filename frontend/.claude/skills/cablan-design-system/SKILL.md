---
name: cablan-design-system
description: >
  Use when creating or editing ANY file under frontend/ — component, template, stylesheet, route or
  spec — not only when the request mentions design. Cablan's UI is Angular Material 21 (Material
  Design 3) and is closed to improvisation: this skill carries the complete --mat-sys-* and
  --cablan-space-* token lists, the mat-* component to reach for per UI pattern, and the rules
  `make lint-styles` enforces. Trigger on any of: build a page, add a component, styling, CSS, SCSS,
  colour, theme, dark mode, RTL, spacing, padding, margin, border-radius, elevation, shadow, font,
  typography, layout, button, form, input, select, checkbox, dialog, modal, table, list, card, chip,
  tabs, menu, navigation, sidenav, toolbar, snackbar, toast, tooltip, badge, stepper, datepicker —
  or simply "make it look right".
license: MIT
metadata:
  version: '1.0'
---

# Cablan design system

Cablan's frontend is **Angular Material 21, themed with Material Design 3**. Colour, typography,
shape and elevation are already decided and exposed as CSS custom properties. Your job is to
_reference_ them, never to invent a value.

Two rules cover almost everything:

1. **Never write a literal.** No hex, `rgb()`, `oklch()`, named colour, bare `px`/`rem` spacing, or
   arbitrary `border-radius`. Use a token.
2. **Never build what Material already ships.** Check the component table below first.

Both are enforced. `make lint-styles` fails the build on rule 1; the review catches rule 2.

## Before you finish

- [ ] Run `make lint-styles` after touching any `.scss`, and `make lint` after any `.ts`/`.html`.
- [ ] New route? Add its path to `publicRoutes` in `a11y/accessibility.spec.ts` and give the route a
      `title` — nothing else catches either omission.
- [ ] Component CSS is in a `.scss` file, not an inline `styles:` block.

---

## Colour tokens

Every one is a `light-dark()` pair, so a component that uses them needs **no dark-mode rule at all**.
Pair each surface with its matching `on-` token — that pairing is what guarantees contrast.

| Role                         | Token                           | `on-` counterpart                  |
| ---------------------------- | ------------------------------- | ---------------------------------- |
| Page / card surface          | `--mat-sys-surface`             | `--mat-sys-on-surface`             |
| Secondary text on a surface  | —                               | `--mat-sys-on-surface-variant`     |
| Primary action               | `--mat-sys-primary`             | `--mat-sys-on-primary`             |
| Primary, tinted              | `--mat-sys-primary-container`   | `--mat-sys-on-primary-container`   |
| Secondary                    | `--mat-sys-secondary`           | `--mat-sys-on-secondary`           |
| Secondary, tinted            | `--mat-sys-secondary-container` | `--mat-sys-on-secondary-container` |
| Accent                       | `--mat-sys-tertiary`            | `--mat-sys-on-tertiary`            |
| Accent, tinted               | `--mat-sys-tertiary-container`  | `--mat-sys-on-tertiary-container`  |
| Error / danger               | `--mat-sys-error`               | `--mat-sys-on-error`               |
| Error, tinted                | `--mat-sys-error-container`     | `--mat-sys-on-error-container`     |
| Inverted (snackbar, tooltip) | `--mat-sys-inverse-surface`     | `--mat-sys-inverse-on-surface`     |

Elevated / layered surfaces, dimmest to brightest:
`--mat-sys-surface-dim`, `--mat-sys-surface`, `--mat-sys-surface-bright`,
`--mat-sys-surface-container-lowest`, `--mat-sys-surface-container-low`,
`--mat-sys-surface-container`, `--mat-sys-surface-container-high`,
`--mat-sys-surface-container-highest`.

Borders and dividers: `--mat-sys-outline` (a real border), `--mat-sys-outline-variant` (a divider).
Also available: `--mat-sys-scrim` (dialog backdrop), `--mat-sys-shadow`, `--mat-sys-surface-tint`,
`--mat-sys-inverse-primary`, `--mat-sys-background` / `--mat-sys-on-background`, and the
`*-fixed`, `*-fixed-dim`, `on-*-fixed`, `on-*-fixed-variant` variants of primary/secondary/tertiary
(these do **not** change between light and dark — use them only when that is what you want).

There is no "success" colour in M3. For a positive state use `--mat-sys-tertiary-container` with
`--mat-sys-on-tertiary-container`, and never rely on colour alone to carry meaning.

## Typography tokens

Each level has a **shorthand** that sets family, size, weight and line-height together. Prefer it:

```scss
h1 {
  font: var(--mat-sys-headline-medium);
}
```

Levels: `display-large|medium|small`, `headline-large|medium|small`, `title-large|medium|small`,
`body-large|medium|small`, `label-large|medium|small` — each as `--mat-sys-<level>`.

Every level also exposes its parts, for the rare case you need one alone:
`--mat-sys-<level>-font`, `-size`, `-weight`, `-line-height`, `-tracking`
(plus `--mat-sys-label-large-weight-prominent` and `--mat-sys-label-medium-weight-prominent`).

Rough mapping: `display-*` for a hero number or a 404 code; `headline-*` for page titles; `title-*`
for card and section headings; `body-*` for running text; `label-*` for buttons, form labels, chips
and table headers.

The family is **Vazirmatn** — Persian, self-hosted, one variable file covering weights 100–900.
Never name a font family directly; the token carries it.

## Shape (radius) tokens

`--mat-sys-corner-none` (0), `-extra-small` (4px), `-small` (8px), `-medium` (12px), `-large` (16px),
`-extra-large` (28px), `-full` (9999px, a pill).

Plus one-sided variants for sheets and attached surfaces: `-extra-small-top`, `-large-top`,
`-large-start`, `-large-end`, `-extra-large-top`.

## Elevation tokens

`--mat-sys-level0` through `--mat-sys-level5`, used as a `box-shadow` value. Level 1 for a resting
card, 3 for a menu or a raised surface, 5 for a modal.

## Spacing tokens — Cablan's, not Material's

**Material ships no spacing scale.** These are ours, defined in `src/styles/_tokens.scss`, on a 4px
grid so they compose with Material's own internal spacing.

`--cablan-space-0` (0), `-1` (4px), `-2` (8px), `-3` (12px), `-4` (16px), `-6` (24px), `-8` (32px),
`-12` (48px), `-16` (64px).

The gaps in the sequence are deliberate — the scale is not "any multiple of 4".

Also: `--cablan-measure` (34rem, the max width for a column of running text) and the motion tokens
`--cablan-duration-fast`, `--cablan-duration-base`, `--cablan-ease`.

## State-layer opacities

`--mat-sys-hover-state-layer-opacity`, `-focus-`, `-pressed-`, `-dragged-state-layer-opacity`. Use
these if you build an interactive surface Material has no component for; Material's own components
apply them already.

---

## Use the Material component, not your own

Building a custom version of anything in this table is a design-system violation. If you are asked
for one of these and build it by hand, you have made the wrong call.

| Pattern                              | Component                                                   | Import from                                       |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------- |
| Button                               | `matButton` (`text`/`filled`/`elevated`/`outlined`/`tonal`) | `@angular/material/button`                        |
| Icon button, FAB                     | `matIconButton`, `matFab`, `matMiniFab`                     | `@angular/material/button`                        |
| Text input, textarea, select wrapper | `mat-form-field` + `matInput`                               | `@angular/material/form-field`, `/input`          |
| Dropdown                             | `mat-select`                                                | `@angular/material/select`                        |
| Typeahead                            | `mat-autocomplete`                                          | `@angular/material/autocomplete`                  |
| Checkbox / radio / switch            | `mat-checkbox`, `mat-radio-group`, `mat-slide-toggle`       | `@angular/material/{checkbox,radio,slide-toggle}` |
| Date picker                          | `mat-datepicker`                                            | `@angular/material/datepicker`                    |
| Slider                               | `mat-slider`                                                | `@angular/material/slider`                        |
| Card / panel                         | `mat-card`                                                  | `@angular/material/card`                          |
| Data table (+ sorting, paging)       | `mat-table`, `matSort`, `mat-paginator`                     | `@angular/material/{table,sort,paginator}`        |
| List                                 | `mat-list`, `mat-nav-list`, `mat-selection-list`            | `@angular/material/list`                          |
| Tree                                 | `mat-tree`                                                  | `@angular/material/tree`                          |
| Modal dialog                         | `MatDialog`                                                 | `@angular/material/dialog`                        |
| Mobile action sheet                  | `MatBottomSheet`                                            | `@angular/material/bottom-sheet`                  |
| Transient confirmation               | `MatSnackBar`                                               | `@angular/material/snack-bar`                     |
| Tooltip                              | `matTooltip`                                                | `@angular/material/tooltip`                       |
| Tabs                                 | `mat-tab-group`                                             | `@angular/material/tabs`                          |
| Menu                                 | `mat-menu`                                                  | `@angular/material/menu`                          |
| App bar                              | `mat-toolbar`                                               | `@angular/material/toolbar`                       |
| Side navigation                      | `mat-sidenav-container`                                     | `@angular/material/sidenav`                       |
| Chips / tags                         | `mat-chip-set`, `mat-chip-listbox`                          | `@angular/material/chips`                         |
| Accordion                            | `mat-accordion`, `mat-expansion-panel`                      | `@angular/material/expansion`                     |
| Multi-step flow                      | `mat-stepper`                                               | `@angular/material/stepper`                       |
| Loading                              | `mat-progress-bar`, `mat-progress-spinner`                  | `@angular/material/progress-{bar,spinner}`        |
| Count / status dot                   | `matBadge`                                                  | `@angular/material/badge`                         |
| Divider                              | `mat-divider`                                               | `@angular/material/divider`                       |
| Icon                                 | `mat-icon`                                                  | `@angular/material/icon`                          |

Components are standalone — import the symbol into the component's `imports` array, not a module.

**When there is genuinely no Material equivalent** (a domain-specific BOM tree view, a chart), build
it — and **say so explicitly in your response**: name the pattern, state that Material has nothing
for it, and confirm you used only tokens. Do not build one silently.

## Usage guidance

- **Form fields:** `appearance="outline"` is the house default (the only alternatives are `fill` and
  `outline`). Always give a `<mat-label>` — the acceptance suite locates fields by label text and
  `make lint-accessibility` fails without one. Put validation messages in `<mat-error>`, hints in
  `<mat-hint>`; do not hand-roll either.
- **Dialog vs bottom sheet:** `MatDialog` for a decision that blocks the task (confirm a delete, edit
  a record). `MatBottomSheet` for a list of actions on a touch target. Never a hand-built overlay —
  the CDK versions handle focus trapping, Escape and scroll blocking, which is most of the work.
- **Snackbar vs dialog:** `MatSnackBar` for "saved" — transient, dismissible, does not interrupt.
  A dialog for anything the user must acknowledge.
- **Buttons:** one `filled` button per view (the primary action); `outlined` for secondary;
  `text` for tertiary or in-card actions. `elevated` and `tonal` are rare — have a reason.
- **Tables:** `mat-table` with `matSort` and `mat-paginator`. Do not build a `<table>` by hand and
  style it.
- **Forms** use **Signal Forms** (`@angular/forms/signals`), never `FormControl`/`FormGroup`. See
  `frontend/CLAUDE.md`.

---

## Gotchas

These defy reasonable assumptions. Read them before you write, not after the gate fails.

- **Component styles must live in an external `.scss` file.** An inline `styles:` block is an ESLint
  error (`component-max-inline-declarations`), because stylelint cannot parse CSS inside a `.ts`
  file and every token rule would silently not apply. Inline **templates** are still fine and still
  preferred for small components — it is only styles that must move out.
- **`style="…"` attributes in templates are an ESLint error** too, for the same reason. `[style.x]`
  bindings are allowed; `ngStyle` is not.
- **The app is `dir="rtl"`.** Physical properties are a stylelint error: use `margin-inline-start`,
  `padding-inline`, `inset-inline-start`, `text-align: start`. Set once on `<html>` in `index.html`
  — never per-component, and never a `[dir]` binding.
- **Never `!important`, never `::ng-deep`, never a `.mat-*` or `.cdk-*` selector.** All three are
  stylelint errors. To restyle a Material component, use `mat.theme-overrides()` scoped to a
  container, or the component's own documented API.
- **The vendored `angular-developer` skill recommends Tailwind** (`references/tailwind-css.md`), and
  `angular-new-app` says to run `ng add tailwindcss`. **That guidance does not apply to Cablan** —
  this skill overrides it. There is no Tailwind here and none is wanted.
- **Do not use `mat.define-theme()`.** It was the v17/v18 experimental M3 API, removed in v19, and it
  never emitted `--mat-sys-*`. The theme is one `mat.theme()` call in `src/styles/_theme.scss`.
- **Do not add a second theme for dark mode.** `color-scheme: light dark` makes every colour token a
  `light-dark()` pair already. If you find yourself writing `@media (prefers-color-scheme: dark)`,
  you have used a literal somewhere upstream.
- **The three token-definition files** (`_theme.scss`, `_tokens.scss`, `_fonts.scss`) are the only
  place a literal is legal, and stylelint exempts them by path. Do not add a fourth exemption —
  add a token instead.
- **`make lint-accessibility` grades every route twice, once per colour scheme.** A colour that only
  works in light mode fails the build. This is the main reason the `*-fixed` tokens are a trap: they
  do not change between schemes, so dark text picked from one stays dark on a dark surface.
- **Every `ng` command runs in Docker**: `docker compose run --rm app npx ng …`, or the Make target.
  There is no host toolchain.

## Worked example

```ts
// features/thing/thing-page.ts
@Component({
  selector: 'app-thing-page',
  imports: [MatFormField, MatLabel, MatInput, MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="thing stack">
      <mat-form-field appearance="outline">
        <mat-label>نام قطعه</mat-label>
        <input matInput [control]="form.name" />
      </mat-form-field>
      <button matButton="filled" type="submit">ثبت</button>
    </form>
  `,
  styleUrl: './thing-page.scss',
})
```

```scss
/* features/thing/thing-page.scss */
.thing {
  max-width: var(--cablan-measure);
  padding: var(--cablan-space-6);
  border-radius: var(--mat-sys-corner-large);
  background-color: var(--mat-sys-surface-container);
  box-shadow: var(--mat-sys-level1);
}
```

No colour, no size, no radius, no spacing authored by hand — and nothing about dark mode, because
there is nothing to say.

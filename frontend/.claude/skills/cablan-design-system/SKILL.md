---
name: cablan-design-system
description: >
  Use when creating or editing ANY file under frontend/ — component, template, stylesheet, route or
  spec — not only when the request mentions design. Cablan's UI is Angular Material 21 (Material
  Design 3) and is closed to improvisation: this skill carries the complete --mat-sys-* and
  --cablan-* token lists, the mat-* component to reach for per UI pattern, and the rules
  `make lint-styles` enforces. Trigger on any of: build a page, add a component, styling, CSS, SCSS,
  colour, theme, dark mode, RTL, spacing, padding, margin, border-radius, elevation, shadow, font,
  typography, layout, button, form, input, select, checkbox, dialog, modal, table, list, card, chip,
  tabs, menu, navigation, sidenav, toolbar, snackbar, toast, tooltip, badge, stepper, datepicker —
  or simply "make it look right".
license: MIT
metadata:
  version: '2.0'
---

# Cablan design system (v2)

Cablan is a Persian, right-to-left ERP for a cable factory. It is used on the shop floor and in the
office, often on shared screens and in long sessions, so it favours calm surfaces, high contrast
and numbers that line up. The frontend is **Angular Material 21, themed with Material Design 3**.
Colour, typography, shape and elevation are already decided and exposed as CSS custom properties.
Your job is to _reference_ them, never to invent a value.

Two rules cover almost everything:

1. **Never write a literal.** No hex, `rgb()`, `oklch()`, named colour, bare `px`/`rem` spacing, or
   arbitrary `border-radius`. Use a token.
2. **Never build what Material already ships.** Check the component table below first.

Both are enforced. `make lint-styles` fails the build on rule 1; the review catches rule 2.

The design system itself (the brand book, the token file and one card per pattern) is the Claude
Design project _Cablan Design System 2_. `frontend/design/tokens.json` is a byte copy of its token
file, and `a11y/design-tokens.spec.ts` fails if the running app and that file disagree.

## Before you finish

- [ ] Run `make lint-styles` after touching any `.scss`, and `make lint` after any `.ts`/`.html`.
- [ ] New route? Add its path to `publicRoutes` or `authenticatedRoutes` in
      `a11y/accessibility.spec.ts` and give the route a `title` — nothing else catches either
      omission.
- [ ] Component CSS is in a `.scss` file, not an inline `styles:` block.
- [ ] Looked at in **both** colour schemes. A colour that passes in light can fail in dark.

---

## Colour tokens

Every one is a `light-dark()` pair, so a component that uses them needs **no dark-mode rule at all**.
Always pair a fill with its matching `on-` token — that pairing is what guarantees contrast.

The brand is green, and green is spent on _doing_: one filled button per view, links, selection and
the focus ring. **Do not paint headers, cards or the toolbar green.**

| Role                                    | Token                           | `on-` counterpart                  |
| --------------------------------------- | ------------------------------- | ---------------------------------- |
| Page                                    | `--mat-sys-surface`             | `--mat-sys-on-surface`             |
| Secondary text on a surface             | —                               | `--mat-sys-on-surface-variant`     |
| Primary action, links, focus            | `--mat-sys-primary`             | `--mat-sys-on-primary`             |
| Positive state, avatar, tile            | `--mat-sys-primary-container`   | `--mat-sys-on-primary-container`   |
| Active navigation, active filter        | `--mat-sys-secondary-container` | `--mat-sys-on-secondary-container` |
| Accent (copper)                         | `--mat-sys-tertiary`            | `--mat-sys-on-tertiary`            |
| Attention that is not an error          | `--mat-sys-tertiary-container`  | `--mat-sys-on-tertiary-container`  |
| Error / danger                          | `--mat-sys-error`               | `--mat-sys-on-error`               |
| Error banner, below standard            | `--mat-sys-error-container`     | `--mat-sys-on-error-container`     |
| Inverted (snackbar, tooltip, skip link) | `--mat-sys-inverse-surface`     | `--mat-sys-inverse-on-surface`     |

**Layering goes by tone and a hairline, never by shadow.** From the page up: the page is
`--mat-sys-surface`; containers (the data sheet, cards, panels), dialogs, menus and the toolbar sit
on `--mat-sys-surface-container-lowest` with a 1px `--mat-sys-outline-variant` frame; secondary
bands (the drawer, the filter bar, table headers, dialog footers, the active-filter strip, row
hover) on `--mat-sys-surface-container-low`; hover fills and tags on `-container-high`; the presets
track on `-container-highest`. `--mat-sys-surface-container` is the middle step. Also available:
`--mat-sys-surface-dim`, `-surface-bright`, `-surface-variant`.

Borders: `--mat-sys-outline` for an input's border (it must hold 3:1), `--mat-sys-outline-variant`
for container frames, table rules, dividers and outlined buttons. Also available:
`--mat-sys-scrim`, `--mat-sys-shadow`, `--mat-sys-surface-tint`, `--mat-sys-inverse-primary` (an
action on an inverse surface), `--mat-sys-background` / `--mat-sys-on-background`.

**Avoid the `*-fixed`, `*-fixed-dim`, `on-*-fixed` and `on-*-fixed-variant` tokens.** They do not
change between colour schemes, so text picked from one stays dark on a dark surface. That is how a
route fails the dark half of the contrast audit.

**State is never colour alone.** Positive is `--mat-sys-primary-container` with an up arrow or a
check; below standard is `--mat-sys-error-container` with a down arrow; attention is
`--mat-sys-tertiary-container`. Always pair with an icon and a word.

`--cablan-success` is the passed-check icon colour. It is the same green as `--mat-sys-primary` by
design: with a green brand, success is told apart by its icon and words, not its hue. Borders and
icons only; it has no `on-` text colour.

**Brand and data colours** (the same in both schemes, defined in `_theme.scss`):
`--cablan-brand-green` and `--cablan-brand-ink` are the logo's exact values, for brand moments only
(never text or controls: the green is 3.4:1 on white). `--cablan-logo-plate` is the white plate
behind the raster logo, which has no dark version. `--cablan-core-brown|black|grey|blue|green|yellow`
and `--cablan-material-copper|aluminium` are physical colours for conductor swatches: data, never
status, text or background. A swatch is 12px, round, ringed in `--mat-sys-outline`, and always
followed by its name.

## Typography tokens

Cablan's own titles lead with **weight, not size**. Each is a `font` shorthand:

```scss
h1 {
  font: var(--cablan-page-title);
}
```

| Token                    | Size / weight | Use                                                     |
| ------------------------ | ------------- | ------------------------------------------------------- |
| `--cablan-page-title`    | 24px / 700    | every page `h1`                                         |
| `--cablan-section-title` | 18px / 600    | section `h2`, the data sheet title, dialog titles       |
| `--cablan-card-title`    | 16px / 600    | card, panel and data-sheet titles, the calendar's month |
| `--cablan-table-header`  | 13px / 600    | table headers, key-fact labels, stacked filter labels   |
| `--cablan-data`          | 14px / 400    | table cells and values                                  |
| `--cablan-meta`          | 12px / 500    | result counts, breadcrumbs, a user's role, tags, badges |

The two muted styles (`table-header`, `meta`) carry no colour: set `color:
var(--mat-sys-on-surface-variant)` yourself. Quantities add `font-variant-numeric: tabular-nums`.

Material's 15-step scale still types everything Material renders itself, and running text:
`font: var(--mat-sys-body-medium)` (the `body` default), `--mat-sys-label-large` for buttons (weight
600 through the button overrides). `--mat-sys-headline-*` and `--mat-sys-display-*` are no longer
used by any screen. Keep running text within `--cablan-measure` (34rem).

The family is **Vazirmatn** — Persian, self-hosted, one variable file covering weights 100–900. Never
name a font family directly; the tokens carry it.

## Shape (radius) tokens — corners follow role

A shape tells you what a thing _is_:

- `--mat-sys-corner-full`: **a state.** Status pills, filter buttons and chips, badges, avatars.
- `--mat-sys-corner-small` (8px): **a control.** Buttons, fields, nav items, menu options, icon tiles.
  Buttons are not pills.
- `--mat-sys-corner-medium` (12px): **a container.** The data sheet, cards, panels, the filter bar,
  banners, the calendar.
- `--mat-sys-corner-large` (16px): **an overlay or a standalone surface.** Dialogs and the login
  card.
- `--mat-sys-corner-extra-small` (4px): tooltips, tags, the focus ring.
- `--mat-sys-corner-none` (0) for table cells and dividers. `--mat-sys-corner-extra-large` is not used.

One-sided variants for attached surfaces: `-extra-small-top`, `-large-top`, `-large-start`,
`-large-end`, `-extra-large-top`.

## Elevation tokens

**Shadows are only for things that float over the page**: `--mat-sys-level2` for menus,
autocomplete panels and the calendar, `--mat-sys-level3` for dialogs and snackbars (level 3 also
for the phone drawer). Everything on the page is separated by tone and a hairline instead — a
container is `padding: var(--cablan-space-4); border: 1px solid var(--mat-sys-outline-variant);
border-radius: var(--mat-sys-corner-medium); background: var(--mat-sys-surface-container-lowest)`.

## Spacing, layout and density — Cablan's, not Material's

**Material ships no spacing scale.** These are ours, defined in `src/styles/_tokens.scss`, on a 4px
grid so they compose with Material's own internal spacing.

`--cablan-space-0` (0), `-1` (4px), `-2` (8px), `-3` (12px), `-4` (16px), `-6` (24px), `-8` (32px),
`-12` (48px), `-16` (64px). The gaps are deliberate — the scale is not "any multiple of 4".

Also: `--cablan-measure` (34rem), `--cablan-page-width` (72rem), `--cablan-page-width-home` (64rem) and
the motion tokens `--cablan-duration-fast` (120ms), `--cablan-duration-base` (200ms),
`--cablan-ease`; both durations are `0ms` under `prefers-reduced-motion`.

Layout classes (in `_layout.scss`): `.stack` (vertical, gap `-6`), `.stack--tight` (`-3`),
`.stack--hair` (`-1`, a title over its description), and the page column `.page` (72rem, for list,
report and dashboard pages), `.page--home` (64rem), `.page--narrow` (`--cablan-measure`, the
not-found page). The gap belongs to the parent, so children carry no margins.

**Density:** Cablan runs at Material density -2. Fields are 48px; buttons and nav items 40px;
small buttons, filter buttons and in-row icon buttons 32px; table headers 44px and rows 48px (dense
tables inside panels and dialogs: 36px and 40px). These come from the overrides in
`src/styles/_overrides.scss`, scoped to `:root` — change them there, never per component.

## State-layer opacities and focus

`--mat-sys-hover-state-layer-opacity` (0.08), `-focus-` (0.12), `-pressed-` (0.12), `-dragged-`
(0.16): use these for an interactive surface Material has no component for. The **global focus
ring** (`_a11y.scss`) is `--mat-sys-primary`, 4px, offset 4px, on every link, button, input and
`[tabindex]`. Never `outline: none` without a `:focus-visible` replacement.

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
| Card / panel                         | `mat-card appearance="outlined"`                            | `@angular/material/card`                          |
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
| Icon                                 | `mat-icon` with an inline `<svg>` (see Icons)               | `@angular/material/icon`                          |

Components are standalone — import the symbol into the component's `imports` array, not a module.

**When there is genuinely no Material equivalent** (a domain-specific BOM tree view, a chart), build
it — and **say so explicitly in your response**: name the pattern, state that Material has nothing
for it, and confirm you used only tokens. Do not build one silently.

To restyle a Material component, use its `mat.*-overrides` mixin in `_overrides.scss`, scoped to
`:root` (or to a class, as `.danger` does for the destructive button). Never a `.mat-*` selector.

## Icons

**Inline SVG inside `mat-icon`**, never the ligature form: there is no icon font, so a ligature
renders as its literal word. Line icons on a `0 0 24 24` viewBox with `fill="none"`,
`stroke="currentColor"`, `stroke-width="2"` and round caps and joins, so they follow their
container's text colour in both schemes. Icons that read the same in both directions (menu, up/down
chevrons) need no mirroring; a directional one (back, next) must mirror with the document direction.
Icon buttons keep a full touch target (40px; 32px with a 16px glyph for a quiet in-row action). No
emoji.

## Usage guidance

- **Form fields:** `appearance="outline"` at density -2 is the house default. Always give a
  `<mat-label>` — the acceptance suite locates fields by label text and `make lint-accessibility`
  fails without one. Required labels end in a `--mat-sys-error` asterisk. Put validation messages in
  `<mat-error>`, hints in `<mat-hint>`; do not hand-roll either. Inside the filter bar a label is
  stacked above its field.
- **Dialog vs bottom sheet:** `MatDialog` for a decision that blocks the task (confirm a delete, edit
  a record). `MatBottomSheet` for a list of actions on a touch target. Never a hand-built overlay —
  the CDK versions handle focus trapping, Escape and scroll blocking, which is most of the work.
  Dialog widths: 28rem (confirm), 32rem (form), 34rem (detail). Actions are end-aligned with the
  dismiss action first («انصراف»), then at most one filled action whose label names the result.
  The confirm button of an irreversible delete is the one filled `--mat-sys-error` button in the
  app (the `.danger` class); everywhere else a delete is a text action or a menu item in
  `--mat-sys-error`.
- **Snackbar vs dialog:** `MatSnackBar` for "saved" — transient, dismissible, does not interrupt.
  A dialog for anything the user must acknowledge.
- **Buttons:** one `filled` button per view (the primary action, with a leading icon when it
  creates); `outlined` for secondary; `text` for tertiary, in rows and dialog footers; `tonal` only
  for an active filter. `elevated` is not used.
- **Chips:** `mat-chip-set` / `mat-chip-listbox`, never clickable `mat-chip` actions (use buttons in
  a `role="group"`).
- **Tables:** `mat-table` with `matSort` and `mat-paginator`, inside one framed **data sheet**. Do
  not build a `<table>` by hand and style it, and never float a table, its filters and its paginator
  as separate pieces. Quantities are tabular and end-aligned with the unit in the column header
  («وزن (کیلوگرم)»); identifiers keep Latin digits.
- **Page header:** every page opens with the `--cablan-page-title` `h1`, a one-line description
  under it, and actions at the end (secondaries first, the one filled action last). The breadcrumb
  lives in the toolbar, not the page.
- **Forms** use **Signal Forms** (`@angular/forms/signals`), never `FormControl`/`FormGroup`. See
  `frontend/CLAUDE.md`.

## Content fundamentals that reach code

- **Persian, RTL, everywhere.** Voice is plain, operational, short. Buttons are verbs or nouns of
  action («ذخیره»، «ثبت»). Field errors read «{field} را وارد کنید.» (text) or «{field} را انتخاب
  کنید.» (a picker); an empty list reads «هیچ {record}ی یافت نشد.». No exclamation marks, no emoji.
- **Numbers:** quantities a person reads (weights, lengths, counts) use Persian-Indic digits with
  Persian grouping (`persianNumber` pipe); identifiers (order numbers, MI codes, record ids) keep
  Latin digits. A Jalali date swaps digits but is never regrouped.
- **Every control has a visible label**, unique on its page. An accessible name never contains
  another field's label as a substring, because fields are located by their label text.
- The brand name in UI copy is «کابلان». The Latin "CABLAN" appears only in the logo artwork.

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
  stylelint errors. To restyle a Material component, use its `mat.*-overrides` mixin (see above), or
  the component's own documented API.
- **The vendored `angular-developer` skill recommends Tailwind** (`references/tailwind-css.md`), and
  `angular-new-app` says to run `ng add tailwindcss`. **That guidance does not apply to Cablan** —
  this skill overrides it. There is no Tailwind here and none is wanted.
- **Do not use `mat.define-theme()`.** It was the v17/v18 experimental M3 API, removed in v19, and it
  never emitted `--mat-sys-*`. The theme is one `mat.theme()` call in `src/styles/_theme.scss`, fed
  by tonal palettes defined at the top of that file.
- **Do not add a second theme for dark mode.** `color-scheme: light dark` makes every colour token a
  `light-dark()` pair already. If you find yourself writing `@media (prefers-color-scheme: dark)`,
  you have used a literal somewhere upstream.
- **The three token-definition files** (`_theme.scss`, `_tokens.scss`, `_fonts.scss`) are the only
  place a literal is legal, and stylelint exempts them by path. Do not add a fourth exemption —
  add a token. (`_overrides.scss` holds Material's own component dimensions as mixin arguments, which
  are not declarations, so it needs no exemption.)
- **Do not hand-edit a colour in `_theme.scss`.** The palettes are the design system's; change them
  by re-syncing `design/tokens.json` from the design system. `a11y/design-tokens.spec.ts` fails if
  the app disagrees with the file.
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
        <input matInput [formField]="form.name" />
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
  border: 1px solid var(--mat-sys-outline-variant);
  border-radius: var(--mat-sys-corner-medium);
  background-color: var(--mat-sys-surface-container-lowest);
}
```

No colour, no size, no radius, no spacing authored by hand, no shadow — and nothing about dark mode,
because there is nothing to say.

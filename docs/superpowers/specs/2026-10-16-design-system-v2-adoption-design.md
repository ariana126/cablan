# Design: adopt Cablan Design System 2 in the frontend

- **Date:** 2026-10-16
- **Source of truth:** the *Cablan Design System 2* artifact on claude.ai
  (`https://claude.ai/artifact/3bxxGL9w9ZrWQJ3u7U2ne1`). Its `project/README.md` is the brand book,
  `project/tokens.json` the token values, `project/components/<Name>/{README.md,preview.html}` one
  card per pattern, `project/previews/static-material.css` the stylesheet the cards share.
- **Reference mockup:** *Cablan UI 2* (`https://claude.ai/artifact/SjmvwQiohyRajV6qY6rrRQ`), the
  redesign the design system was updated for, shared with stakeholders. It is a visual reference,
  not a deliverable.
- **Kind:** frontend-only migration of every page and element to the design system. No API or
  backend change. Where a card specifies a behaviour the screen lacks (in-bar search, phone
  drawer), that frontend behaviour is part of the work.

## Intent

The design system was revised (v2) and the running app still renders v1: azure primary, violet
tertiary, pill buttons, 56px fields, headline-weight titles, shadows between surfaces, no data sheet.
The task is to make the frontend match v2 and to keep the repository's own design-system
documentation (the `cablan-design-system` skill, `frontend/CLAUDE.md`) telling the same story, so
the next person to touch the UI reads v2, not v1.

## Goals

1. `src/styles/` and the Material overrides produce v2: palette, type, shape, surfaces, density.
2. **Nothing is excluded.** Every page, every dialog, every shared `ui/` component and every card
   in the design system is implemented or restyled, so the whole app follows one design system and
   one set of standards.
3. The skill and `frontend/CLAUDE.md` describe v2.
4. The assets v2 adds are adopted where they have a place (see Assets).
5. `make run-guardrails` is green, which includes axe in both colour schemes on the new palette.

## Non-goals

- Backend, API contract, routes, Gherkin, or acceptance-test changes. A card that needs data the
  API does not return is reported to the user, not worked around by changing the backend here. In particular, the earlier
  materials/components-into-products merge was backend-only; the frontend `materials` and
  `components` pages stay as features and are restyled like every other page.
- A generator that writes our SCSS from `tokens.json` (see Decisions).
- Changing copy, Persian wording, or information architecture.

## Anti-goals

Things that make this a failure even if it technically ships:

- A literal colour, length, radius or type size authored outside `_theme.scss`, `_tokens.scss`,
  `_fonts.scss`. `make lint-styles` stays as strict as it is.
- A fork of the palette: values in the app that disagree with `tokens.json`.
- Light mode correct and dark mode broken, or the reverse.
- Hand-built replacements for anything Material ships. Restyling goes through the
  `mat.*-overrides` mixins, never `::ng-deep`, `.mat-*` selectors or `!important`.
- Leaving any page, dialog or component on v1 "for now", or silently dropping a v2 card because it
  was inconvenient. The finished app has one look. If a card cannot be met as written (for example
  it needs data the API does not return), the builder stops and reports it; it is not skipped.

## Decisions

Made by the user:

- **Scope is the whole system, nothing excluded:** foundations, every existing screen and shared
  component, and every card in the design system, including the ones the design system calls new
  in v2 (Stat tile, Status badge, short ID tag, in-bar search, phone drawer) and the proposed
  Conductor colours.
- **Adopt what the design system gives us**, including `tokens.json` if it benefits the project.

Made by the orchestrator (the user can overturn these):

- **`tokens.json` is the target the app is verified against, not a build input.** `_theme.scss` has
  to remain a real `mat.theme()` call, because Material derives hundreds of internal values from
  palettes, not from a flat list of roles. Generating SCSS from the file would still need a palette
  underneath it. So the primary (#09a217) and tertiary (copper #b87333) palettes are generated with
  Material's own theme-color schematic, with a warm neutral ramp from the logo ink (#221815), and
  then checked against the file: every `--mat-sys-*` colour the file lists must compute to the
  listed value, light and dark. A copy of `tokens.json` is committed so the check has something to
  read and the next sync has something to diff.
- **One source of truth stays the SCSS.** The artifact is a mirror of it, as its own `meta.source`
  says (it was captured from this repo at `main@0662ce3`).
- **The README is the spec for behaviour the file cannot carry**: type styles are in the file, but
  the motion tokens, the one-sided corners, the density and the `mat.*-overrides` list are README
  only.
- **The builders read an exported copy, not the artifact.** The `frontend-engineer` agent has no
  Artifact tool. Before any work starts, the orchestrator exports the design system's `project/`
  files (README, `tokens.json`, every component README and preview, `previews/static-material.css`)
  into one local folder outside the repo (the session scratchpad) and names that folder in each
  agent's prompt. The export is of the version this document pins; if the live artifact has moved,
  the orchestrator re-exports once, before Foundations, and records the new version here.
- **`tokens.json` wins over the generator.** Try the schematic first. If its output does not
  reproduce the file's role values, hand-author the palette maps from the file and pass them to
  `mat.theme()` as custom palettes, and say so in `_theme.scss` and the skill. This replaces the
  current "do not hand-roll a palette" rule, deliberately: the file is the design owner's target.
  Secondary is a low-chroma tonal variant of the primary hue (the file's `#556251` family), not a
  separate hue.
- **Card rules apply to every screen, uniformly.** Row actions, dialog heads and footers follow the
  cards everywhere, so the app has one pattern. The one limit: when applying a rule would change an
  accessible name or role the acceptance suite relies on, the builder lists each such case and the
  orchestrator takes it to the user before it is changed. Nothing is skipped silently and nothing is
  changed silently.
- **No new copy.** The page header's description line uses text the screen or the mockup already
  has; where neither does, the line is omitted and listed as a follow-up for the product owner to
  supply Persian wording. Nobody invents it.

## Current state

- Theme: one `mat.theme()` call in `src/styles/_theme.scss`; `color: (primary: azure, tertiary:
  violet)`, `typography: Vazirmatn`, `density: 0`, plus `--cablan-success` from Material's green
  palette.
- Six partials: `_fonts`, `_theme`, `_tokens` (spacing, measure, motion), `_reset`, `_a11y` (focus
  ring, skip link, `.visually-hidden`), `_layout` (`.stack`, `.stack--tight`). `styles.scss` only
  `@use`s them; it holds no Material overrides today.
- Gate: `stylelint.config.js` exempts exactly the three token-definition files and bans literals
  elsewhere. `eslint.config.js` bans inline `styles:` and `style="…"`.
- Screens in `src/app/features/`: `home`, `login`, `not-found`, `boms`, `standard-boms`,
  `products`, `materials`, `components`, `users`, `audit-log`, `bom-dashboard`. Most are a page plus
  form, detail, filter and confirm-delete dialogs, each with its own `.scss`.
- Shared in `src/app/ui/`: `app-shell`, `checkbox-filter-list`, `copy-id-button`,
  `date-range-presets`, `jalali-datetime-field`, `password-visibility-toggle`, `persian-number`,
  `searchable-select`.
- `frontend/CLAUDE.md` still says `features/` holds only `not-found/`. That is stale and is
  corrected as part of the docs work.
- Assets: `public/logo.jpeg`, `public/fonts/vazirmatn-variable.woff2`,
  `public/fonts/Vazirmatn-OFL.txt`.

## 1. Foundations

Owner: one `frontend-engineer`, done before any screen work, because everything below reads it.

**Palette.** Replace the azure/violet seeds in `_theme.scss` with generated green (primary and
secondary) and copper (tertiary) palettes and the warm neutral ramp. Keep one theme with
`color-scheme: light dark`; do not add a second theme or a `prefers-color-scheme` rule. Error stays
Material's red. Acceptance: computed values match `tokens.json` in both schemes (a mismatch on a
`*-fixed` or `neutral*` token that Material emits for its own internals is reported, not forced).

**Physical colours** (`cablan-brand-green`, `cablan-brand-ink`, `cablan-logo-plate`,
`cablan-core-*`, `cablan-material-*`) are the same in both schemes and are defined as custom
properties in `_theme.scss`, the file where literals are legal. `cablan-success` becomes the
passed-check icon colour (same green as primary), and the skill says so.

**Type.** Add the six Cablan styles as tokens: `cablan-page-title` (24px/700), `cablan-section-title`
(18px/600), `cablan-card-title` (16px/600), `cablan-table-header` (13px/600, muted),
`cablan-data` (14px/400, tabular figures for quantities), `cablan-meta` (12px/500, muted). How they
are expressed (a shorthand custom property per style, as `--mat-sys-*` does) is the builder's call,
provided components consume them like any other token and stylelint's type rule accepts them.
`body` stays `mat-sys-body-medium`; button labels are weight 600 through `mat.button-overrides`;
`headline-*` and `display-*` stop being used by any screen.

**Shape, surface, elevation.** Corners by role: full = state, small = control, medium = container,
large = overlay or standalone surface, extra-small = tooltips, tags, focus ring. Containers sit on
`surface-container-lowest` with a 1px `outline-variant` frame; secondary bands on
`surface-container-low`. Shadows only for floating things: level 2 menus, autocomplete and
calendar; level 3 dialogs and snackbars.

**Density and overrides**, scoped to `:root` in `styles.scss` (or a partial it `@use`s):
`mat.button-overrides`, `mat.form-field-density(-2)` and `mat.form-field-overrides`,
`mat.dialog-overrides`, `mat.table-overrides` (44px header, 48px rows), `mat.paginator-overrides`,
`mat.toolbar-overrides` (56px), `mat.sidenav-overrides`, `mat.list-overrides` (small, 40px),
`mat.card-overrides`, `mat.autocomplete-overrides`, `mat.menu-overrides`,
`mat.datepicker-overrides`. Each card's README names the ones it needs; the README's last section is
the full list.

**Layout primitives.** Add `.stack--hair` (gap `cablan-space-1`). Add the page-width rules: 72rem
for list, report and dashboard pages, 64rem for home, `cablan-measure` for not-found.

**Existing partials.** `_a11y.scss` already matches the README's focus ring and skip link; keep it.
`_fonts.scss` is unchanged unless the font file differs (see Assets).

## 2. Screens

Owner: `frontend-engineer`s, in parallel by feature after Foundations lands. Every screen follows
its card (`README.md` for rules, `preview.html` for the picture) and the mockup for composition.

| Card | Applies to |
| --- | --- |
| App shell | `ui/app-shell` (toolbar with the «کابلان» wordmark at 800, drawer, breadcrumb in the toolbar) |
| Home / Nav card | `features/home` |
| Login page | `features/login` (card on its own ground, logo on `cablan-logo-plate`) |
| Not-found page | `features/not-found` |
| Report page (page header, data sheet, filter bar, active-filter chips, table, paginator) | `boms`, `standard-boms`, `products`, `materials`, `components`, `users`, `audit-log` |
| Dashboard page, Weight difference | `features/bom-dashboard` |
| **Stat tile** (new in v2) | the dashboard's summary figures; any other screen that shows a headline figure with a label |
| **Status badge** (new in v2) | every place a screen shows a state as coloured text or a chip today (audit-log action, pass/review/fail style cues), so state reads one way everywhere |
| **Copy ID button, short ID tag** (v2) | `ui/copy-id-button` and every table or dialog that shows a record id |
| **Report page: in-bar search** (v2) | the list pages whose card carries it; behaviour is built on the page's existing filter state, not a new API |
| **App shell: phone drawer** (v2) | `ui/app-shell` below 60rem: the drawer floats over the page |
| **Conductor colours** (proposed in v2) | built as a shared `ui/` component with its own spec, and used on the BOM screens wherever a core colour or conductor material is shown; if no screen shows one today, it ships with its spec and the follow-up below says where it will attach |
| Form / Detail / Confirm-delete dialog | every `*-dialog` in those features |
| Error banner | the inline error in each form and page |
| Checkbox filter list, Date range presets, Jalali datetime field, Searchable select, Password visibility toggle, Copy ID button | the matching `ui/` components |

Rules that apply to every screen: a page opens with a page header (`cablan-page-title` h1, one-line
description, actions at the end with the single filled action last); a list lives in one data sheet,
never as a floating table, filters and paginator; dialogs have a head with a close button (except a
delete confirm) and a tinted footer, with the dismiss action first and at most one filled action;
table rows tint on hover; row actions are a small text «جزئیات» plus an overflow menu; columns of
quantities set tabular figures and align to the end, with the unit in the column header.

**Markup contract.** The acceptance suite locates fields and buttons by accessible name, and the
a11y gate protects those. Restyling must not change a label, a button's text, or a control's role.
Structural selectors the suite may lean on (the old suite anchored on `.field__error` and similar)
are not gated; a class rename or a markup restructure in an error state can break it with no check
failing first. The builder greps `acceptance-tests/` for class and element selectors before
renaming anything, and reports what it finds rather than editing that project.

**Routes.** No new routes. If one is added, it joins `publicRoutes`/`authenticatedRoutes` in
`a11y/accessibility.spec.ts` and declares a `title`.

## 3. Assets

- **Adopt:** `logo-horizontal.png` (155×50), used on the login card on `cablan-logo-plate`. It has
  no dark-ground version, which is why the plate exists. Add to `public/`; render it with
  `NgOptimizedImage` and a meaningful `alt`.
- **Compare, then keep or replace:** `fonts/vazirmatn-variable.woff2` and `Vazirmatn-OFL.txt` in the
  artifact against `public/fonts/`. If byte-identical, change nothing.
- **Keep as is:** `public/logo.jpeg` (the favicon; already matches the artifact's `logo.jpeg`).
- **Commit:** a copy of `tokens.json` (location the builder's call, not under `src/` and not inside
  the gated generated paths) for the verification above.
- **Read, do not copy:** the component READMEs, previews and `static-material.css`. They are the
  builders' visual spec and live in the artifact.
- Icons: inline SVG inside `mat-icon`, never the ligature form (there is no icon font). Directional
  icons mirror with the document direction.

## 4. Documentation

- Rewrite `frontend/.claude/skills/cablan-design-system/SKILL.md` for v2: token tables (new
  colours, the six type styles, shape-by-role, surface and elevation rules), the density and
  override list, the component table's v2 notes (button variants, chips never as clickable actions,
  card appearance), and the content fundamentals that matter to code (tabular figures, Persian
  digits for quantities, Latin digits for identifiers). Remove statements that v2 makes false
  (`corner-large` for a card, level 1 for a resting card, azure/violet).
- Update `frontend/CLAUDE.md`: the design-system section, the directory layout (the stale
  "features/ holds only not-found" claim), and any file-list change.
- Update the root `CLAUDE.md` only if a root-level fact changes. Expected: none.
- Do not write the acceptance-tests project's name into any backend or frontend file (the one-way
  dependency rule).

## 5. Order of work and verification

1. Foundations, then docs, then the `tokens.json` check. Land as its own commit.
2. Screens, one commit per feature or per tightly related group, after Foundations.
3. After each commit, the cheap gates: `make lint-styles`, `make lint`, `make format`,
   `make run-unit-tests`. The frontend specs assert behaviour and accessible names, so a green run
   after a pure restyle is expected; a red one is a markup contract break.
4. Before done: `make run-guardrails`, all ten checks, run by the orchestrator, not taken on a
   sub-agent's word. `lint-accessibility` is the one most likely to fail first: the palette is
   new, and every route is graded in light and dark. The v2 README records contrast ratios for its
   role pairs; a failure is fixed by choosing the paired token, not by lowering the bar.
5. Look at it. Run the app and compare each screen with its card and with Cablan UI 2, in both
   colour schemes. The gates cannot see composition.

## Risks

- **Contrast regression on the new palette**, surfaced by the a11y gate. Mitigation above.
- **Acceptance-suite selectors** that depend on structure the restyle moves. Mitigation in Screens.
- **Scale.** Eleven features, most with four dialogs. Foundations first and in one hand keeps
  the parallel work from diverging on the shared pieces (data sheet, page header, dialog anatomy).
  Those three are built once, in `ui/` or the global styles, and the features consume them.
- **The artifact moves.** Its type has a newer release than the one read here, and the design
  system is edited live. The spec pins the version that was read (`1792149469-1b0d`); a builder
  who finds the card differs from this document follows the card and reports the difference.

## Left to the builder

- How the six type styles are expressed as tokens, and where each `mat.*-overrides` call lives.
- Whether the data sheet, page header and dialog footer are shared components or global styles,
  provided Material is not rebuilt and each is defined once.
- The location and format of the committed `tokens.json` copy and its check, as long as the check
  runs in an existing gate or is a documented one-liner, not a new CI job.
- File-by-file ordering inside Screens, and the split into parallel agents.

## Open points for the design owner (not blockers)

- Whether `cablan-success` sharing the primary green is intended to stay.
- Persian wording for any page-header description line no screen or mockup supplies.
- Whether Conductor colours has a consumer today. If the BOM data carries no core colour or
  conductor material, the component ships unused (specced and tested) until it does.

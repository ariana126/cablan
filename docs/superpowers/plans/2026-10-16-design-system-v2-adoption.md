# Cablan Design System 2 Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. The user chose native execution: the main session implements every task itself, in order, then one fresh reviewer checks the whole branch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page, dialog and shared element of `frontend/` renders Cablan Design System 2, and the repo's own design-system documentation says the same.

**Architecture:** Foundations first (palette, type, shape, overrides, one verification spec), then the shared patterns every screen consumes (page header, data sheet, dialog anatomy, badges, tiles), then the screens, one commit per feature. Shared patterns are defined once in `src/app/ui/` and `src/styles/`; features consume them and never restyle Material themselves.

**Tech Stack:** Angular 21 (zoneless, signals, Signal Forms), Angular Material 21 (`mat.theme()`, `mat.*-overrides`), Vitest + jsdom for units, Playwright + axe for `a11y/`, stylelint + ESLint + Prettier gates, all through Docker and the Makefile.

**Spec:** `docs/superpowers/specs/2026-10-16-design-system-v2-adoption-design.md`. Read it first; the design-system export it names is the visual spec.

## Global Constraints

- **Design-system export** (read-only reference, version `1792149469-1b0d`), called `$DS` below:
  `/tmp/claude-1000/-home-ariana-Projects-cablan/924d72df-fe18-4951-83bd-8fff860ba999/scratchpad/artifact-files/15140c33-58be-4654-bc10-19322731514e/project`.
  `$DS/README.md` is the brand book, `$DS/tokens.json` the values, `$DS/components/<Card>/{README.md,preview.html}` one card per pattern, `$DS/previews/static-material.css` the cards' shared stylesheet. The cards are plain markup; build them with `mat-*` components and tokens, not by copying their CSS.
- No literal colour, length, radius or type size outside `src/styles/_theme.scss`, `_tokens.scss`, `_fonts.scss`. No new stylelint exemption. No `!important`, `::ng-deep`, `.mat-*`/`.cdk-*` selector, inline `styles:`, `style=""`, `ngClass`, `ngStyle`. Physical CSS properties are banned (RTL): use logical ones.
- One theme with `color-scheme: light dark`; no `prefers-color-scheme` rule. Error stays Material's red.
- Type styles: `cablan-page-title` 24px/700, `cablan-section-title` 18px/600, `cablan-card-title` 16px/600, `cablan-table-header` 13px/600 muted, `cablan-data` 14px/400, `cablan-meta` 12px/500 muted. Line heights 2rem, 1.75rem, 1.5rem, 1.125rem, 1.25rem, 1rem.
- Corners by role: full = state, small (8px) = control, medium (12px) = container, large (16px) = overlay/standalone, extra-small (4px) = tooltip, tag, focus ring. Shadows only on floating things: level 2 menus/autocomplete/calendar, level 3 dialogs/snackbars.
- Density: fields 48px (density -2); buttons and nav items 40px; small/filter/in-row icon buttons 32px; table header 44px, rows 48px (dense: 36/40).
- Page column: 72rem list/report/dashboard, 64rem home, `cablan-measure` not-found; padding `cablan-space-6`.
- Persian-Indic digits for quantities (`persianNumber` pipe), Latin for identifiers; quantities tabular and end-aligned; units in column headers. Icons are inline SVG inside `mat-icon`, never the ligature form; directional icons mirror.
- **Markup contract and the acceptance suite:** cards win over existing markup, including accessible names. In the same task as each frontend change, find the locators in `acceptance-tests/screenplay/ui/` and `screenplay/common/` (and the step definitions that use them) that touch the changed screens, and update them to the new markup, preferring accessible-name locators over structural selectors. The suite stays one-way dependent: no imports from `frontend/`. `.feature` files are not edited. Backend and frontend files never name the acceptance-tests project.
- **Never stop for input.** Where the spec, a card or the code leaves a choice, take the one that best matches the card, record it as a line in `$HOME/ds-v2-deviations.md` (one line: task, what, why), and continue. The final report summarises that file. A genuine blocker (a tool failure, a red gate that cannot be fixed) is retried and root-caused, not asked about.
- **Long runs.** `make run-acceptance-tests` and `make run-guardrails` take over ten minutes: launch them detached, `setsid nohup sh -c 'make run-acceptance-tests > $HOME/acc.log 2>&1; echo "EXIT=$?" >> $HOME/acc.log' &`, wait with `until grep -q '^EXIT=' $HOME/acc.log`, and read the log. Check `df -h /` first (want at least 9 GB free); if short, `docker volume prune -f` (anonymous volumes only; never the named `*_pgdata` volumes).
- New copy is not invented: use the Persian text on the screen, in the card, or in the mockup.
- Commands (everything runs in Docker): single spec files `cd frontend && docker compose run --rm app npx ng test --watch=false --include='<glob>'`; gates `make lint-styles`, `make lint`, `make format` (fix with `make fix-lint-styles fix-lint fix-format`), `make run-unit-tests`, `make lint-accessibility`, final `make run-guardrails`.
- Commits: local only (no push), `feat(frontend): …` style, each ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies that no feature test would otherwise exercise, most likely first:

1. **Dark-scheme contrast on the new palette**, on every route: a role pair that passes in light and fails in dark. Pinned by Task 1's token spec and the existing two-scheme axe audit.
2. **Acceptance-suite locator drift** during the restyle (row actions moving into a menu, dialog classes, the dashboard's panels, the Excel export menu, filter buttons): the suite finds controls by name and by structure. Pinned by updating its locators in the same task and by the checkpoint runs.
3. **In-bar search with Persian input**: typing Persian/Arabic digits or the Arabic forms of ی/ک must match Persian data. Pinned in Task 4.
4. **Data sheet states**: zero rows, failed load, loading, and one very long cell in a narrow column. Pinned in Task 4.
5. **Phone width (< 60rem)**: the drawer's focus trap, Escape and focus return, and the table's horizontal scroll. Pinned in Task 9.

---

## Task dependencies

`0 → 1 → 2 → 3`; after Task 2, Tasks 4, 5, 6 and 7 are independent of each other (disjoint files); executed natively, they run in this order. Task 8 needs Task 4 (it consumes the moved search normaliser). Task 9 needs 4 and 5. Features (Tasks 10 to 16) need 4 to 9, touch disjoint folders; Task 16 also needs 6 and 7. Task 17 follows them all, then Task 18.

### Task 0: Baseline and workspace

**Files:** none changed.

- [ ] **Step 1:** Record `git rev-parse HEAD` in the task notes. Work stays on the current branch, as the earlier refactors did.
- [ ] **Step 2:** Run `make lint-styles lint format run-unit-tests`, then launch `make run-acceptance-tests` detached (see Long runs). Expected: record which pass. A failure here is pre-existing: write it to `$HOME/ds-v2-deviations.md` as a baseline line and continue; later runs are judged against it.
- [ ] **Step 3:** Create `$HOME/ds-v2-deviations.md` with a heading line. Confirm `$DS/README.md`, `$DS/tokens.json` and `$DS/components/ReportPage/README.md` exist. `$DS/../70080bfc5f132d3074082f20da033ade.png` is the horizontal logo (already copied to `$DS/assets/Logos/logo-horizontal.png`). `public/fonts/vazirmatn-variable.woff2` and `Vazirmatn-OFL.txt` were already verified byte-identical to the export; nothing to change.

### Task 1: Palette and the token verification spec

**Files:**
- Modify: `frontend/src/styles/_theme.scss`
- Create: `frontend/design/tokens.json` (byte copy of `$DS/tokens.json`), `frontend/a11y/design-tokens.spec.ts`
- Modify: `frontend/.prettierignore` (add `design/tokens.json`, a byte-compared mirror like `api/openapi.json`)

**Interfaces:**
- Produces: every `--mat-sys-*` colour role and every `--cablan-brand-*`, `--cablan-logo-plate`, `--cablan-core-*`, `--cablan-material-*`, `--cablan-success` custom property, resolving to the values in `tokens.json` in both schemes.

- [ ] **Step 1: Write the failing spec** `a11y/design-tokens.spec.ts`. For `scheme` in `['light','dark']` (via `page.emulateMedia({ colorScheme })`, page `/login`) and every entry of `design/tokens.json` `color.tokens` (read with `fs`), resolve the token by appending a probe `div` with `style.color = 'var(--<name>)'` and reading `getComputedStyle(probe).color`; compare with the hex in `value[scheme]` converted to `rgb(r, g, b)`. Test title per token: `` `${name} (${scheme})` ``. Skip `mat-sys-neutral10` and `mat-sys-neutral-variant20` (Material's own internals); they are logged, not asserted.
- [ ] **Step 2: Run it to see it fail:** `make lint-accessibility` (or the single spec through the a11y compose service). Expected: FAIL on `mat-sys-primary (light)`, azure instead of `rgb(0, 110, 10)`.
- [ ] **Step 3: Implement the palette in `_theme.scss`.** First generate green (primary and secondary seed) and copper (tertiary) palettes with Material's theme-color schematic from `#09a217`, `#b87333` and neutrals from `#221815`, and re-run the spec. For every role that still differs, author the tonal palette maps from `tokens.json` so the roles match exactly; `mat.theme()` takes them as custom palettes. Define the physical colours as plain custom properties in `html { … }`, and `--cablan-success` as `light-dark(<light>, <dark>)` from the file. Update the file's header comment: the "do not hand-roll a palette" rule is replaced by "palettes are generated, or authored from `design/tokens.json` where the generator cannot match it".
- [ ] **Step 4: Run the spec.** Expected: PASS, both schemes. If a role cannot be matched exactly after hand-authoring, use the nearest achievable value, make the spec tolerate no more than that role's difference, and log the role, both values and the delta in the deviations file.
- [ ] **Step 5: Run `make lint-accessibility`.** Expected: the existing audit still passes in both schemes; a contrast failure is fixed by choosing the paired token in the failing component, not by editing the palette.
- [ ] **Step 6: Commit** `feat(frontend): adopt the Cablan v2 palette`.

### Task 2: Type, shape, density, overrides, layout primitives

**Files:**
- Modify: `frontend/src/styles/_tokens.scss`, `_layout.scss`, `_reset.scss` (body keeps `--mat-sys-body-medium`), `frontend/src/styles.scss`
- Create: `frontend/src/styles/_overrides.scss` (the `mat.*-overrides` calls), `frontend/a11y/design-foundations.spec.ts`

**Interfaces:**
- Produces: six type tokens `--cablan-page-title`, `--cablan-section-title`, `--cablan-card-title`, `--cablan-table-header`, `--cablan-data`, `--cablan-meta`, each a `font` shorthand consumed as `font: var(--cablan-page-title)` (colour for the two muted ones is set by the consumer from `--mat-sys-on-surface-variant`); layout classes `.stack--hair` (gap `--cablan-space-1`) and page-column classes `.page` (72rem), `.page--home` (64rem), `.page--narrow` (`--cablan-measure`), all `margin-inline: auto`, padding `--cablan-space-6`, `.page--narrow` padding `--cablan-space-16` `--cablan-space-6`.

- [ ] **Step 1: Write the failing spec** `a11y/design-foundations.spec.ts` on `/login`: (a) for each of the six type tokens, a probe with `font: var(--cablan-…)` has the computed font size, weight and line height from Global Constraints; (b) the page's first `getByRole('button')` has computed height `40px` and border-radius `8px`; (c) the first outlined `mat-form-field` container is `48px` tall with 8px radius; (d) a probe with class `stack--hair` has `row-gap` `4px`.
- [ ] **Step 2: Run it.** Expected: FAIL (tokens undefined, buttons are pills, fields 56px).
- [ ] **Step 3: Implement.** Define the type tokens in `_tokens.scss` (the exempt file); never name the family, use Material's typeface reference so the token carries Vazirmatn. Write `_overrides.scss` with exactly the mixins the README lists: `button` (shape small, height 40px, label weight 600, filled/outlined/text/tonal; `elevated` unused), `form-field-density(-2)` and `form-field-overrides` (outlined shape small), `dialog` (shape large, lowest container), `table` (44/48px, lowest container), `paginator` (52px), `toolbar` (56px, lowest container), `sidenav` (shape 0, low container), `list` (shape small, 40px), `card` (outlined, medium, no shadow), `autocomplete`, `menu` (medium, lowest), `datepicker`, `expansion` (shape 0, header 56px). All values are tokens; call them scoped to `:root` from `styles.scss`, after `theme`. Add the `.danger` scope: `mat.button-overrides` with `filled-container-color: var(--mat-sys-error)` and `filled-label-text-color: var(--mat-sys-on-error)` under a `.danger` class (Task 5 uses it).
- [ ] **Step 4: Run the spec.** Expected: PASS.
- [ ] **Step 5: Run `make lint-styles lint format run-unit-tests`.** Expected: green; existing specs do not assert on pixels. Fix any stylelint hit with a token, never an exemption.
- [ ] **Step 6: Commit** `feat(frontend): v2 type scale, shape, density and Material overrides`.

### Task 3: Documentation

**Files:**
- Modify: `frontend/.claude/skills/cablan-design-system/SKILL.md`, `frontend/CLAUDE.md`

- [ ] **Step 1:** Rewrite the skill from `$DS/README.md` and `$DS/tokens.json`: colour roles and their usage lines, the six type tokens, shape-by-role, tone-and-hairline surfaces, elevation only on floaters, density, the override list, button variants, chips never as clickable actions, `.danger`, page widths, `.stack--hair`, content fundamentals that reach code (tabular figures, Persian digits for quantities, Latin for identifiers, logical properties). Remove every v1 statement that is now false (azure/violet, `corner-large` for cards, level 1 for a resting card, `headline-*` for page titles). Keep the gotchas that still hold.
- [ ] **Step 2:** In `frontend/CLAUDE.md` update the design-system section (palette source, the type tokens, `_overrides.scss` in the file list, "the only three exempt files" still true), the stale claim that `features/` holds only `not-found/`, and the `ui/` list as Tasks 4 to 8 land (Task 17 comes back to it).
- [ ] **Step 3:** Run `make format`. Expected: PASS.
- [ ] **Step 4: Commit** `docs(frontend): describe design system v2`.

### Task 4: Shared list-page patterns

**Files:**
- Create under `frontend/src/app/ui/`: `page-header/`, `data-sheet/`, `filter-button/`, `active-filters/`, `error-banner/`, `empty-state/`, `table-search/`, `search-text/normalize-search-text.ts`; each with `.ts`, `.scss`, `.spec.ts`
- Modify: `ui/checkbox-filter-list/checkbox-filter-list.ts` (import the moved normaliser only)

**Interfaces (all standalone, OnPush, selectors prefixed `app-`):**
- `PageHeader` `app-page-header`: `heading = input.required<string>()`, `description = input<string>()`; content slot `[pageHeaderActions]`. Renders the page's one `<h1>` in `--cablan-page-title`; no description line when none given.
- `DataSheet` `app-data-sheet`: `heading = input.required<string>()`, `count = input<number | null>(null)`, `loading = input(false)`; slots `[sheetSearch]`, `[sheetFilters]`, `[sheetChips]`, default (the table), `[sheetFooter]`. A `<section aria-labelledby>` named by its heading; the count renders as `<span role="status">` «{count | persianNumber} نتیجه»; `loading` shows a `mat-progress-bar` across the top.
- `FilterButton` `app-filter-button`: `label = input.required<string>()`, `selectedCount = input(0)`, `accessibleName = input<string>()`, output `pressed`. Idle: 32px pill, dashed `--mat-sys-outline` border, plus icon. Active: `--mat-sys-secondary-container`, count badge, chevron. Default accessible name: idle `label`; active «فیلتر {label}، {n} مقدار انتخاب شده». If `accessibleName` is set it wins (features keep their current names).
- `ActiveFilters` `app-active-filters`: `chips = input.required<readonly ActiveFilterChip[]>()` where `export interface ActiveFilterChip { id: string; column: string; value: string; removeLabel: string }`; outputs `removed = output<string>()` (chip `id`), `clearedAll = output<void>()`. Renders nothing when `chips` is empty; «پاک کردن همه» is a text button.
- `ErrorBanner` `app-error-banner`: `message = input.required<string>()`, `retryLabel = input<string>()`, output `retry`. `role="alert"`, error-container fill.
- `EmptyState` `app-empty-state`: `message = input.required<string>()`, `actionLabel = input<string>()`, output `action`. `role="status"`.
- `TableSearch` `app-table-search`: `label = input.required<string>()`, `value = model('')`. Compact 40px outlined field, leading search icon, accessible name `label`, no submit button.
- `normalizeSearchText(text: string): string` in `ui/search-text/normalize-search-text.ts`: lower-cases, folds Persian/Arabic digits to one script, folds ي→ی and ك→ک. This is the existing logic of `checkbox-filter-list.ts`, moved, not copied.

- [ ] **Step 1: Write the failing specs**, one per component, asserting by role/name: `PageHeader` renders `getByRole('heading', { level: 1, name: <heading> })` and no description element when none; `DataSheet` exposes `getByRole('region', { name: <heading> })`, shows «۳ نتیجه» in a `status` for `count=3`, a `progressbar` only when `loading`; `FilterButton` names (idle, active, override), emits `pressed`; `ActiveFilters` renders nothing for `[]`, one remove button named `removeLabel` per chip, emits `removed` with the chip id and `clearedAll`; `ErrorBanner` is an `alert` with a retry button only when `retryLabel` is set; `EmptyState` likewise as `status`; `normalizeSearchText('۱۲۳ كابل')` equals `normalizeSearchText('123 کابل')`; `TableSearch` binds `value` both ways.
- [ ] **Step 2: Run them.** Expected: FAIL, components undefined.
- [ ] **Step 3: Implement each component** per the card named in its section: Report page (`$DS/components/ReportPage`), Error banner, plus the table-wrapper rules from its README (sheet frame `--mat-sys-surface-container-lowest`, 1px `--mat-sys-outline-variant`, `--mat-sys-corner-medium`, clipped; active-filter strip on `--mat-sys-surface-container-low`). Move the normaliser and update `checkbox-filter-list.ts` to import it.
- [ ] **Step 4: Run them plus `checkbox-filter-list.spec.ts`.** Expected: PASS.
- [ ] **Step 5: Pin Review Focus 3 and 4:** add specs that `TableSearch` consumers can match `'۱۲۳'` against `'123'` through `normalizeSearchText`, and that `DataSheet` with a long unbroken cell scrolls horizontally inside its frame (the table slot has `overflow-x: auto`; assert the class, not pixels).
- [ ] **Step 6:** `make lint-styles lint format`. Expected: green.
- [ ] **Step 7: Commit** `feat(frontend): shared page header, data sheet and list-page parts`.

### Task 5: Dialog anatomy

**Files:**
- Create: `frontend/src/styles/_dialog.scss` (`@use`d from `styles.scss`), `frontend/src/app/ui/dialog-head/dialog-head.{ts,scss,spec.ts}`

**Interfaces:**
- Produces: `DialogHead` `app-dialog-head`: `heading = input.required<string>()`, `subtitle = input<string>()`, `showClose = input(true)`, `closeLabel = input('بستن')`; renders `<h2 mat-dialog-title>` plus, when `showClose`, a `matIconButton` carrying `mat-dialog-close` and `aria-label=closeLabel`. Global classes: `.dialog-footer` (on `mat-dialog-actions`: low-container bar, top `--mat-sys-outline-variant` rule, padding `--cablan-space-4` `--cablan-space-6`), `.dialog-footer--split` (first group at the start, the rest at the end), `.dialog-icon-tile` (40px error-container tile for confirm dialogs). `.danger` already exists from Task 2.

- [ ] **Step 1: Failing spec** for `DialogHead`: in a `MatDialog`, asserts `getByRole('heading', { name })`, a button named `بستن` that closes the dialog, none when `showClose=false`, subtitle rendered only when given.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement** from `$DS/components/FormDialog` and `ConfirmDeleteDialog` READMEs: widths 28rem confirm / 32rem form / 34rem detail are set by each dialog's own `width` open-config, not here; head padding `--cablan-space-6` `--cablan-space-6` `--cablan-space-4`; title `--cablan-section-title`.
- [ ] **Step 4:** Run the spec, then `make lint-styles lint format`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): shared dialog head and footer`.

### Task 6: Dashboard and audit-log parts

**Files:** Create under `frontend/src/app/ui/`: `stat-tile/`, `status-badge/`, `type-tag/`, `weight-difference/`; each `.ts`, `.scss`, `.spec.ts`.

**Interfaces:**
- `StatTile` `app-stat-tile`: `label = input.required<string>()`, `value = input.required<string>()`, `note = input<string>()`, `compactValue = input(false)` (the 18px/600 timestamp form); slot `[tileIcon]`. A `<div>`, no `aria-live`.
- `StatusBadge` `app-status-badge`: `kind = input.required<'create' | 'update' | 'delete' | 'neutral'>()`, `label = input.required<string>()`. Icons: plus, pencil, trash, equals, each 14px inline SVG; pairs per `$DS/components/StatusBadge/README.md`.
- `TypeTag` `app-type-tag`: `label = input.required<string>()`. 24px, `--mat-sys-corner-extra-small`, `--mat-sys-surface-container-high`.
- `WeightDifference` `app-weight-difference`: `direction = input.required<'above' | 'below' | 'equal'>()`, `value = input.required<number>()`. Pill with arrow icon, the value through `persianNumber`, and visually hidden text «بیشتر از استاندارد» / «کمتر از استاندارد» / «برابر با استاندارد».

- [ ] **Step 1: Failing specs:** `StatusBadge` shows the label and an icon for each kind, never colour alone (assert the label text); `WeightDifference` renders the hidden words for each direction and the Persian-digit value (`value=1234.5` → `۱٬۲۳۴٫۵`); `StatTile` reads label then value in DOM order; `TypeTag` renders its label.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement** from the four cards. Use `--mat-sys-primary-container`/`on-` for above and create, `--mat-sys-tertiary-container` for update, `--mat-sys-error-container` for below and delete, `--mat-sys-surface-container-high`/`--mat-sys-on-surface-variant` for neutral and equal.
- [ ] **Step 4:** Run the specs and `make lint-styles lint format`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): stat tile, status badge, type tag and weight difference`.

### Task 7: Conductor colours

**Files:** Create `frontend/src/app/ui/conductor-colours/conductor-colours.{ts,scss,spec.ts}`.

**Interfaces:**
- `export type CoreColour = 'brown' | 'black' | 'grey' | 'blue' | 'pe'`, `export type ConductorMaterial = 'copper' | 'aluminium'`; `ConductorColours` `app-conductor-colours`: `cores = input<readonly CoreColour[]>([])`, `material = input<ConductorMaterial>()`, `compact = input(false)`.

- [ ] **Step 1: Failing spec:** non-compact renders each swatch followed by its name («قهوه‌ای»، «مشکی»، «خاکستری»، «آبی»، «سبز-زرد»; «مس»، «آلومینیوم»); `compact` renders a `role="img"` group whose `aria-label` lists the cores in order («چهار رشته: قهوه‌ای، مشکی، خاکستری، آبی»), with count words for 1 to 4 and a numeric fallback beyond.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement** from `$DS/components/ConductorColours/README.md`: 12px `--mat-sys-corner-full` swatch with a 1px `--mat-sys-outline` ring, PE as a 135° split of `--cablan-core-green`/`--cablan-core-yellow`; swatch fill goes through a class per colour that sets `background-color: var(--cablan-core-…)`.
- [ ] **Step 4:** Run the spec and `make lint-styles lint format`. Expected: PASS.
- [ ] **Step 5:** Search the BOM and product models (`src/app/api/model`, generated) for a core-colour or conductor-material field. If one exists, use the component on that screen in Task 9, 10 or 11 and say so in that task's report. If none exists, the component ships specced and unused; log it in the deviations file.
- [ ] **Step 6: Commit** `feat(frontend): conductor colours component`.

### Task 8: Existing shared components

**Files (each with its `.scss` and `.spec.ts`):** Modify `ui/checkbox-filter-list/`, `ui/copy-id-button/`, `ui/date-range-presets/`, `ui/jalali-datetime-field/`, `ui/password-visibility-toggle/`, `ui/searchable-select/`; `ui/persian-number/` only to confirm tabular output is the consumer's job (no change expected).

**Interfaces:**
- `CheckboxFilterList.options` gains `count?: number`, rendered end-aligned as `--cablan-meta`, tabular; the select-all label is «انتخاب همه نتایج جستجو» while a search text is non-empty, «انتخاب همه» otherwise, and acts on visible matches only; empty search result shows `app-empty-state`-style «موردی یافت نشد».
- `CopyIdButton` gains `short = input(false)`: when true it renders `<bdi dir="ltr">` with the first eight characters of `entityId` followed by `…` before the button, tooltip and copy still the full id. Default behaviour (id never rendered) is unchanged.

- [ ] **Step 1: Failing specs:** `CheckboxFilterList` shows a count per option and switches the select-all label with search; `CopyIdButton` with `short` renders the first eight characters in a `bdi` and still copies the full id; its default render contains no id text.
- [ ] **Step 2:** Run them. Expected: FAIL for exactly those two new behaviours; every pre-existing spec stays green.
- [ ] **Step 3: Implement** the two behaviours and restyle all six components from their cards (README + preview). Copy-id snackbar copy is «شناسه کپی شد.» with a leading check icon in `--mat-sys-inverse-primary`, «شناسه کپی نشد.» with action «باشه».
- [ ] **Step 4:** Run `ui/**` specs and `make lint-styles lint format`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): shared inputs follow design system v2`.

### Task 9: App shell, home, login, not-found

**Files:** Modify `ui/app-shell/app-shell.{ts,scss,spec.ts}`, `features/home/*`, `features/login/*`, `features/not-found/*`; Add `frontend/public/logo-horizontal.png` (copy of `$DS/assets/Logos/logo-horizontal.png`).

**Interfaces:**
- Consumes: `NAVIGATION`/`navigationFor` in `core/identity/navigation.ts` (breadcrumb is derived from it: category, then page), `CurrentUserStore`, `SessionStore`.

- [ ] **Step 1: Failing specs** in `app-shell.spec.ts`: (a) the toolbar shows «کابلان» as a link home; (b) a breadcrumb `nav` named «مسیر» with the current page marked `aria-current="page"`; (c) the user button, named «حساب کاربری: {name}، {role}», opens a menu with «خروج از سیستم» that logs out (no bare logout button in the toolbar); (d) with a narrow viewport (`BreakpointObserver` faked to match `(max-width: 59.99rem)`) the drawer is `mode="over"`, closed on navigation; opening it moves focus inside, Escape closes it and focus returns to the menu button named «گشودن منو». Pins Review Focus 5.
- [ ] **Step 2:** Run it. Expected: FAIL on (b), (c), (d).
- [ ] **Step 3: Implement** from the App shell card: toolbar 56px, wordmark weight 800, breadcrumb, avatar with initials; drawer 15rem with disclosure categories (`aria-expanded`/`aria-controls`) that open themselves when they hold the current page; active item `secondary-container`; below 60rem over-mode, 280px, level 3, scrim. Restyle home as the Nav card grid (cards `appearance="outlined"`, hover `surface-container-high`), login as the Login page card on its own ground with `logo-horizontal.png` through `NgOptimizedImage`, `alt` «کابلان», on a `--cablan-logo-plate` plate, and not-found per its card at `.page--narrow`.
- [ ] **Step 4:** Run `app-shell`, `home`, `login`, `not-found` specs and `app.routes.spec.ts`. Expected: PASS with every pre-existing accessible-name assertion untouched.
- [ ] **Step 5:** `make lint-styles lint format lint-accessibility`. Expected: green in both schemes on `/login`, `/`, `/no-such-page`.
- [ ] **Step 6:** Follow in the acceptance suite as in FP-6b: `screenplay/ui/app-shell.ts`, `home-page.ts`, `login-page.ts`, `screenplay/common/login.ts`. Commit with the frontend change, `feat(frontend): app shell, home, login and not-found follow design system v2`.
- [ ] **Step 7: Checkpoint A1.** Run `make run-acceptance-tests` detached. Expected: no failure that the Task 0 baseline did not have. Fix suite locators or frontend regressions until it matches, committing the fixes.

---

## Feature procedure (FP), applied by Tasks 10 to 16

Each feature below is one commit. Do these steps in order; the task lists only what differs.

- [ ] **FP-1:** Run the feature's specs to a green baseline: `docker compose run --rm app npx ng test --watch=false --include='src/app/features/<feature>/**/*.spec.ts'`.
- [ ] **FP-2:** List the acceptance-suite locators and steps that touch this feature: read its `acceptance-tests/screenplay/ui/<feature>-page.ts`, the screenplay tasks and questions that import it, and `screenplay/common/data-table.ts` if the feature uses it.
- [ ] **FP-3: Page.** `<h1>` and actions become `app-page-header` (description only if the screen already has text); the list becomes one `app-data-sheet` holding the existing `mat-table`/`matSort`/`mat-paginator`; column filters use `app-filter-button` (keeping each existing accessible name through `accessibleName`) and `app-active-filters`; load errors use `app-error-banner`, empty results `app-empty-state`, loading the sheet's `loading`. Row actions follow the Report page card: the page's primary action as a small text button, the rest in an overflow `mat-menu` (button named «عملیات بیشتر برای {record}»), even where that renames or moves an existing control. Quantity columns: tabular, end-aligned, unit in header.
- [ ] **FP-4: Dialogs.** Each dialog gets `app-dialog-head` (no close button on a delete confirm), a `.dialog-footer` bar with the dismiss action first and at most one filled action named for its result, widths 28/32/34rem, `.danger` on the confirm-delete button, `<form novalidate>` retained, required marks per the Form dialog card.
- [ ] **FP-5: Specs.** Add one assertion per page: `getByRole('heading', { level: 1 })` has the page title; the sheet is a `region` named by its heading. Update the feature's existing specs where the card changed a name or structure, keeping each behaviour assertion.
- [ ] **FP-6:** Run the feature specs, then `make lint-styles lint format`. Expected: green.
- [ ] **FP-6b: Follow in the acceptance suite.** Update the locators and steps found in FP-2 to the new markup (row action now a button inside a row plus a menu item, dialog head and footer, filter buttons, `app-data-sheet` region, and so on), preferring `getByRole`/accessible-name locators over `td.mat-column-*` or positional selectors, and run `make lint format` in `acceptance-tests` through the root targets. The scenarios themselves are exercised at the next checkpoint run.
- [ ] **FP-7: Look.** Run `make up`, open the page in both colour schemes at desktop and phone width with the browser tools, and compare to its card and to Cablan UI 2. Fix composition differences; log in the deviations file anything the card requires that the screen cannot supply, and what was done instead.
- [ ] **FP-8: Commit** the frontend and acceptance-tests changes together, `feat(frontend): <feature> follows design system v2`.

### Task 10: `features/boms` (daily BOMs, the reference list page)
**Files:** `features/boms/*` (page, form, detail, filter, confirm-delete dialogs and their `.scss`/specs).
**Extra:** this is the Report page card's source; it also owns the filter bar (date range presets, two Jalali fields, «اعمال بازه», on a low-container panel with stacked labels) and the «خروجی اکسل» menu. Build the filter bar here as page markup; Tasks 11 to 16 reuse it by the same markup, not a new component.

### Task 11: `features/standard-boms`
**Files:** `features/standard-boms/*`. **Extra:** same filter bar and Excel menu as Task 10.

**Checkpoint A2** (after Tasks 10 and 11): run `make run-acceptance-tests` detached; fix every new failure in the suite's locators and steps or the frontend, and commit. Then proceed.

### Task 12: `features/products`, Task 13: `features/materials`, Task 14: `features/components`
**Files:** the matching `features/<feature>/*`. **Extra:** master-data lists: no date filter bar, the sheet starts the page, and `app-table-search` («جستجوی نام یا کد») sits in the sheet bar via `[sheetSearch]`. These list endpoints (`GET /api/materials`, `/components`, `/products`, `/users`) take no query parameters and return the full list, so the search filters the loaded rows client-side with `normalizeSearchText`, before the paginator. If Task 7 found conductor fields, show them on products. The row's primary action is «ویرایش» and the menu holds «حذف» (and «کپی شناسه» via `app-copy-id-button`).

### Task 15: `features/users`
**Files:** `features/users/*`. **Extra:** as Tasks 12 to 14, including the search check; role labels use `app-type-tag`.

### Task 16: `features/audit-log` and `features/bom-dashboard`
**Files:** `features/audit-log/*`, `features/bom-dashboard/*`.
**Extra, audit log:** the action column becomes `app-status-badge` (`kind` from the API's event type; neutral for any event type that is not create/update/delete), the record-type column `app-type-tag`, «شناسه رکورد» shows `app-copy-id-button` with `short`, and a second `app-table-search` («شناسه رکورد») filters by record id. Read how the audit-log page loads its rows: if it holds all of them, filter client-side; if it pages on the server with no id filter, add one to the backend (read `backend/CLAUDE.md` first; query, controller DTO, handler and tests; then `make generate-swagger` and `make sync-api-contract`), and bind the search to it.
**Extra, dashboard:** three `app-stat-tile`s («آنالیز های روزانه», «محصولات», «آخرین ثبت») counted from data the page already loads (a figure the page cannot back is dropped and reported), the master-detail grid (20rem and the rest, stacking under 60rem) with the selected product row `aria-selected="true"` and the analyses as `mat-expansion-panel` items, and the weight deviation as `app-weight-difference`. Replace the existing `--cablan-success` border usage there per the Weight difference card.

**Checkpoint A3** (after Task 16): run `make run-acceptance-tests` detached and fix every new failure. Then proceed.

---

### Task 17: Documentation catch-up

**Files:** Modify `frontend/CLAUDE.md`, `frontend/.claude/skills/cablan-design-system/SKILL.md`.

- [ ] **Step 1:** List the new `ui/` components (Tasks 4 to 7) with their selectors in the directory-layout section and in the skill's "use the shared piece" guidance, and point new list pages at `app-page-header` + `app-data-sheet` and new dialogs at `app-dialog-head` + `.dialog-footer`.
- [ ] **Step 2:** `make format`. Expected: PASS. **Commit** `docs(frontend): document the v2 shared components`.

### Task 18: Whole-system verification

- [ ] **Step 1:** `make fix-violations`, then `make run-guardrails`. Expected: all ten checks green. A red check is fixed in the task that caused it; launch it detached and read the log in full.
- [ ] **Step 2:** Visual pass: every route in light and dark, desktop and phone width, against its card and Cablan UI 2. Also confirm the token spec still passes and `design/tokens.json` matches the export.
- [ ] **Step 3:** Report to the user: what shipped; the accessible-name cases that were kept as-is; the list pages that could not get search because the API has no search parameter; whether Conductor colours has a consumer; description lines left out for want of Persian text; `cablan-success` colour question.
- [ ] **Step 4:** Dispatch one fresh reviewer (the most capable model, given the spec, the plan and the commit range from Task 0's `HEAD`) to review the whole branch. Fix what is confirmed; re-run the affected gates.
- [ ] **Step 5:** Final report to the user: the deviations file contents; the checkpoint and guardrail results; the acceptance-suite locators that changed; the backend changes, if any; conductor colours' consumer status; description lines left out; the stale root `CLAUDE.md` and `acceptance-tests/CLAUDE.md` passages about the suite having no automation, which this task did not rewrite.

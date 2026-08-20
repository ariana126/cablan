// Post-render overlay: serenity-bdd run has no logo/RTL/i18n support (no template or classpath
// override reaches its bundled jar through this CLI — see acceptance-tests/CLAUDE.md), so this
// rewrites the static site it produces, in place, right after generation.
//
// translations.json deliberately excludes PENDING/SUCCESS/SKIPPED and the actor-ability class
// names (Cast, PerformActivities, AnswerQuestions, RaiseErrors, ...): the former are also CSS
// classes and hidden DataTables sort keys, the latter are Serenity/JS framework identifiers, not
// UI chrome. Translating either would corrupt behaviour, not just text.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rtlcss from 'rtlcss';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const brandingDir = join(projectRoot, 'branding');
const siteDir = join(projectRoot, 'target', 'site', 'serenity');
const stylesheetNames = ['core.css', 'link.css', 'screen.css', 'tables.css'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function swapLogo() {
  copyFileSync(
    join(brandingDir, 'logo.png'),
    join(siteDir, 'images', 'serenity-logo.png'),
  );
}

function writeMirroredStylesheetsAndFont() {
  const cssDir = join(siteDir, 'css');
  const fontsDir = join(siteDir, 'fonts');
  mkdirSync(fontsDir, { recursive: true });
  copyFileSync(
    join(brandingDir, 'fonts', 'Vazirmatn.woff2'),
    join(fontsDir, 'Vazirmatn.woff2'),
  );

  for (const name of stylesheetNames) {
    const original = readFileSync(join(cssDir, name), 'utf8');
    // core.css ships malformed declarations like `background-color: #ff68ff; !important;`
    // (a bogus standalone `!important;` instead of a trailing modifier) — PostCSS rejects
    // that outright, so fold it back onto the preceding declaration before mirroring.
    const parseable = original.replace(/;\s*!important\s*;/g, ' !important;');
    writeFileSync(join(cssDir, rtlNameFor(name)), rtlcss.process(parseable));
  }

  writeFileSync(
    join(cssDir, 'branding-rtl.css'),
    `@font-face {
  font-family: 'Vazirmatn';
  src: url('fonts/Vazirmatn.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
body, table, th, td, div, span, a, h1, h2, h3, h4, h5, h6 {
  font-family: 'Vazirmatn', Tahoma, sans-serif !important;
}
`,
  );
}

function rtlNameFor(name) {
  return name.replace('.css', '-rtl.css');
}

// Matches a phrase that is the *entire* (whitespace-trimmed) content of a tag, e.g. both
// `>Home<` and the icon-adjacent, line-wrapped `<i .../></i> Total\n  Duration\n</td>` — Serenity's
// templates freely wrap a label's words across lines. Requiring the match to span from one tag
// boundary to the next (not a bare substring) is what keeps this from ever touching prose pulled
// from actual feature/scenario content.
function tagBoundedPattern(phrase) {
  // Some headers join words with the literal entity `&nbsp;` instead of a real space
  // character (e.g. `Test&nbsp;Cases`), which plain `\s+` never matches.
  const words = phrase.split(' ').map(escapeRegExp).join('(?:\\s|&nbsp;)+');
  return new RegExp(`(>)(\\s*)${words}(\\s*)(<)`, 'g');
}

// Strings whose *value* changes per run (a scenario count, a timestamp, a rule's own text, a
// DataTable's row counts) can't be dictionary keys — each rule here matches a fixed keyword and
// rewrites only that part, leaving the dynamic content it's attached to untouched.
const dynamicPatterns = [
  {
    // "151 tests" / "13 tests" — the count itself must survive.
    pattern: /(\d+)\s+tests\b/g,
    replace: (_match, count) => `${count} آزمون`,
  },
  {
    // "Report generated 20-08-2026 06:35:24" — translate the label, keep the timestamp.
    // Some page types omit the seconds (HH:MM only) or the timestamp entirely, so both the
    // seconds and the whole timestamp are optional.
    pattern: /Report generated ?(\d{2}-\d{2}-\d{4} \d{2}:\d{2}(?::\d{2})?)?/g,
    replace: (_match, timestamp) =>
      timestamp ? `گزارش تولید شده در ${timestamp}` : 'گزارش تولید شده',
  },
  {
    // "Aug 20, 2026 03:33:49" (Started/Finished timestamps) — only the Gregorian month
    // abbreviation is English; day/year/time are kept as-is (no calendar conversion, just the
    // month name — a Solar Hijri conversion would need actual date math, out of scope here).
    pattern:
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}, \d{4} \d{2}:\d{2}:\d{2})\b/g,
    replace: (_match, month, rest) => {
      const monthTranslations = {
        Jan: 'ژانویه',
        Feb: 'فوریه',
        Mar: 'مارس',
        Apr: 'آوریل',
        May: 'مه',
        Jun: 'ژوئن',
        Jul: 'ژوئیه',
        Aug: 'اوت',
        Sep: 'سپتامبر',
        Oct: 'اکتبر',
        Nov: 'نوامبر',
        Dec: 'دسامبر',
      };
      return `${monthTranslations[month]} ${rest}`;
    },
  },
  {
    // "Rule: <dynamic Persian rule text>" — only the "Rule:" keyword is chrome.
    pattern: />(\s*)Rule: /g,
    replace: (_match, leadWs) => `>${leadWs}قانون: `,
  },
  {
    // "Scenario Outline: <text>" must be handled before/independently of "Scenario: <text>" —
    // the colon sits right after "Scenario" only in the latter ("Scenario Outline:" has
    // " Outline" in between), so the two patterns never overlap.
    pattern: />(\s*)Scenario Outline: /g,
    replace: (_match, leadWs) => `>${leadWs}طرح‌کلی سناریو: `,
  },
  {
    pattern: />(\s*)Scenario: /g,
    replace: (_match, leadWs) => `>${leadWs}سناریو: `,
  },
  {
    // "Capability: <name>" heading — the capability *name* itself (e.g. "Authentication") is
    // translated separately, by the word-boundary rule below.
    pattern: />(\s*)Capability: /g,
    replace: (_match, leadWs) => `>${leadWs}توانمندی: `,
  },
  {
    pattern: />(\s*)Feature: /g,
    replace: (_match, leadWs) => `>${leadWs}ویژگی: `,
  },
  {
    // "<actor name> can:" precedes the (deliberately untranslated) ability class list —
    // only the "can:" keyword itself is chrome.
    pattern: / can:/g,
    replace: () => ' می‌تواند:',
  },
  {
    // "Duration: Under 1 Second" (colon form, tag-type/tag-value breadcrumb) — distinct from
    // the no-colon "Duration Under 1 Second" compound handled below; the two never overlap
    // since one has a colon immediately after "Duration" and the other doesn't.
    pattern: /Duration: Under (\d+) Seconds?/g,
    replace: (_match, n) => `مدت زمان: کمتر از ${n} ثانیه`,
  },
  {
    // No-colon compound, e.g. "Duration Under 1 Second" or the tail of the breadcrumb
    // "Bom-Reporting > Duration Under 1 Second". Must run before the bare "Under N Second"
    // fallback below, or that generic rule consumes "Under 1 Second" first and stray
    // "Duration" is left untranslated.
    pattern: /Duration Under (\d+) Seconds?/g,
    replace: (_match, n) => `مدت زمان کمتر از ${n} ثانیه`,
  },
  {
    // Bare "Under 1 Second" (no "Duration" prefix at all — the tag-type is shown separately
    // as "(Duration)"). Must run *after* the two "Duration ... Under" rules above, so a
    // compound match is never partially consumed by this more generic fallback first.
    pattern: /\bUnder (\d+) Seconds?\b/g,
    replace: (_match, n) => `کمتر از ${n} ثانیه`,
  },
  {
    // Tag-type suffix labels on tag badges, e.g. "ثبت جز\n  (feature)".
    pattern: /\((capability|feature|Duration)\)/g,
    replace: (_match, kind) => {
      const kindTranslations = {
        capability: 'توانمندی',
        feature: 'ویژگی',
        Duration: 'مدت زمان',
      };
      return `(${kindTranslations[kind]})`;
    },
  },
  {
    // Capability names are derived from specs/ directory names (bom-registration,
    // bom-reporting, audit-logging, authentication) and title-cased by Serenity — with
    // inconsistent capitalisation across contexts ("Bom-registration" vs "Bom-Registration"),
    // so this matches case-insensitively rather than tag-bounded, since they also appear inside
    // compound tag labels like "Bom-Reporting > Duration Under 1 Second".
    pattern: /\bBom-registration\b/gi,
    replace: () => 'ثبت لیست مواد',
  },
  {
    pattern: /\bBom-reporting\b/gi,
    replace: () => 'گزارش‌گیری لیست مواد',
  },
  {
    pattern: /\bAudit-logging\b/gi,
    replace: () => 'گزارش رویدادها',
  },
  {
    pattern: /\bAuthentication\b/g,
    replace: () => 'احراز هویت',
  },
  {
    // "Serenity BDD version 4.2.34" (footer) — "Serenity BDD" is a product name, left as-is.
    pattern: /Serenity BDD version (\S+)/g,
    replace: (_match, version) => `نسخه ${version} از Serenity BDD`,
  },
  {
    // "8 pending test cases" (lowercase, distinct from the `title: 'Pending Test Cases'` JS
    // literal already handled) — only "pending" is confirmed in the current dataset, but the
    // other outcome words follow the same Serenity template shape, so all are covered.
    pattern:
      /(\d+)\s+(passing|pending|failing|skipped|ignored|aborted|broken|compromised|undefined)\s+test cases\b/g,
    replace: (_match, count, outcome) => {
      const outcomeTranslations = {
        passing: 'قبول شده',
        pending: 'در انتظار',
        failing: 'ناموفق',
        skipped: 'رد شده',
        ignored: 'نادیده گرفته شده',
        aborted: 'لغو شده',
        broken: 'خراب',
        compromised: 'مخدوش',
        undefined: 'تعریف نشده',
      };
      return `${count} مورد آزمون ${outcomeTranslations[outcome]}`;
    },
  },
  {
    // DataTables' own English defaults ("Showing 1 to 10 of 13 entries", "entries per page",
    // pagination labels) are never in the static HTML — they're datatables.min.js's built-in
    // fallback strings, only overridable by supplying a `language` object. Serenity's template
    // only ever sets `searchPlaceholder`/`search` here (matched loosely so this still fires
    // whether or not chart-labels.json's literal pass already translated `searchPlaceholder`),
    // so expand that object in place. The `_START_`/`_END_`/`_TOTAL_`/`_MENU_` tokens are
    // DataTables' own placeholder syntax — it substitutes them at render time, not us.
    // Naturally idempotent: once expanded, the block no longer ends in `search: ""}` with
    // nothing else before the closing brace, so this won't re-match on a second run.
    // The `language` key itself is inconsistently quoted across Serenity's own DataTable() calls
    // ("language": on some tables, language: on others), hence the optional quotes.
    pattern:
      /"?language"?:\s*\{\s*searchPlaceholder:\s*"[^"]*",\s*search:\s*""\s*\}/g,
    replace: () => `"language": {
                    searchPlaceholder: "فیلتر",
                    search: "",
                    info: "نمایش _START_ تا _END_ از _TOTAL_ ردیف",
                    infoEmpty: "هیچ رکوردی موجود نیست",
                    infoFiltered: "(فیلتر شده از مجموع _MAX_ رکورد)",
                    lengthMenu: "نمایش _MENU_ ردیف",
                    zeroRecords: "رکوردی یافت نشد",
                    paginate: {
                        first: "اول",
                        last: "آخر",
                        next: "بعدی",
                        previous: "قبلی"
                    }
                }`,
  },
  {
    // #test-results-table's DataTable() call has no `language` key at all (order/pageLength/
    // lengthMenu only), so it falls back entirely to DataTables' built-in English strings — the
    // rule above has nothing to expand. Inject a language object into it instead. `[^{}]*?`
    // (excluding braces, not just stopping at the first `}`) is what keeps this idempotent: the
    // original config has no nested `{`/`}` at all (its lengthMenu is a plain array), so this
    // matches only the pristine call; once the injected `language` object's own braces are
    // present, the pattern can no longer span the whole call and safely stops matching.
    pattern: /(\$\('#test-results-table'\)\.DataTable\(\{[^{}]*?)\}\);/g,
    replace: (_match, configBody) => `${configBody}, "language": {
                searchPlaceholder: "فیلتر",
                search: "",
                info: "نمایش _START_ تا _END_ از _TOTAL_ ردیف",
                infoEmpty: "هیچ رکوردی موجود نیست",
                infoFiltered: "(فیلتر شده از مجموع _MAX_ رکورد)",
                lengthMenu: "نمایش _MENU_ ردیف",
                zeroRecords: "رکوردی یافت نشد",
                paginate: {
                    first: "اول",
                    last: "آخر",
                    next: "بعدی",
                    previous: "قبلی"
                }
            } });`,
  },
  {
    // The lengthMenu dropdown's "show everything" option, e.g. [10, 25, 50, 100, 200, "All"].
    pattern: /"All"/g,
    replace: () => '"همه"',
  },
];

function applyDynamicPatterns(html) {
  let result = html;
  let changed = false;
  for (const { pattern, replace } of dynamicPatterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replace);
      changed = true;
    }
  }
  return { html: result, changed };
}

function brandHtmlFiles() {
  const translations = JSON.parse(
    readFileSync(join(brandingDir, 'translations.json'), 'utf8'),
  );
  const chartLabels = JSON.parse(
    readFileSync(join(brandingDir, 'chart-labels.json'), 'utf8'),
  );
  const htmlFiles = readdirSync(siteDir).filter((name) =>
    name.endsWith('.html'),
  );

  for (const file of htmlFiles) {
    const path = join(siteDir, file);
    let html = readFileSync(path, 'utf8');
    let changed = false;

    if (!/<html[^>]*\bdir=/.test(html)) {
      html = html.replace('<html>', '<html lang="fa" dir="rtl">');
      changed = true;
    }

    const extraLinks = [...stylesheetNames.map(rtlNameFor), 'branding-rtl.css']
      .filter((name) => !html.includes(`href="css/${name}"`))
      .map((name) => `    <link rel="stylesheet" href="css/${name}"/>`);
    if (extraLinks.length > 0) {
      html = html.replace('</head>', `${extraLinks.join('\n')}\n</head>`);
      changed = true;
    }

    for (const [english, persian] of Object.entries(translations)) {
      const pattern = tagBoundedPattern(english);
      if (pattern.test(html)) {
        // Preserve a single space wherever whitespace separated the phrase from its
        // neighbouring tag (e.g. an icon), instead of collapsing it away entirely.
        html = html.replace(
          pattern,
          (_match, open, leadWs, trailWs, close) =>
            `${open}${leadWs ? ' ' : ''}${persian}${trailWs ? ' ' : ''}${close}`,
        );
        changed = true;
      }
    }

    // Chart.js legend labels are JS string literals inside an inline <script>, not HTML text
    // nodes — a tag-bounded match can't reach them, so this is a plain, exact literal
    // substitution instead. Distinct casing from the CSS/DataTables-sort-key outcome words
    // (PENDING, SUCCESS, SKIPPED) means there's no overlap with those excluded strings.
    for (const [literal, translated] of Object.entries(chartLabels)) {
      if (html.includes(literal)) {
        html = html.split(literal).join(translated);
        changed = true;
      }
    }

    const dynamicResult = applyDynamicPatterns(html);
    html = dynamicResult.html;
    changed = changed || dynamicResult.changed;

    if (changed) {
      writeFileSync(path, html);
    }
  }
}

function main() {
  if (!existsSync(siteDir)) {
    console.error(
      `brand-living-documentation: ${siteDir} does not exist — run "serenity-bdd run" first.`,
    );
    process.exit(1);
  }

  swapLogo();
  writeMirroredStylesheetsAndFont();
  brandHtmlFiles();
}

main();

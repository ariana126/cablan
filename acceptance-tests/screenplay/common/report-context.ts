/**
 * Disambiguates a step whose TEXT is byte-identical across more than one feature area, where the
 * feature files themselves — read-only input — leave no room to reword either side. Mirrors
 * `screenplay/common/composition-context.ts`/`edit-target.ts`'s own shape and reasoning exactly.
 *
 * `reporting-bom.feature` and `reporting-standard-bom.feature` share several `Then`/`Given`/`When`
 * steps byte-for-byte ("لیست فقط شامل ستون های زیر باشد", "جزئیات اجزا و مواد اولیه به صورت زیر
 * نمایش داده شود", "متراژ استاندارد ... نمایش داده شود", "توضیحات ... نمایش داده شود", "جمع وزن مواد
 * اولیه ... نمایش داده شود", the "عدم انتخاب مقدار ... اعمال کرده باشد" precondition and its
 * "دوباره انتخاب می کند" counterpart, and "وزن مواد اولیه در فیلدهای قابل فیلتر نمایش داده نشود") —
 * see `step-definitions/bom-reporting/common.steps.ts`. "لیست"/"جزئیات" means the daily-BOM report
 * for one feature and the standard-BOM report for the other, each with its own screenplay module and
 * page, so the shared step definitions dispatch on whichever background last ran.
 *
 * Only `'bom'` is implemented so far (`reporting-bom.feature`'s own background sets it —
 * `step-definitions/bom-reporting/common.steps.ts`); `reporting-standard-bom.feature`'s own
 * background is still a `return 'pending'` stub, which is what keeps its scenarios from ever
 * reaching the `'standard-bom'` branch these shared steps don't implement yet. Whoever automates
 * that feature next should have its background call `setCurrentReportKind('standard-bom')`, the
 * same way `edit-target.ts`'s own comment asks BOTH owning `When`s to set the flag explicitly —
 * never just the non-default one — so a later scenario can never inherit a stale value left by an
 * earlier one in the same suite run.
 */
export type ReportKind = 'bom' | 'standard-bom';

let currentKind: ReportKind = 'bom';

export const setCurrentReportKind = (kind: ReportKind): void => {
  currentKind = kind;
};

export const currentReportKind = (): ReportKind => currentKind;

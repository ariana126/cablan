/**
 * Disambiguates a step whose TEXT is byte-identical across two feature areas, where the feature
 * files themselves — read-only input — leave no room to reword either side. Mirrors
 * `report-context.ts`/`edit-target.ts`'s shape and reasoning.
 *
 * `bom-reporting/reporting-bom.feature` and `bom-analyzing/bom-dashboard.feature` both say
 * "فقط آنالیز های روزانه با شماره سفارش «...» نمایش داده شود" and
 * "وضعیت تایید آنالیز های روزانه به صورت زیر نمایش داده شود" — of the daily-BOM report list in
 * one, of a product's daily-BOM panel on the dashboard in the other: two pages, two Lean Page
 * Objects. Cucumber matches by text alone, so the single shared definition
 * (`step-definitions/common.steps.ts`) dispatches on whichever feature's daily-BOM background last
 * ran. Both owning backgrounds set this explicitly — never just the non-default one — so a later
 * scenario can never inherit a stale value left by an earlier one in the same run.
 *
 * Not folded into `report-context.ts`: that one routes daily-BOM vs standard-BOM *reports*, and a
 * dashboard value there would fall into its `'bom'` branches by default.
 */
export type DailyBomListKind = 'report' | 'dashboard';

let currentKind: DailyBomListKind = 'report';

export const setCurrentDailyBomList = (kind: DailyBomListKind): void => {
  currentKind = kind;
};

export const currentDailyBomList = (): DailyBomListKind => currentKind;

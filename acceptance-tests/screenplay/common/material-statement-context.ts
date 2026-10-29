/**
 * Disambiguates «مواد اولیه «…» با کد «…» در سیستم ثبت شده باشد», byte-identical in two feature
 * areas with two meanings:
 *
 * - `bom-registration/importing-materials.feature` states it as an **outcome** («انتظار می رود
 *   مواد اولیه "آلومینیوم" با کد "A-1" در سیستم ثبت شده باشد») — check the system.
 * - `audit-logging/viewing-audit-log.feature` states it as a **precondition** («و مواد اولیه "روی"
 *   با کد "M-101" در سیستم ثبت شده باشد», an example of «<تغییر بعدی>») — make it true.
 *
 * Cucumber matches text alone and the feature files are read-only, so the one step definition
 * (`step-definitions/common.steps.ts`) dispatches on this. Both owning backgrounds set it
 * explicitly — importing-materials' «اینکه مواد اولیه زیر در سیستم ثبت شده باشند:» to `outcome`,
 * viewing-audit-log's «اینکه رویدادهای زیر در سیستم ثبت شده باشند:» to `precondition` — so no
 * scenario inherits a stale value. Same shape as `edit-target.ts`.
 */
export type MaterialStatementKind = 'outcome' | 'precondition';

let current: MaterialStatementKind = 'outcome';

export const statementsAboutMaterialsAre = (
  kind: MaterialStatementKind,
): void => {
  current = kind;
};

export const currentMaterialStatementKind = (): MaterialStatementKind =>
  current;

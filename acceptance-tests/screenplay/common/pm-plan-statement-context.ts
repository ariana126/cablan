/**
 * Disambiguates «فعالیت «…» با دوره «…» روز و اولین موعد «…» در برنامه تجهیز «…» باشد», which the
 * maintenance features state with two meanings:
 *
 * - as a **precondition** — every feature that states it continues a `Given` with it («و فعالیت …
 *   در برنامه تجهیز … باشد»), and importing-pm-plans does so before its upload — make it true (add
 *   the item, `pm-plan.ts#PutActivityInPmPlan`);
 * - as an **outcome** — importing-pm-plans (issue #127) after an upload («انتظار می رود فعالیت …
 *   در برنامه تجهیز … باشد», and its «و …» continuations) — check the plan: exactly one active row
 *   with that interval and first due date. Adding it there would be refused with a 409, the import
 *   having added it already.
 *
 * Cucumber matches text alone and the feature files are read-only, so the one step definition
 * (`step-definitions/maintenance-management/common.steps.ts`) dispatches on this. The owning steps
 * set it explicitly: maintenance's `Before` and every precondition of importing-pm-plans to
 * `precondition`, importing-pm-plans' uploads and its «تلاش …» attempt to `outcome` — so no
 * scenario inherits a stale value. Same shape as `material-statement-context.ts`.
 */
export type PmPlanStatementKind = 'outcome' | 'precondition';

let current: PmPlanStatementKind = 'precondition';

export const statementsAboutPmPlansAre = (kind: PmPlanStatementKind): void => {
  current = kind;
};

export const currentPmPlanStatementKind = (): PmPlanStatementKind => current;

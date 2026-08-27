/**
 * Disambiguates a step whose TEXT is byte-identical across more than one feature area, where the
 * feature files themselves — read-only input — leave no room to reword either side.
 *
 * `registring-standard-bom.feature`'s own "ویرایش آنالیز استاندارد" scenario and
 * `registring-bom.feature`'s own "ویرایش آنالیز روزانه" scenario both end in the exact generic
 * wording "اطلاعات ویرایش شده در سیستم ثبت شده باشد" (see
 * `step-definitions/bom-registration/common.steps.ts`), even though "اطلاعات ویرایش شده" means a
 * changed MI code for one and a changed order number for the other, each with its own screenplay
 * module (`edit-standard-bom.ts` vs `edit-bom.ts`). Cucumber matches by text alone, so the single
 * shared step definition dispatches on whichever owner's own edit `When` last set this — mirrors
 * `screenplay/common/composition-context.ts`'s shape and reasoning exactly, including its own
 * convention that BOTH owning `When`s set this explicitly (never just the non-default one), so a
 * later scenario can never inherit a stale value left by an earlier one in the same suite run.
 */
export type EditTargetKind = 'standard-bom' | 'bom';

let currentTarget: EditTargetKind = 'standard-bom';

export const setCurrentEditTarget = (target: EditTargetKind): void => {
  currentTarget = target;
};

export const currentEditTarget = (): EditTargetKind => currentTarget;

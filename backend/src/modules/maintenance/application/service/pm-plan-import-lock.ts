/**
 * Held by every PM plan import while it checks the file against the plans in
 * force and adds the new items (issue #127), so two imports run one after
 * the other: the second sees the first's items as already existing rather
 * than tripping over them.
 */
export const PM_PLAN_IMPORT_LOCK = 'maintenance:pm-plan-import';

/**
 * Whether the actor in the spotlight last acted on an equipment's folder (`/pm-plans/:equipmentId`)
 * in the browser — the one fact that tells the «… فعالیت های غیرفعال تجهیز …» readings apart.
 * After «رضازاده فعالیت … را در برنامه تجهیز … غیرفعال می کند» (or an add through the folder) the
 * folder is still open, so the inactive list is read off its «فعالیت‌های غیرفعال» sheet, as the
 * visitor sees it; after only preconditions or a «تلاش …» API attempt, nobody has the folder open
 * and the same sentence is read from `GET equipment/:id`'s `inactivePlanItems`.
 *
 * Set explicitly by every owning step (`step-definitions/maintenance-management/
 * planning-preventive-maintenance.steps.ts`), and reset before every scenario
 * (`step-definitions/maintenance-management/common.steps.ts`), so no scenario inherits another's.
 */
export type PmPlanFolderView = 'none' | 'folder-page';

let current: PmPlanFolderView = 'none';

export const lookedAtPmPlanFolder = (view: PmPlanFolderView): void => {
  current = view;
};

export const lastPmPlanFolderView = (): PmPlanFolderView => current;

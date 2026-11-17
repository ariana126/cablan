import { Task } from '@serenity-js/core';
import { LocatePage } from '../maintenance-management/maintenance-pages';
import { QcActivitiesPage } from '../ui/qc-activities-page';
import { QcInspectionPage } from '../ui/qc-inspection-page';

/**
 * Getting to the QC pages the suite drives, and waiting for them. Each starts a real browser
 * session first, on the system's clock: a «… وارد سیستم شده باشد» only authenticates the actor's
 * API ability (`maintenance-management/maintenance-pages.ts#LocatePage`).
 */

export const LocateQcActivitiesPage = (): Task =>
  LocatePage(
    '#actor locates the QC activities page',
    '/qc-activities',
    QcActivitiesPage.heading(),
  );

export const LocateQcInspectionPage = (): Task =>
  LocatePage(
    '#actor locates the QC inspection page',
    '/qc-inspection',
    QcInspectionPage.heading(),
  );

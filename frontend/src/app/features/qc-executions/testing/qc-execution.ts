import { AppQcExecution } from '../../../core/qc/qc-executions-gateway';

/** One QC record for specs: 1405/07/02 12:20 in Tehran, a day, three hours and twenty minutes after
 * the one before it, with two lines of notes. */
export const EXECUTION: AppQcExecution = {
  id: 'x2',
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  activityId: 'q1',
  activityName: 'بازرسی ابعادی',
  performedById: 'u1',
  performedByName: 'نیکروش',
  performedAt: '2026-09-24T08:50:00.000Z',
  trackingNumber: 'TR-101',
  notes: 'خراش جزئی\nروی سطح',
  previousPerformedAt: '2026-09-23T05:30:00.000Z',
  intervalMinutes: 24 * 60 + 3 * 60 + 20,
};

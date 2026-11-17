/**
 * Which tracking number «پیغام خطای شماره ردیابی نشان داده شود» speaks of — the one byte-identical
 * sentence two areas use (issue #119). In registring-bom it follows the daily-BOM form left without
 * a tracking number («شماره ردیابی را خالی میگذارد», «… شماره ردیابی آن را پاک می کند»), so it is
 * the form's field error; in recording-qc-execution it follows a QC record attempted over the API
 * with a blank one, so it is the 400 `validation-error` on `trackingNumber`.
 *
 * Set explicitly by every owning step, so no scenario inherits another's.
 */
export type TrackingNumberSubject = 'daily-bom-form' | 'qc-record';

let current: TrackingNumberSubject = 'daily-bom-form';

export const trackingNumberTypedFor = (
  subject: TrackingNumberSubject,
): void => {
  current = subject;
};

export const theTrackingNumberLastTyped = (): TrackingNumberSubject => current;

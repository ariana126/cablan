/**
 * What the byte-identical «پیغام خطای کد MI نشان داده شود» is said of. registring-standard-bom says
 * it after a standard BOM's MI code was left empty or cleared in the form (`standard-bom-form`);
 * registring-bom (issue #101) after a daily BOM was registered over the API for an order with
 * several MI codes and none chosen (`daily-bom-registration`, 400 `bom-mi-code-required`).
 *
 * Set explicitly by every owning step, so no scenario inherits another's.
 */
export type MiCodeErrorSource = 'standard-bom-form' | 'daily-bom-registration';

let current: MiCodeErrorSource = 'standard-bom-form';

export const theMiCodeErrorIsAbout = (source: MiCodeErrorSource): void => {
  current = source;
};

export const whatTheMiCodeErrorIsAbout = (): MiCodeErrorSource => current;

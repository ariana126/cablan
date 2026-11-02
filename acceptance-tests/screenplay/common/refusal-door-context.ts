/**
 * Which door the actor in the spotlight last tried to change or delete a record through — the one
 * fact that tells the «به او گفته شود که … استفاده شده است» readings apart (issue #94). After a
 * browser attempt (bom-registration's «… تلاش می کند … را حذف کند / … تغییر دهد», driven through the
 * list pages) the dialog is still open, so what the visitor was told is read off its alert; after
 * an API attempt (resampling-bom's and maintenance-management's «تلاش …», which this suite drives
 * over HTTP) it is read from the 409 `record-has-dependents` response's `dependents`.
 *
 * Set explicitly by every owning step, so no scenario inherits another's.
 */
export type RefusalDoor = 'browser' | 'api';

let current: RefusalDoor = 'api';

export const triedThrough = (door: RefusalDoor): void => {
  current = door;
};

export const lastRefusalDoor = (): RefusalDoor => current;

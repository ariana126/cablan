/**
 * Which door the last change of an order went through — the one fact that tells the two readings of
 * «پیغام خطای شماره سفارش تکراری نشان داده شود» apart (issue #101). After the «تلاش …» definition
 * with a taken number (driven over HTTP) it is the 409 `order-number-taken`; after the System
 * Admin's correction onto a taken number (driven through `/orders`' edit dialog) it is what that
 * still-open dialog says.
 *
 * Kept apart from `refusal-door-context.ts`, which says the same of «… استفاده شده است»: one module
 * per meaning (`acceptance-tests/CLAUDE.md`). Set explicitly by every owning step.
 */
export type OrderDoor = 'browser' | 'api';

let current: OrderDoor = 'api';

export const theOrderWasChangedThrough = (door: OrderDoor): void => {
  current = door;
};

export const theDoorTheOrderWasChangedThrough = (): OrderDoor => current;

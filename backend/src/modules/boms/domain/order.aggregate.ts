import { AggregateRoot, Identity, toAsciiDigits } from '@framework/domain';

import { OrderSnapshot } from './events/order.snapshot';
import { OrderDefined } from './events/order-defined.event';
import { OrderDeleted } from './events/order-deleted.event';
import { OrderEdited, OrderFieldChange } from './events/order-edited.event';
import { OrderMiCodeAdded } from './events/order-mi-code-added.event';
import { BomMiCodeNotInOrder } from './exceptions/bom-mi-code-not-in-order.exception';
import { BomMiCodeRequired } from './exceptions/bom-mi-code-required.exception';
import { OrderMiCodeAlreadyAssigned } from './exceptions/order-mi-code-already-assigned.exception';
import { OrderMiCode } from './value/order-mi-code.vo';
import { OrderNumber } from './value/order-number.vo';

/**
 * An order («سفارش», issue #101): a unique order number with the MI codes
 * (standard BOMs) assigned to it, in assignment order — at least one, none
 * twice. A daily BOM is registered for a defined order with one of its MI
 * codes; it links to the order by the order number it stores, not by an id
 * (ADR 0004's snapshot convention), which is why renumbering an order in
 * use is a System Admin correction carried into its daily BOMs.
 *
 * The uniqueness of the order number is the application's check (and the
 * database's backstop), not the aggregate's: it needs the other orders.
 */
export class Order extends AggregateRoot {
  private constructor(
    id: Identity,
    private _orderNumber: OrderNumber,
    private _miCodes: readonly OrderMiCode[],
  ) {
    super(id);
  }

  // Set by `delete()`: the repository's `modify()` then deletes the order
  // rather than saving it.
  private _deleted = false;

  public static define(
    orderNumber: OrderNumber,
    miCodes: readonly OrderMiCode[],
  ): Order {
    Order.assertValidMiCodes(miCodes);
    const order = new Order(Identity.new(), orderNumber, [...miCodes]);
    order.recordThat(new OrderDefined(order.id.asString(), order.snapshot()));
    return order;
  }

  /** Rehydrates an order from storage; records no event. */
  public static fromPersistence(
    id: Identity,
    orderNumber: OrderNumber,
    miCodes: readonly OrderMiCode[],
  ): Order {
    return new Order(id, orderNumber, [...miCodes]);
  }

  /**
   * Assigns one more MI code, after the ones the order has. Never guarded by
   * the order's daily BOMs: adding a code changes none of them.
   */
  public addMiCode(miCode: OrderMiCode): void {
    Order.assertValidMiCodes([...this._miCodes, miCode]);
    this._miCodes = [...this._miCodes, miCode];
    this.recordThat(
      new OrderMiCodeAdded(
        this.id.asString(),
        this._orderNumber.asString(),
        miCode.miCode(),
        miCode.productName(),
      ),
    );
  }

  /**
   * Renumbers the order and replaces its MI codes wholesale; records one
   * `OrderEdited` with a line per field that changed, or nothing when
   * nothing did. MI codes naming the same standard BOMs as the order's — in
   * whatever order — are no change: the order keeps its own, snapshots and
   * assignment order included. A refused edit changes nothing.
   */
  public edit(
    orderNumber: OrderNumber,
    newMiCodes: readonly OrderMiCode[],
  ): void {
    Order.assertValidMiCodes(newMiCodes);
    const miCodes = this.assignsExactly(newMiCodes)
      ? this._miCodes
      : newMiCodes;
    const changes: OrderFieldChange[] = [];
    if (!orderNumber.equals(this._orderNumber)) {
      changes.push({
        field: 'orderNumber',
        previousValue: this._orderNumber.asString(),
        newValue: orderNumber.asString(),
      });
    }
    const previousCodes = Order.listOf(this._miCodes);
    const newCodes = Order.listOf(miCodes);
    if (previousCodes !== newCodes) {
      changes.push({
        field: 'miCodes',
        previousValue: previousCodes,
        newValue: newCodes,
      });
    }
    this._orderNumber = orderNumber;
    this._miCodes = [...miCodes];
    if (changes.length > 0) {
      this.recordThat(
        new OrderEdited(this.id.asString(), orderNumber.asString(), changes),
      );
    }
  }

  /**
   * Whether an edit giving these MI codes (`undefined` = left as they are)
   * changes nothing but the order number — the one field a System Admin may
   * correct on an order in use (issue #110). The same test `edit()` applies:
   * the same set of standard BOMs, in whatever order, is no change.
   */
  public changesOnlyCorrectableFields(
    miCodes?: readonly OrderMiCode[],
  ): boolean {
    return miCodes === undefined || this.assignsExactly(miCodes);
  }

  /**
   * The MI code a daily BOM is registered with for this order (issue #101):
   * the one chosen (as typed; Persian digits read as English ones), which
   * must be one of the order's; or, when none is chosen, the order's only
   * one — a choice is required among several.
   */
  public miCodeForDailyBom(typedMiCode?: string): OrderMiCode {
    if (typedMiCode === undefined) {
      const [only, ...others] = this._miCodes;
      if (others.length > 0) {
        throw BomMiCodeRequired.forOrder(this._orderNumber);
      }
      return only;
    }
    const chosen = this.miCodeNamed(typedMiCode);
    if (chosen === null) {
      throw BomMiCodeNotInOrder.of(typedMiCode, this._orderNumber);
    }
    return chosen;
  }

  /**
   * A daily BOM moved onto this order (its order number edited) must keep
   * to a standard BOM the order holds; `miCode` names it in the refusal.
   */
  public assertHoldsStandardBom(standardBomId: Identity, miCode: string): void {
    if (this.miCodeOfStandardBom(standardBomId) === null) {
      throw BomMiCodeNotInOrder.of(miCode, this._orderNumber);
    }
  }

  /**
   * A daily BOM of this order re-pointed from one MI code to another
   * (issue #101): both must be the order's, and of the same product — read
   * from the order's own snapshots, since a daily BOM keeps only its
   * product's name. `toMiCode` names the new one in the refusal.
   */
  public assertPermitsRepointing(
    fromStandardBomId: Identity,
    toStandardBomId: Identity,
    toMiCode: string,
  ): void {
    const from = this.miCodeOfStandardBom(fromStandardBomId);
    const to = this.miCodeOfStandardBom(toStandardBomId);
    if (
      from === null ||
      to === null ||
      !from.productId().equals(to.productId())
    ) {
      throw BomMiCodeNotInOrder.of(toMiCode, this._orderNumber);
    }
  }

  public delete(): void {
    this._deleted = true;
    this.recordThat(new OrderDeleted(this.id.asString(), this.snapshot()));
  }

  /** Whether `delete()` was called — what `OrderRepository.modify()` persists. */
  public isDeleted(): boolean {
    return this._deleted;
  }

  public orderNumber(): OrderNumber {
    return this._orderNumber;
  }

  public miCodes(): readonly OrderMiCode[] {
    return this._miCodes;
  }

  /** The assigned MI code with this code (Persian digits read as English ones), if any. */
  public miCodeNamed(typedMiCode: string): OrderMiCode | null {
    const code = toAsciiDigits(typedMiCode);
    return this._miCodes.find((miCode) => miCode.miCode() === code) ?? null;
  }

  /** The assigned MI code naming this standard BOM, if any. */
  public miCodeOfStandardBom(standardBomId: Identity): OrderMiCode | null {
    return (
      this._miCodes.find((miCode) => miCode.isOfStandardBom(standardBomId)) ??
      null
    );
  }

  // The same set of standard BOMs as the order's, in whatever order.
  private assignsExactly(miCodes: readonly OrderMiCode[]): boolean {
    const given = new Set(
      miCodes.map((miCode) => miCode.standardBomId().asString()),
    );
    return (
      given.size === this._miCodes.length &&
      this._miCodes.every((miCode) =>
        given.has(miCode.standardBomId().asString()),
      )
    );
  }

  private snapshot(): OrderSnapshot {
    return {
      orderNumber: this._orderNumber.asString(),
      miCodes: this._miCodes.map((miCode) => ({
        miCode: miCode.miCode(),
        productName: miCode.productName(),
      })),
    };
  }

  private static listOf(miCodes: readonly OrderMiCode[]): string {
    return miCodes.map((miCode) => miCode.miCode()).join(', ');
  }

  private static assertValidMiCodes(miCodes: readonly OrderMiCode[]): void {
    if (miCodes.length === 0) {
      throw new Error('An order must have at least one MI code');
    }
    const seen: OrderMiCode[] = [];
    for (const miCode of miCodes) {
      if (seen.some((other) => other.isOfStandardBom(miCode.standardBomId()))) {
        throw OrderMiCodeAlreadyAssigned.withMiCode(miCode.miCode());
      }
      seen.push(miCode);
    }
  }
}

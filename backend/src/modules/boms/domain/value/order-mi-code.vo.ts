import { Identity, ValueObject } from '@framework/domain';

/**
 * One MI code assigned to an order («تخصیص کد MI»): the standard BOM it
 * names, and a snapshot of that standard BOM's MI code and its product's id
 * and name, taken when it was assigned (ADR 0004) — so the orders list reads
 * without a live join into `manufacturing-instructions`, and a daily BOM's
 * MI-code change can be held to the same product. The standard BOM's id is
 * what identifies it: an order holds a standard BOM at most once.
 */
export class OrderMiCode extends ValueObject {
  private constructor(
    private readonly _standardBomId: Identity,
    private readonly _miCode: string,
    private readonly _productId: Identity,
    private readonly _productName: string,
  ) {
    super();
  }

  static of(
    standardBomId: Identity,
    miCode: string,
    productId: Identity,
    productName: string,
  ): OrderMiCode {
    return new OrderMiCode(standardBomId, miCode, productId, productName);
  }

  public standardBomId(): Identity {
    return this._standardBomId;
  }

  public miCode(): string {
    return this._miCode;
  }

  public productId(): Identity {
    return this._productId;
  }

  public productName(): string {
    return this._productName;
  }

  public isOfStandardBom(standardBomId: Identity): boolean {
    return this._standardBomId.equals(standardBomId);
  }
}

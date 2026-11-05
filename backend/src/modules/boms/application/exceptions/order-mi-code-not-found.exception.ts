import { ApplicationException } from '@framework/application';

// An MI code assigned to an order names no standard BOM — a defect in the
// request's content, so a 400, like `BomStandardBomNotFound`.
export class OrderMiCodeNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly miCode: string,
  ) {
    super(message);
  }

  public static withMiCode(miCode: string): OrderMiCodeNotFound {
    return new OrderMiCodeNotFound(
      `No standard BOM exists with MI code ${miCode}`,
      miCode,
    );
  }
}

import { ApplicationException } from '@framework/application';

// Thrown when the `productId` a standard BOM registration or edit names does
// not resolve to an existing product — translated from `GetProductQuery`'s
// `EntityNotFound` (a generic 404 from products' own point of view) into a
// 400 here, since a bad `productId` in *this* request's own body is a defect
// in the request's content, not a conflict with existing state. See
// `StandardBomCompositionFactory` and src/modules/standard-boms/CLAUDE.md.
export class StandardBomProductNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly productId: string,
  ) {
    super(message);
  }

  public static withId(productId: string): StandardBomProductNotFound {
    return new StandardBomProductNotFound(
      `No product exists with id ${productId}`,
      productId,
    );
  }
}

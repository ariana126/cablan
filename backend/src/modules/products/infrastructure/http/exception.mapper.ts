import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import {
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';

// Maps this module's own invariants. `ProductCompositionFactory` can also
// surface `ComponentNameAlreadyExists`/`MaterialNameAlreadyExists` while
// creating a component's/material's master row on a product's behalf, but
// those need no case here: `HttpExceptionFilter`'s chain matches by
// exception type regardless of which module's request path threw it, so
// `ComponentsExceptionMapper`/`MaterialsExceptionMapper` — already
// registered — map them into the same problem-detail shape their own
// controllers use. Duplicating that here would be exactly the
// reimplementation `ProductCompositionFactory`'s own doc comment says this
// module avoids. "Name-empty" needs no case either — `RegisterProductDto`/
// `UpdateProductDto` validate nested component/material names with
// class-validator before the factory ever builds a `ComponentName`/
// `MaterialName` from one, so an empty name is an ordinary 400 validation
// error, not a domain exception. See src/modules/products/CLAUDE.md.
export class ProductsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof ProductMustHaveAtLeastOneComponent ||
      exception instanceof ProductComponentMustHaveAtLeastOneMaterial ||
      exception instanceof ProductCompositionEntryNotFound
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof ProductMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'product-must-have-at-least-one-component',
          'Product Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof ProductComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'product-component-must-have-at-least-one-material',
          'Product Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentName: exception.componentName },
        );
      }

      case exception instanceof ProductCompositionEntryNotFound: {
        return new ProblemDetail(
          'product-composition-entry-not-found',
          'Product Composition Entry Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { entryId: exception.entryId },
        );
      }

      default: {
        throw new RuntimeException(
          `Unexpected exception type: ${String(exception)}`,
        );
      }
    }
  }
}

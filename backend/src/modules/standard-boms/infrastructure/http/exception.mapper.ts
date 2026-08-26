import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import {
  StandardBomComponentMustHaveAtLeastOneMaterial,
  StandardBomCompositionEntryNotFound,
  StandardBomMiCodeAlreadyExists,
  StandardBomMustHaveAtLeastOneComponent,
  StandardBomProductNotFound,
} from '@standard-boms/application/exceptions';

export class StandardBomsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof StandardBomMiCodeAlreadyExists ||
      exception instanceof StandardBomMustHaveAtLeastOneComponent ||
      exception instanceof StandardBomComponentMustHaveAtLeastOneMaterial ||
      exception instanceof StandardBomProductNotFound ||
      exception instanceof StandardBomCompositionEntryNotFound
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof StandardBomMiCodeAlreadyExists: {
        return new ProblemDetail(
          'standard-bom-mi-code-already-exists',
          'Standard BOM MI Code Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { miCode: exception.miCode.asString() },
        );
      }

      case exception instanceof StandardBomMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'standard-bom-must-have-at-least-one-component',
          'Standard BOM Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof
        StandardBomComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'standard-bom-component-must-have-at-least-one-material',
          'Standard BOM Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentId: exception.componentId },
        );
      }

      case exception instanceof StandardBomProductNotFound: {
        return new ProblemDetail(
          'standard-bom-product-not-found',
          'Standard BOM Product Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { productId: exception.productId },
        );
      }

      case exception instanceof StandardBomCompositionEntryNotFound: {
        return new ProblemDetail(
          'standard-bom-composition-entry-not-found',
          'Standard BOM Composition Entry Not Found',
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

import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomCompositionEntryNotFound,
  BomMustHaveAtLeastOneComponent,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class BomsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof BomMustHaveAtLeastOneComponent ||
      exception instanceof BomComponentMustHaveAtLeastOneMaterial ||
      exception instanceof BomStandardBomNotFound ||
      exception instanceof BomCompositionEntryNotFound
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof BomMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'bom-must-have-at-least-one-component',
          'BOM Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof BomComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'bom-component-must-have-at-least-one-material',
          'BOM Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentId: exception.componentId },
        );
      }

      case exception instanceof BomStandardBomNotFound: {
        return new ProblemDetail(
          'bom-standard-bom-not-found',
          'BOM Standard BOM Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { standardBomMiCode: exception.standardBomMiCode },
        );
      }

      case exception instanceof BomCompositionEntryNotFound: {
        return new ProblemDetail(
          'bom-composition-entry-not-found',
          'BOM Composition Entry Not Found',
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

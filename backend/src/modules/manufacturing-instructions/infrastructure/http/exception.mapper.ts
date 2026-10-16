import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import {
  ManufacturingInstructionComponentMustHaveAtLeastOneMaterial,
  ManufacturingInstructionCompositionEntryNotFound,
  ManufacturingInstructionMiCodeAlreadyExists,
  ManufacturingInstructionMustHaveAtLeastOneComponent,
  ManufacturingInstructionProductNotFound,
} from '@manufacturing-instructions/application/exceptions';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class ManufacturingInstructionsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof ManufacturingInstructionMiCodeAlreadyExists ||
      exception instanceof
        ManufacturingInstructionMustHaveAtLeastOneComponent ||
      exception instanceof
        ManufacturingInstructionComponentMustHaveAtLeastOneMaterial ||
      exception instanceof ManufacturingInstructionProductNotFound ||
      exception instanceof ManufacturingInstructionCompositionEntryNotFound
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof ManufacturingInstructionMiCodeAlreadyExists: {
        return new ProblemDetail(
          'standard-bom-mi-code-already-exists',
          'Standard BOM MI Code Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { miCode: exception.miCode.asString() },
        );
      }

      case exception instanceof
        ManufacturingInstructionMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'standard-bom-must-have-at-least-one-component',
          'Standard BOM Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof
        ManufacturingInstructionComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'standard-bom-component-must-have-at-least-one-material',
          'Standard BOM Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentId: exception.componentId },
        );
      }

      case exception instanceof ManufacturingInstructionProductNotFound: {
        return new ProblemDetail(
          'standard-bom-product-not-found',
          'Standard BOM Product Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { productId: exception.productId },
        );
      }

      case exception instanceof
        ManufacturingInstructionCompositionEntryNotFound: {
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

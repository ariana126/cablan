import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomCompositionEntryNotFound,
  BomMustHaveAtLeastOneComponent,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { BomAlreadyReviewed } from '@boms/domain/exceptions/bom-already-reviewed.exception';
import { RejectionReasonRequired } from '@boms/domain/exceptions/rejection-reason-required.exception';
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class BomsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof BomMustHaveAtLeastOneComponent ||
      exception instanceof BomComponentMustHaveAtLeastOneMaterial ||
      exception instanceof BomStandardBomNotFound ||
      exception instanceof BomCompositionEntryNotFound ||
      exception instanceof BomAlreadyReviewed ||
      exception instanceof RejectionReasonRequired
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

      // Approving or rejecting a BOM that is already approved or rejected: a
      // conflict with its current state, which only an edit resolves.
      case exception instanceof BomAlreadyReviewed: {
        return new ProblemDetail(
          'bom-already-reviewed',
          'BOM Already Reviewed',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { approvalStatus: exception.approvalStatus },
        );
      }

      case exception instanceof RejectionReasonRequired: {
        return new ProblemDetail(
          'rejection-reason-required',
          'Rejection Reason Required',
          HttpStatus.BAD_REQUEST,
          exception.message,
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

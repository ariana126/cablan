import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomCompositionEntryNotFound,
  BomMustHaveAtLeastOneComponent,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { BomAlreadyReviewed } from '@boms/domain/exceptions/bom-already-reviewed.exception';
import { BomNotResamplable } from '@boms/domain/exceptions/bom-not-resamplable.exception';
import { EditReasonRequired } from '@boms/domain/exceptions/edit-reason-required.exception';
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
      exception instanceof RejectionReasonRequired ||
      exception instanceof BomNotResamplable ||
      exception instanceof EditReasonRequired
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

      // An edit that changes something must say why; nothing was changed.
      case exception instanceof EditReasonRequired: {
        return new ProblemDetail(
          'edit-reason-required',
          'Edit Reason Required',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      // Re-sampling a daily BOM that is not rejected, or not the latest of its
      // tracking number: a conflict with the current state, like a review of
      // an already reviewed BOM.
      case exception instanceof BomNotResamplable: {
        return new ProblemDetail(
          'bom-not-resamplable',
          'BOM Not Resamplable',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          {
            approvalStatus: exception.approvalStatus,
            reason: exception.reason,
          },
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

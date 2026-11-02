import { RecordHasDependents } from '@framework/application';
import { EntityNotFound } from '@framework/domain';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

import { ExceptionMapper } from './exception-mapper.interface';
import { ProblemDetail } from './problem-detail';

export class FrameworkExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof HttpException ||
      exception instanceof BadRequestException ||
      exception instanceof EntityNotFound ||
      exception instanceof RecordHasDependents
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof BadRequestException: {
        const res = exception.getResponse() as {
          message: Array<{ field: string; message: string }>;
        };
        return new ProblemDetail(
          'validation-error',
          'Validation Error',
          HttpStatus.BAD_REQUEST,
          'One or more fields failed validation.',
          undefined,
          { errors: res.message },
        );
      }

      case exception instanceof HttpException: {
        return ProblemDetail.fromHttpException(exception);
      }

      case exception instanceof EntityNotFound: {
        return new ProblemDetail(
          'entity-not-found',
          'Entity not found',
          HttpStatus.NOT_FOUND,
          exception.message,
          undefined,
          {
            entityId: exception.identifier,
          },
        );
      }

      // Issue #94's one rule, mapped once for every module: whatever record
      // another record references, the refusal reads the same.
      case exception instanceof RecordHasDependents: {
        return new ProblemDetail(
          'record-has-dependents',
          'Record has dependents',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          {
            recordType: exception.reference.type,
            dependents: exception.dependents,
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

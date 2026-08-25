import { ComponentNameAlreadyExists } from '@components/application/exceptions';
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class ComponentsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return exception instanceof ComponentNameAlreadyExists;
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    if (exception instanceof ComponentNameAlreadyExists) {
      return new ProblemDetail(
        'component-name-already-exists',
        'Component Name Already Exists',
        HttpStatus.CONFLICT,
        exception.message,
        undefined,
        { name: exception.componentName.asString() },
      );
    }

    throw new RuntimeException(
      `Unexpected exception type: ${String(exception)}`,
    );
  }
}

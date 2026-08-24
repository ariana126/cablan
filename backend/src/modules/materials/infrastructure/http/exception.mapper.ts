import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { MaterialNameAlreadyExists } from '@materials/application/exceptions';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class MaterialsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return exception instanceof MaterialNameAlreadyExists;
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    if (exception instanceof MaterialNameAlreadyExists) {
      return new ProblemDetail(
        'material-name-already-exists',
        'Material Name Already Exists',
        HttpStatus.CONFLICT,
        exception.message,
        undefined,
        { name: exception.materialName.asString() },
      );
    }

    throw new RuntimeException(
      `Unexpected exception type: ${String(exception)}`,
    );
  }
}

import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import {
  CannotChangeOwnRole,
  InvalidCredentials,
  UsernameAlreadyExists,
} from '@identity/application/exceptions';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class IdentityExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof UsernameAlreadyExists ||
      exception instanceof CannotChangeOwnRole ||
      exception instanceof InvalidCredentials
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof UsernameAlreadyExists: {
        return new ProblemDetail(
          'username-already-exists',
          'Username Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { username: exception.username.asString() },
        );
      }

      case exception instanceof CannotChangeOwnRole: {
        return new ProblemDetail(
          'cannot-change-own-role',
          'Cannot Change Own Role',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { userId: exception.userId.asString() },
        );
      }

      case exception instanceof InvalidCredentials: {
        return new ProblemDetail(
          'invalid-credentials',
          'Invalid Credentials',
          HttpStatus.UNAUTHORIZED,
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

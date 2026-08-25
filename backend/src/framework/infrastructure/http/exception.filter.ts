import { ComponentsExceptionMapper } from '@components/infrastructure/http/exception.mapper';
import { IdentityExceptionMapper } from '@identity/infrastructure/http/exception.mapper';
import { MaterialsExceptionMapper } from '@materials/infrastructure/http/exception.mapper';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

import { FrameworkExceptionMapper } from './exception.mapper';
import { ExceptionMapper } from './exception-mapper.interface';
import { ProblemDetail } from './problem-detail';

// Framework first, then each module's own mapper — register a new module's mapper here (see
// backend/CLAUDE.md's "Exception Handling" section, step 3).
const ExceptionMappers: ExceptionMapper[] = [
  new FrameworkExceptionMapper(),
  new IdentityExceptionMapper(),
  new MaterialsExceptionMapper(),
  new ComponentsExceptionMapper(),
];

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const problemDetail: ProblemDetail = this.getProblemDetail(exception);
    return response
      .status(problemDetail.status)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetail.asResponseBody());
  }

  private getProblemDetail(exception: unknown): ProblemDetail {
    for (const mapper of ExceptionMappers) {
      if (!mapper.canMap(exception)) {
        continue;
      }
      return mapper.toProblemDetail(exception);
    }
    return ProblemDetail.forUnknownError();
  }
}

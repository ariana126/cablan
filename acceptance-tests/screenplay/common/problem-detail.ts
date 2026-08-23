import {
  Answerable,
  d,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import {
  contain,
  Ensure,
  equals,
  isPresent,
  startsWith,
} from '@serenity-js/assertions';
import { LastResponse } from '@serenity-js/rest';

const problemTypeBaseUrl = 'https://my-api-doc.dev/problems';

export interface ProblemDetailBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Array<{ field: string; message: string }>;
}

export const problemTypeFor = (slug: string): string =>
  `${problemTypeBaseUrl}/${slug}`;

/**
 * The RFC 9457 envelope, asserted once for every error response.
 * Asserts `type` rather than `detail`, since `detail` is optional per the RFC.
 */
export const EnsureProblemDetail = (status: number, slug: string): Task =>
  Task.where(
    `#actor ensures the response is a "${slug}" problem detail`,
    Ensure.that(LastResponse.status(), equals(status)),
    Ensure.that(
      LastResponse.header('content-type'),
      startsWith('application/problem+json'),
    ),
    Ensure.that(
      LastResponse.body<ProblemDetailBody>().type,
      equals(problemTypeFor(slug)),
    ),
    Ensure.that(LastResponse.body<ProblemDetailBody>().title, isPresent()),
    Ensure.that(LastResponse.body<ProblemDetailBody>().status, equals(status)),
  );

export const FieldsThatFailedValidation = (): QuestionAdapter<string[]> =>
  Question.about('the fields that failed validation', async (actor) => {
    const body = await actor.answer(LastResponse.body<ProblemDetailBody>());
    return (body.errors ?? []).map((error) => error.field);
  });

/**
 * The backend reports weak passwords, invalid emails and missing data all as the same
 * `validation-error` problem type — the offending field is what tells them apart.
 */
export const EnsureValidationErrorFor = (field: Answerable<string>): Task =>
  Task.where(
    d`#actor ensures validation failed for ${field}`,
    EnsureProblemDetail(400, 'validation-error'),
    Ensure.that(FieldsThatFailedValidation(), contain(field)),
  );

/**
 * A caller without the required role is turned away by `RolesGuard`
 * (`backend/src/framework/infrastructure/http/roles.guard.ts`), which throws a plain NestJS
 * `ForbiddenException` rather than a mapped domain/application exception. `FrameworkExceptionMapper`
 * handles that generically via `ProblemDetail.fromHttpException`, which leaves `typeUri` at its
 * `about:blank` default — there is no `access-denied` slug on the wire (yet: a future
 * identity-specific exception could change this, at which point this task is what needs
 * updating). So this deliberately does **not** build on `EnsureProblemDetail`, whose `slug`
 * parameter always expects a `TYPE_BASE_URL`-prefixed value.
 */
export const EnsureAccessWasDenied = (): Task =>
  Task.where(
    '#actor ensures access was denied',
    Ensure.that(LastResponse.status(), equals(403)),
    Ensure.that(
      LastResponse.header('content-type'),
      startsWith('application/problem+json'),
    ),
    Ensure.that(
      LastResponse.body<ProblemDetailBody>().type,
      equals('about:blank'),
    ),
  );

import { Identity } from '@framework/domain';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';

import { ActorContextMiddleware } from './actor-context.middleware';

function makeSut() {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const sut = new ActorContextMiddleware(jwtService);
  return { sut, jwtService };
}

function requestWithAuthorization(header: string | undefined): Request {
  return {
    headers: header === undefined ? {} : { authorization: header },
  } as unknown as Request;
}

describe('ActorContextMiddleware', () => {
  it("makes the token's sub claim available to code running later in the same request", () => {
    const { sut, jwtService } = makeSut();
    const userId = Identity.new().asString();
    const token = jwtService.sign({ sub: userId });
    let seenUserId: string | null = null;

    sut.use(requestWithAuthorization(`Bearer ${token}`), {} as Response, () => {
      seenUserId = sut.currentUserId()?.asString() ?? null;
    });

    expect(seenUserId).toBe(userId);
  });

  it('calls next() and records no actor when there is no Authorization header', () => {
    const { sut } = makeSut();
    const next = jest.fn();

    sut.use(requestWithAuthorization(), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sut.currentUserId()).toBeNull();
  });

  it('calls next() and records no actor when the Authorization header is not a Bearer token', () => {
    const { sut } = makeSut();
    const next = jest.fn();

    sut.use(requestWithAuthorization('Basic abc123'), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sut.currentUserId()).toBeNull();
  });

  it('calls next() without throwing when the token cannot be decoded', () => {
    const { sut } = makeSut();
    const next = jest.fn();

    sut.use(
      requestWithAuthorization('Bearer not-a-valid-jwt'),
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("records no actor for a token whose 'sub' claim is empty", () => {
    const { sut, jwtService } = makeSut();
    const token = jwtService.sign({ sub: '' });
    let seenUserId: Identity | null = Identity.new();

    sut.use(requestWithAuthorization(`Bearer ${token}`), {} as Response, () => {
      seenUserId = sut.currentUserId();
    });

    expect(seenUserId).toBeNull();
  });

  it('currentUserId() returns null outside of any request', () => {
    const { sut } = makeSut();

    expect(sut.currentUserId()).toBeNull();
  });

  it('one actor’s request context is never visible to a later, unrelated call', () => {
    const { sut, jwtService } = makeSut();
    const token = jwtService.sign({ sub: Identity.new().asString() });

    sut.use(requestWithAuthorization(`Bearer ${token}`), {} as Response, () => {
      // context active only for the duration of this callback
    });

    expect(sut.currentUserId()).toBeNull();
  });

  // Regression test for a real bug: NestJS does not guarantee that a class
  // used both as `MiddlewareConsumer.apply()` middleware and as a regular
  // DI-injected provider (via `ActorContextModule`'s
  // `useExisting: ActorContextMiddleware`) resolves to one singleton across
  // every module boundary — in the running app it didn't, so `use()` ran on
  // one `ActorContextMiddleware` object while `AuditLogProjector`'s injected
  // `ActorContext` was a *different* one, and every audit entry silently
  // skipped projection ("no actor in context") even though the request
  // carried a valid bearer token. The fix moved the `AsyncLocalStorage` to
  // module scope so it's shared regardless of instance identity — this test
  // constructs two separate instances, exactly like Nest's two resolution
  // paths do, and proves a second instance sees what the first recorded.
  it('a second, independently constructed instance sees the actor a first instance recorded', () => {
    const { sut: middlewareInstance, jwtService } = makeSut();
    const injectedInstance = new ActorContextMiddleware(jwtService);
    const userId = Identity.new().asString();
    const token = jwtService.sign({ sub: userId });
    let seenByInjectedInstance: string | null = null;

    middlewareInstance.use(
      requestWithAuthorization(`Bearer ${token}`),
      {} as Response,
      () => {
        seenByInjectedInstance =
          injectedInstance.currentUserId()?.asString() ?? null;
      },
    );

    expect(seenByInjectedInstance).toBe(userId);
  });
});

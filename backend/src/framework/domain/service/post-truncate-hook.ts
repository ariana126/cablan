// Runs synchronously after `POST /testing/truncate` wipes every table, before
// that request responds. `EventBus.publish()` is deliberately *not* used for
// this: `@nestjs/cqrs`'s default in-memory publisher is fire-and-forget (it
// calls `Subject.next()` and returns nothing awaitable), so a handler
// dispatched through it can still be running after the 204 has already gone
// out — the acceptance suite's `Before` hook (POST /testing/truncate → next
// step) would then race a re-seed that hasn't finished, an intermittent
// failure with no code visibly wrong. This port exists so `TestingService`
// can genuinely `await` the work instead.
//
// `framework` can't know the concrete binding (only `identity` knows how to
// re-seed its default admin) — the same "abstract port lives in framework, a
// feature module supplies the binding" shape `UserRoleProvider` already uses.
export abstract class PostTruncateHook {
  abstract run(): Promise<void>;
}

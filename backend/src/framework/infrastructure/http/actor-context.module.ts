import { ActorContext } from '@framework/domain';
import { Global, Module } from '@nestjs/common';

import { ActorContextMiddleware } from './actor-context.middleware';
import { AuthModule } from './auth.module';

// Global for the same reason `ClockModule`/`EmailModule` are: `ActorContext`
// is an abstract port a feature module's application layer may depend on
// (e.g. `audit-logging`'s projector), and `AppModule.configure()` applies
// `ActorContextMiddleware` to every route — both need this resolvable
// without importing it a second time. `useExisting`, not a second
// `useClass`, so `ActorContext` and `ActorContextMiddleware` resolve to the
// same singleton: application code injects the port, `AppModule` applies the
// concrete middleware class.
@Global()
@Module({
  imports: [AuthModule],
  providers: [
    ActorContextMiddleware,
    { provide: ActorContext, useExisting: ActorContextMiddleware },
  ],
  exports: [ActorContextMiddleware, ActorContext],
})
export class ActorContextModule {}

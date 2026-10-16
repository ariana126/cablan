import { DomainEventDispatcher } from '@framework/application';
import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { DiscoveredDomainEventDispatcher } from './discovered-domain-event-dispatcher';

// Global for the same reason as `ClockModule`: every module's repository
// depends on the `DomainEventDispatcher` port through
// `PrismaEntityRepository`, and only this module binds it.
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    {
      provide: DomainEventDispatcher,
      useClass: DiscoveredDomainEventDispatcher,
    },
  ],
  exports: [DomainEventDispatcher],
})
export class DomainEventsModule {}

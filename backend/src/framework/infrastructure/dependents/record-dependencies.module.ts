import { RecordDependencies } from '@framework/application';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { DiscoveredDependentsProbes } from './discovered-dependents-probes';

/**
 * Provides `RecordDependencies` (issue #94) over every `DependentsProbe` in
 * the application. A feature module whose handlers guard an edit or delete
 * imports it; a module that holds references just lists its probe in its own
 * `providers`. Importing it from several modules shares one instance, as Nest
 * does for any module.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [
    DiscoveredDependentsProbes,
    {
      provide: RecordDependencies,
      useFactory: (probes: DiscoveredDependentsProbes) =>
        new RecordDependencies(probes),
      inject: [DiscoveredDependentsProbes],
    },
  ],
  exports: [RecordDependencies],
})
export class RecordDependenciesModule {}

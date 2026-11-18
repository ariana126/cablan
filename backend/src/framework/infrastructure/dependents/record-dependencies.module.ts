import { RecordDependencies } from '@framework/application';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ApplyToRelatedRecordsResolver } from './apply-to-related-records.resolver';
import { DiscoveredCompositionOrderPropagators } from './discovered-composition-order-propagators';
import { DiscoveredCorrectionPropagators } from './discovered-correction-propagators';
import { DiscoveredDependentsProbes } from './discovered-dependents-probes';

/**
 * Provides `RecordDependencies` (issue #94) over every `DependentsProbe`,
 * every `CorrectionPropagator` (issue #110) and every
 * `CompositionOrderPropagator` (issue #122) in the application. A feature
 * module whose handlers guard an edit or delete imports it; a module that
 * holds references or snapshots just lists its probe or propagator in its own
 * `providers`. Importing it from several modules shares one instance, as Nest
 * does for any module. It also gives the edit controllers
 * `ApplyToRelatedRecordsResolver`, the per-request role lookup behind an edit
 * route's `applyToRelatedRecords`.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [
    ApplyToRelatedRecordsResolver,
    DiscoveredDependentsProbes,
    DiscoveredCorrectionPropagators,
    DiscoveredCompositionOrderPropagators,
    {
      provide: RecordDependencies,
      useFactory: (
        probes: DiscoveredDependentsProbes,
        propagators: DiscoveredCorrectionPropagators,
        orderPropagators: DiscoveredCompositionOrderPropagators,
      ) => new RecordDependencies(probes, propagators, orderPropagators),
      inject: [
        DiscoveredDependentsProbes,
        DiscoveredCorrectionPropagators,
        DiscoveredCompositionOrderPropagators,
      ],
    },
  ],
  exports: [RecordDependencies, ApplyToRelatedRecordsResolver],
})
export class RecordDependenciesModule {}

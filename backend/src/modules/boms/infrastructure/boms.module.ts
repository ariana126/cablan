import { CommandHandlers } from '@boms/application/commands';
import { QueryHandlers } from '@boms/application/queries';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { BomDashboardRepository } from '@boms/application/service/bom-dashboard.repository';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { StandardBomWeights } from '@boms/application/service/standard-bom-weights';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { Controllers } from '@boms/infrastructure/http/controllers';
import { RecordDependenciesModule } from '@framework/infrastructure';
import { Module } from '@nestjs/common';

import { PrismaBomRepository } from './persistence/bom.repository';
import { PrismaBomDashboardRepository } from './persistence/bom-dashboard.repository';
import { PrismaBomReportRepository } from './persistence/bom-report.repository';
import { PrismaBomsCorrectionPropagator } from './persistence/boms-correction.propagator';
import { PrismaBomsDependentsProbe } from './persistence/boms-dependents.probe';

// No import of `ManufacturingInstructionsModule` here, mirroring how `ManufacturingInstructionsModule`
// itself doesn't import `ProductsModule` for the same cross-module QueryBus
// reason (see src/modules/manufacturing-instructions/CLAUDE.md): `CqrsModule.forRoot()` is
// `@Global()` (see `AppModule`), and its handler discovery scans every
// provider reachable from the root module, not just this module's own
// `imports`. As long as `ManufacturingInstructionsModule` is mounted somewhere in the app
// — it already is, in `AppModule` — `GetManufacturingInstructionByMiCodeHandler` resolves
// on the `QueryBus` from here regardless. Importing `ManufacturingInstructionsModule`
// directly would also trip `.dependency-cruiser.cjs`'s `modules-isolated`
// rule, which has no exception carved out for module-to-module NestJS
// `imports`, only for the narrow composition-factory file reuse.
@Module({
  // `RecordDependencies` for the edit/delete guards (issue #94).
  imports: [RecordDependenciesModule],
  controllers: [...Controllers],
  providers: [
    // Which of this module's records reference another (issue #94) —
    // found by `RecordDependenciesModule`, never named by framework.
    PrismaBomsDependentsProbe,
    // Where this module's snapshots of a corrected name are rewritten
    // (issue #110) — found by `RecordDependenciesModule` the same way.
    PrismaBomsCorrectionPropagator,
    ...CommandHandlers,
    ...QueryHandlers,
    BomCompositionFactory,
    StandardBomWeights,
    {
      provide: BomRepository,
      useClass: PrismaBomRepository,
    },
    {
      provide: BomReportRepository,
      useClass: PrismaBomReportRepository,
    },
    {
      provide: BomDashboardRepository,
      useClass: PrismaBomDashboardRepository,
    },
  ],
})
export class BomsModule {}

import { CommandHandlers } from '@boms/application/commands';
import { QueryHandlers } from '@boms/application/queries';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { Controllers } from '@boms/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaBomRepository } from './persistence/bom.repository';
import { PrismaBomReportRepository } from './persistence/bom-report.repository';

// No import of `StandardBomsModule` here, mirroring how `StandardBomsModule`
// itself doesn't import `ProductsModule` for the same cross-module QueryBus
// reason (see src/modules/standard-boms/CLAUDE.md): `CqrsModule.forRoot()` is
// `@Global()` (see `AppModule`), and its handler discovery scans every
// provider reachable from the root module, not just this module's own
// `imports`. As long as `StandardBomsModule` is mounted somewhere in the app
// — it already is, in `AppModule` — `GetStandardBomByMiCodeHandler` resolves
// on the `QueryBus` from here regardless. Importing `StandardBomsModule`
// directly would also trip `.dependency-cruiser.cjs`'s `modules-isolated`
// rule, which has no exception carved out for module-to-module NestJS
// `imports`, only for the narrow composition-factory file reuse.
@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    BomCompositionFactory,
    {
      provide: BomRepository,
      useClass: PrismaBomRepository,
    },
    {
      provide: BomReportRepository,
      useClass: PrismaBomReportRepository,
    },
  ],
})
export class BomsModule {}

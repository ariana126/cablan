import { RecordDependenciesModule } from '@framework/infrastructure';
import { CommandHandlers } from '@manufacturing-instructions/application/commands';
import { QueryHandlers } from '@manufacturing-instructions/application/queries';
import { ManufacturingInstructionCompositionFactory } from '@manufacturing-instructions/application/service/manufacturing-instruction-composition.factory';
import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { Controllers } from '@manufacturing-instructions/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaManufacturingInstructionRepository } from './persistence/manufacturing-instruction.repository';
import { PrismaManufacturingInstructionReportRepository } from './persistence/manufacturing-instruction-report.repository';
import { PrismaManufacturingInstructionsDependentsProbe } from './persistence/manufacturing-instructions-dependents.probe';

@Module({
  // `RecordDependencies` for the edit/delete guards (issue #94).
  imports: [RecordDependenciesModule],
  controllers: [...Controllers],
  providers: [
    // Which of this module's records reference another (issue #94) —
    // found by `RecordDependenciesModule`, never named by framework.
    PrismaManufacturingInstructionsDependentsProbe,
    ...CommandHandlers,
    ...QueryHandlers,
    ManufacturingInstructionCompositionFactory,
    {
      provide: ManufacturingInstructionRepository,
      useClass: PrismaManufacturingInstructionRepository,
    },
    {
      provide: ManufacturingInstructionReportRepository,
      useClass: PrismaManufacturingInstructionReportRepository,
    },
  ],
})
export class ManufacturingInstructionsModule {}

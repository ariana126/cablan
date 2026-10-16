import { CommandHandlers } from '@manufacturing-instructions/application/commands';
import { QueryHandlers } from '@manufacturing-instructions/application/queries';
import { ManufacturingInstructionCompositionFactory } from '@manufacturing-instructions/application/service/manufacturing-instruction-composition.factory';
import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { Controllers } from '@manufacturing-instructions/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaManufacturingInstructionRepository } from './persistence/manufacturing-instruction.repository';
import { PrismaManufacturingInstructionReportRepository } from './persistence/manufacturing-instruction-report.repository';

@Module({
  controllers: [...Controllers],
  providers: [
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

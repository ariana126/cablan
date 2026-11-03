import { RecordDependenciesModule } from '@framework/infrastructure';
import { CommandHandlers } from '@maintenance/application/commands';
import { QueryHandlers } from '@maintenance/application/queries';
import { PmOccurrenceFinder } from '@maintenance/application/service/pm-occurrence-finder';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { Controllers } from '@maintenance/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaEquipmentRepository } from './persistence/equipment.repository';
import { PrismaMaintenanceActivityRepository } from './persistence/maintenance-activity.repository';
import { PrismaMaintenanceDependentsProbe } from './persistence/maintenance-dependents.probe';
import { PrismaMaintenanceExecutionRepository } from './persistence/maintenance-execution.repository';

// `Clock` and `DisplayNameProvider` resolve from their global modules
// (framework's `ClockModule`, `identity`'s module).
@Module({
  // `RecordDependencies` for the edit/delete guards (issue #94).
  imports: [RecordDependenciesModule],
  controllers: [...Controllers],
  providers: [
    // Which of this module's records reference another (issue #94) —
    // found by `RecordDependenciesModule`, never named by framework.
    PrismaMaintenanceDependentsProbe,
    ...CommandHandlers,
    ...QueryHandlers,
    PmPlanReader,
    PmOccurrenceFinder,
    { provide: EquipmentRepository, useClass: PrismaEquipmentRepository },
    {
      provide: MaintenanceActivityRepository,
      useClass: PrismaMaintenanceActivityRepository,
    },
    {
      provide: MaintenanceExecutionRepository,
      useClass: PrismaMaintenanceExecutionRepository,
    },
  ],
  // For `MaintenanceTestingModule`'s fixtures only (NODE_ENV=test); no
  // feature module imports this one.
  exports: [MaintenanceActivityRepository],
})
export class MaintenanceModule {}

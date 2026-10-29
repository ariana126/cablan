import { CommandHandlers } from '@maintenance/application/commands';
import { QueryHandlers } from '@maintenance/application/queries';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { Controllers } from '@maintenance/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaEquipmentRepository } from './persistence/equipment.repository';
import { PrismaMaintenanceActivityRepository } from './persistence/maintenance-activity.repository';
import { PrismaMaintenanceExecutionRepository } from './persistence/maintenance-execution.repository';

// `Clock` and `DisplayNameProvider` resolve from their global modules
// (framework's `ClockModule`, `identity`'s module).
@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    PmPlanReader,
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
})
export class MaintenanceModule {}

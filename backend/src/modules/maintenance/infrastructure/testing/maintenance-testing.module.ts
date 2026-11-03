import { Module } from '@nestjs/common';

import { MaintenanceModule } from '../maintenance.module';
import { MaintenanceTestFixtures } from './maintenance-test-fixtures';
import { MaintenanceTestingController } from './maintenance-testing.controller';

/**
 * The maintenance module's testing-support endpoints. `AppModule` mounts it
 * only at `NODE_ENV === 'test'`, beside framework's `TestingModule` — which
 * cannot hold it, since framework names no feature module.
 */
@Module({
  imports: [MaintenanceModule],
  controllers: [MaintenanceTestingController],
  providers: [MaintenanceTestFixtures],
})
export class MaintenanceTestingModule {}

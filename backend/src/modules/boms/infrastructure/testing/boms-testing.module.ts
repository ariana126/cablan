import { RegisterLegacyBomHandler } from '@boms/application/commands/register-legacy-bom/register-legacy-bom.handler';
import { Module } from '@nestjs/common';

import { BomsModule } from '../boms.module';
import { BomsTestFixtures } from './boms-test-fixtures';
import { BomsTestingController } from './boms-testing.controller';

/**
 * The boms module's testing-support endpoints (issue #101). `AppModule`
 * mounts it only at `NODE_ENV === 'test'`, beside framework's
 * `TestingModule` — which cannot hold it, since framework names no feature
 * module. `RegisterLegacyBomHandler` is provided here, not by `BomsModule`,
 * so the order rule can be bypassed nowhere else.
 */
@Module({
  imports: [BomsModule],
  controllers: [BomsTestingController],
  providers: [BomsTestFixtures, RegisterLegacyBomHandler],
})
export class BomsTestingModule {}

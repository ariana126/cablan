import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { ActivityWithoutSpecialtyDto } from './dto/activity-without-specialty.dto';
import { MaintenanceTestFixtures } from './maintenance-test-fixtures';

// Test-harness plumbing, like framework's `TestingController`: it mounts only
// under NODE_ENV=test (see AppModule), asks for no sign-in, and is called by
// nothing but an external test runner setting up a precondition.
@SkipThrottle()
@ApiTags('Testing')
@Controller('testing/maintenance')
export class MaintenanceTestingController {
  constructor(private readonly fixtures: MaintenanceTestFixtures) {}

  @Post('legacy-activities')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Store an activity without a specialty, as one registered before specialties existed',
  })
  async activityWithoutSpecialty(
    @Body() body: ActivityWithoutSpecialtyDto,
  ): Promise<{ id: string }> {
    const id = await this.fixtures.activityWithoutSpecialty(
      MaintenanceActivityName.fromString(body.name),
    );
    return { id: id.asString() };
  }
}

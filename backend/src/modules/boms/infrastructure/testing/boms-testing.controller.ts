import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { BomsTestFixtures } from './boms-test-fixtures';
import { LegacyDailyBomDto } from './dto/legacy-daily-bom.dto';

// Test-harness plumbing, like framework's `TestingController`: it mounts only
// under NODE_ENV=test (see AppModule), needs no sign-in, and is called by
// nothing but an external test runner setting up a precondition.
@SkipThrottle()
@ApiTags('Testing')
@Controller('testing/boms')
export class BomsTestingController {
  constructor(private readonly fixtures: BomsTestFixtures) {}

  @Post('legacy-daily-boms')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Register a daily BOM as before orders existed (issue #101): for any order number, with the MI code given. A bearer token names its registrant; without one it reads "-" and writes no audit entry',
  })
  async legacyDailyBom(
    @Body() body: LegacyDailyBomDto,
  ): Promise<{ id: string }> {
    return { id: await this.fixtures.legacyDailyBom(body) };
  }

  @Post('order-backfill')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Carry the daily BOMs' order numbers over to orders, as the order_backfill migration did (idempotent; touches no daily BOM)",
  })
  async backfillOrders(): Promise<void> {
    await this.fixtures.backfillOrders();
  }
}

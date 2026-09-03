import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

export interface HealthStatus {
  status: 'ok';
}

// A liveness probe is polled on a fixed interval by whatever's watching this
// process (docker-compose's healthcheck every 10s today, an orchestrator's
// probe tomorrow) — never a client rate limiting exists to slow down.
@SkipThrottle()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    schema: { properties: { status: { type: 'string', example: 'ok' } } },
  })
  check(): HealthStatus {
    return { status: 'ok' };
  }
}

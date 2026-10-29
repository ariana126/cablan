import {
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
} from '@framework/infrastructure';
import { DailyPmTaskReadModel } from '@maintenance/application/queries/get-daily-pm-schedule/daily-pm-task.read-model';
import { GetDailyPmScheduleQuery } from '@maintenance/application/queries/get-daily-pm-schedule/get-daily-pm-schedule.query';
import { GetPmScheduleOverviewQuery } from '@maintenance/application/queries/get-pm-schedule-overview/get-pm-schedule-overview.query';
import { PmOccurrenceReadModel } from '@maintenance/application/queries/get-pm-schedule-overview/pm-occurrence.read-model';
import { PM_SCHEDULE_ROLES } from '@maintenance/domain/value/maintenance-roles';
import {
  DailyPmTaskSchema,
  ForbiddenResponse,
  PmOccurrenceSchema,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('PM Schedule')
@ApiBearerAuth()
@Controller('pm-schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PM_SCHEDULE_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class PmScheduleController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('daily')
  @ApiOperation({
    summary:
      'Today’s (Tehran) PM work due and overdue, by equipment name then plan order',
  })
  @ApiOkResponse({ schema: { type: 'array', items: DailyPmTaskSchema } })
  async daily(): Promise<DailyPmTaskReadModel[]> {
    return this.queryBus.execute(new GetDailyPmScheduleQuery());
  }

  @Get('overview')
  @ApiOperation({
    summary:
      'Every occurrence so far of every active plan item, with its status and who did it when',
  })
  @ApiOkResponse({ schema: { type: 'array', items: PmOccurrenceSchema } })
  async overview(): Promise<PmOccurrenceReadModel[]> {
    return this.queryBus.execute(new GetPmScheduleOverviewQuery());
  }
}

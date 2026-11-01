import {
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
} from '@framework/infrastructure';
import { DailyPmTaskReadModel } from '@maintenance/application/queries/get-daily-pm-schedule/daily-pm-task.read-model';
import { GetDailyPmScheduleQuery } from '@maintenance/application/queries/get-daily-pm-schedule/get-daily-pm-schedule.query';
import { GetPmScheduleCalendarQuery } from '@maintenance/application/queries/get-pm-schedule-calendar/get-pm-schedule-calendar.query';
import { GetPmScheduleFilterOptionsQuery } from '@maintenance/application/queries/get-pm-schedule-filter-options/get-pm-schedule-filter-options.query';
import { PmScheduleFilterOptionsReadModel } from '@maintenance/application/queries/get-pm-schedule-filter-options/pm-schedule-filter-options.read-model';
import { GetPmScheduleOverviewQuery } from '@maintenance/application/queries/get-pm-schedule-overview/get-pm-schedule-overview.query';
import { PmOccurrenceReadModel } from '@maintenance/application/service/pm-occurrence.read-model';
import { PmScheduleFilters } from '@maintenance/application/service/pm-occurrence-finder';
import { PM_SCHEDULE_ROLES } from '@maintenance/domain/value/maintenance-roles';
import {
  DailyPmTaskSchema,
  ForbiddenResponse,
  InvalidPmScheduleRangeResponse,
  PmOccurrenceSchema,
  PmScheduleFilterOptionsSchema,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { PmScheduleRangeQueryDto } from './dto/pm-schedule-range-query.dto';

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
      'Every occurrence due in [from, to], future ones included, removed items and retired equipment up to the day they stopped; by equipment name, plan order, due date',
  })
  @ApiOkResponse({ schema: { type: 'array', items: PmOccurrenceSchema } })
  @ApiBadRequestResponse(InvalidPmScheduleRangeResponse)
  async overview(
    @Query() query: PmScheduleRangeQueryDto,
  ): Promise<PmOccurrenceReadModel[]> {
    return this.queryBus.execute(
      new GetPmScheduleOverviewQuery(query.from, query.to, filtersOf(query)),
    );
  }

  @Get('calendar')
  @ApiOperation({
    summary:
      'The overview’s rows whose calendarDate (the day performed when late, else the due date) is in [from, to]',
  })
  @ApiOkResponse({ schema: { type: 'array', items: PmOccurrenceSchema } })
  @ApiBadRequestResponse(InvalidPmScheduleRangeResponse)
  async calendar(
    @Query() query: PmScheduleRangeQueryDto,
  ): Promise<PmOccurrenceReadModel[]> {
    return this.queryBus.execute(
      new GetPmScheduleCalendarQuery(query.from, query.to, filtersOf(query)),
    );
  }

  @Get('filter-options')
  @ApiOperation({
    summary:
      'The choices of the PM schedule’s filters: equipment, activities and performers, each by name',
  })
  @ApiOkResponse({ schema: PmScheduleFilterOptionsSchema })
  async filterOptions(): Promise<PmScheduleFilterOptionsReadModel> {
    return this.queryBus.execute(new GetPmScheduleFilterOptionsQuery());
  }
}

function filtersOf(query: PmScheduleRangeQueryDto): PmScheduleFilters {
  return {
    equipmentId: query.equipmentId,
    activityId: query.activityId,
    status: query.status,
    performedById: query.performedById,
  };
}

import {
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { GetPmDashboardQuery } from '@maintenance/application/queries/get-pm-dashboard/get-pm-dashboard.query';
import { PmDashboardReadModel } from '@maintenance/application/queries/get-pm-dashboard/pm-dashboard.read-model';
import { MAINTENANCE_PLANNER_ROLES } from '@maintenance/domain/value/maintenance-roles';
import {
  ForbiddenResponse,
  PmDashboardSchema,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { PmDashboardQueryDto } from './dto/pm-dashboard-query.dto';

/**
 * The technical management dashboard (issue #89) — for the planners only:
 * the PM inspector works the schedule but does not see it.
 */
@ApiTags('PM Dashboard')
@ApiBearerAuth()
@Controller('pm-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MAINTENANCE_PLANNER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class PmDashboardController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    summary:
      'The technical management dashboard: today’s PM work, the period’s missed occurrences and performance with its trend, plant-wide coverage, the most overdue equipment, the next seven days and the follow-up occurrences',
  })
  @ApiOkResponse({ schema: PmDashboardSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async dashboard(
    @Query() query: PmDashboardQueryDto,
  ): Promise<PmDashboardReadModel> {
    return this.queryBus.execute(
      new GetPmDashboardQuery(query.periodDays, query.equipmentId),
    );
  }
}

import { Identity } from '@framework/domain';
import {
  AuthenticatedUser,
  CurrentUser,
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { AddPmPlanItemCommand } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.command';
import { ChangePmPlanItemIntervalCommand } from '@maintenance/application/commands/change-pm-plan-item-interval/change-pm-plan-item-interval.command';
import { RecordMaintenanceExecutionCommand } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.command';
import { RemovePmPlanItemCommand } from '@maintenance/application/commands/remove-pm-plan-item/remove-pm-plan-item.command';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import {
  MAINTENANCE_PLANNER_ROLES,
  PM_SCHEDULE_ROLES,
} from '@maintenance/domain/value/maintenance-roles';
import {
  CreatedIdSchema,
  ForbiddenResponse,
  PmPlanItemConflictResponse,
  RecordedExecutionSchema,
  UsageBasedIntervalResponse,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AddPmPlanItemDto } from './dto/add-pm-plan-item.dto';
import { ChangePmPlanItemIntervalDto } from './dto/change-pm-plan-item-interval.dto';
import { RecordMaintenanceExecutionDto } from './dto/record-maintenance-execution.dto';

@ApiTags('PM Plans')
@ApiBearerAuth()
@Controller('equipment/:id/pm-plan-items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MAINTENANCE_PLANNER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
@ApiNotFoundResponse({ schema: EntityNotFoundSchema })
export class PmPlanItemController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Add an activity to the equipment’s PM plan, with its interval and first due date',
  })
  @ApiCreatedResponse({ schema: CreatedIdSchema })
  @ApiBadRequestResponse(UsageBasedIntervalResponse)
  @ApiConflictResponse(PmPlanItemConflictResponse)
  async add(
    @Param('id') id: string,
    @Body() body: AddPmPlanItemDto,
  ): Promise<{ id: string }> {
    return this.commandBus.execute(
      new AddPmPlanItemCommand(
        Identity.fromString(id),
        Identity.fromString(body.activityId),
        body.intervalValue,
        body.intervalUnit,
        CalendarDate.fromString(body.firstDueDate),
      ),
    );
  }

  @Patch(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Change a plan item’s interval; due dates already passed, and every one already done, keep theirs',
  })
  @ApiNoContentResponse({ description: 'Interval changed' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiConflictResponse(PmPlanItemConflictResponse)
  async changeInterval(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: ChangePmPlanItemIntervalDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new ChangePmPlanItemIntervalCommand(
        Identity.fromString(id),
        Identity.fromString(itemId),
        body.intervalDays,
      ),
    );
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove an activity from the plan (its history stays)',
  })
  @ApiNoContentResponse({ description: 'Plan item removed' })
  @ApiConflictResponse(PmPlanItemConflictResponse)
  async remove(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new RemovePmPlanItemCommand(
        Identity.fromString(id),
        Identity.fromString(itemId),
      ),
    );
  }

  @Post(':itemId/executions')
  @Roles(...PM_SCHEDULE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Record that the item’s next due occurrence was done, now, by the signed-in user',
  })
  @ApiCreatedResponse({ schema: RecordedExecutionSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiConflictResponse(PmPlanItemConflictResponse)
  async recordExecution(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: RecordMaintenanceExecutionDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<{ id: string; dueDate: string }> {
    return this.commandBus.execute(
      new RecordMaintenanceExecutionCommand(
        Identity.fromString(id),
        Identity.fromString(itemId),
        actingUser.id,
        body.notes,
      ),
    );
  }
}

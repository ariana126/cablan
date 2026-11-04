import { Identity, Role } from '@framework/domain';
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
import { DeactivatePmPlanItemCommand } from '@maintenance/application/commands/deactivate-pm-plan-item/deactivate-pm-plan-item.command';
import { DeleteMaintenanceExecutionCommand } from '@maintenance/application/commands/delete-maintenance-execution/delete-maintenance-execution.command';
import { DeleteMaintenanceExecutionsCommand } from '@maintenance/application/commands/delete-maintenance-executions/delete-maintenance-executions.command';
import { DeletePmPlanItemCommand } from '@maintenance/application/commands/delete-pm-plan-item/delete-pm-plan-item.command';
import { RecordMaintenanceExecutionCommand } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.command';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import {
  MAINTENANCE_PLANNER_ROLES,
  PM_SCHEDULE_ROLES,
} from '@maintenance/domain/value/maintenance-roles';
import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';
import {
  CreatedIdSchema,
  ForbiddenResponse,
  PmPlanItemActiveResponse,
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

  @Post(':itemId/deactivation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Deactivate a plan item: it leaves the active plan for good, keeping its schedule and executions; it cannot be reactivated',
  })
  @ApiNoContentResponse({ description: 'Plan item deactivated' })
  @ApiConflictResponse(PmPlanItemConflictResponse)
  async deactivate(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeactivatePmPlanItemCommand(
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
        body.operatingHours === undefined
          ? null
          : OperatingHours.of(body.operatingHours),
      ),
    );
  }

  // Issue #110: the System Admin's deletions. Active or inactive rows,
  // in service or retired equipment alike, unless said otherwise.

  @Delete(':itemId')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete an inactive plan row (System Admin) with every execution of it; other rows, of the same activity too, stay',
  })
  @ApiNoContentResponse({ description: 'Plan row deleted' })
  @ApiConflictResponse(PmPlanItemActiveResponse)
  async delete(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeletePmPlanItemCommand(
        Identity.fromString(id),
        Identity.fromString(itemId),
      ),
    );
  }

  @Delete(':itemId/executions')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete every execution of a plan row (System Admin); a row with none is left as it is',
  })
  @ApiNoContentResponse({ description: 'Executions deleted' })
  async deleteExecutions(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteMaintenanceExecutionsCommand(
        Identity.fromString(id),
        Identity.fromString(itemId),
      ),
    );
  }

  @Delete(':itemId/executions/:executionId')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete one execution of a plan row (System Admin); its occurrence simply has no execution again',
  })
  @ApiNoContentResponse({ description: 'Execution deleted' })
  async deleteExecution(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('executionId') executionId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteMaintenanceExecutionCommand(
        Identity.fromString(id),
        Identity.fromString(itemId),
        Identity.fromString(executionId),
      ),
    );
  }
}

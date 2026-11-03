import { Identity, Role } from '@framework/domain';
import {
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  RecordHasDependentsSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { CompleteMissingSpecialtiesCommand } from '@maintenance/application/commands/complete-missing-specialties/complete-missing-specialties.command';
import { EditMaintenanceActivityCommand } from '@maintenance/application/commands/edit-maintenance-activity/edit-maintenance-activity.command';
import { RegisterMaintenanceActivityCommand } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.command';
import { ActivityWithoutSpecialtyReadModel } from '@maintenance/application/queries/list-activities-without-specialty/activity-without-specialty.read-model';
import { ListActivitiesWithoutSpecialtyQuery } from '@maintenance/application/queries/list-activities-without-specialty/list-activities-without-specialty.query';
import { ListMaintenanceActivitiesQuery } from '@maintenance/application/queries/list-maintenance-activities/list-maintenance-activities.query';
import { MaintenanceActivityReadModel } from '@maintenance/application/queries/list-maintenance-activities/maintenance-activity.read-model';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { MAINTENANCE_PLANNER_ROLES } from '@maintenance/domain/value/maintenance-roles';
import {
  ActivityWithoutSpecialtySchema,
  CreatedIdSchema,
  ForbiddenResponse,
  MaintenanceActivityNameTakenResponse,
  MaintenanceActivitySchema,
  SpecialtyAssignmentIncompleteResponse,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CompleteMissingSpecialtiesDto } from './dto/complete-missing-specialties.dto';
import { MaintenanceActivityDto } from './dto/maintenance-activity.dto';

@ApiTags('Maintenance Activities')
@ApiBearerAuth()
@Controller('maintenance-activities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MAINTENANCE_PLANNER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class MaintenanceActivityController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a maintenance activity in the catalog, of one specialty',
  })
  @ApiCreatedResponse({ schema: CreatedIdSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiConflictResponse(MaintenanceActivityNameTakenResponse)
  async register(
    @Body() body: MaintenanceActivityDto,
  ): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RegisterMaintenanceActivityCommand(
        MaintenanceActivityName.fromString(body.name),
        ActivitySpecialty.fromString(body.specialty),
      ),
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Edit a maintenance activity: its name and specialty',
  })
  @ApiNoContentResponse({ description: 'Activity edited' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse({
    description:
      '`maintenance-activity-name-taken`, or `record-has-dependents` when a PM plan holds the activity (active or deactivated) — whatever the edit changes, its specialty alone included',
    schema: {
      oneOf: [
        MaintenanceActivityNameTakenResponse.schema,
        RecordHasDependentsSchema,
      ],
    },
  })
  async edit(
    @Param('id') id: string,
    @Body() body: MaintenanceActivityDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditMaintenanceActivityCommand(
        Identity.fromString(id),
        MaintenanceActivityName.fromString(body.name),
        ActivitySpecialty.fromString(body.specialty),
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List the activity catalog, by name' })
  @ApiOkResponse({
    schema: { type: 'array', items: MaintenanceActivitySchema },
  })
  async list(): Promise<MaintenanceActivityReadModel[]> {
    return this.queryBus.execute(new ListMaintenanceActivitiesQuery());
  }

  @Get('unassigned-specialties')
  @Roles(Role.SystemAdmin)
  @ApiOperation({
    summary:
      'The activities without a specialty («تخصص تعیین نشده»), by name — what the one-time completion must cover; empty once it is done',
  })
  @ApiOkResponse({
    schema: { type: 'array', items: ActivityWithoutSpecialtySchema },
  })
  async withoutSpecialty(): Promise<ActivityWithoutSpecialtyReadModel[]> {
    return this.queryBus.execute(new ListActivitiesWithoutSpecialtyQuery());
  }

  @Post('specialty-assignment')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Give every activity without a specialty its specialty, all at once — the one change allowed while a PM plan holds an activity',
  })
  @ApiNoContentResponse({ description: 'Every missing specialty completed' })
  @ApiBadRequestResponse(SpecialtyAssignmentIncompleteResponse)
  async completeMissingSpecialties(
    @Body() body: CompleteMissingSpecialtiesDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new CompleteMissingSpecialtiesCommand(
        body.assignments.map(({ activityId, specialty }) => ({
          activityId: Identity.fromString(activityId),
          specialty: ActivitySpecialty.fromString(specialty),
        })),
      ),
    );
  }
}

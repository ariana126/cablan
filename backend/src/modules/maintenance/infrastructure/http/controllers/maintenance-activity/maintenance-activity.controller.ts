import { Identity } from '@framework/domain';
import {
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { RegisterMaintenanceActivityCommand } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.command';
import { RenameMaintenanceActivityCommand } from '@maintenance/application/commands/rename-maintenance-activity/rename-maintenance-activity.command';
import { ListMaintenanceActivitiesQuery } from '@maintenance/application/queries/list-maintenance-activities/list-maintenance-activities.query';
import { MaintenanceActivityReadModel } from '@maintenance/application/queries/list-maintenance-activities/maintenance-activity.read-model';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { MAINTENANCE_PLANNER_ROLES } from '@maintenance/domain/value/maintenance-roles';
import {
  CreatedIdSchema,
  ForbiddenResponse,
  MaintenanceActivityNameTakenResponse,
  MaintenanceActivitySchema,
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

import { MaintenanceActivityNameDto } from './dto/maintenance-activity-name.dto';

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
  @ApiOperation({ summary: 'Register a maintenance activity in the catalog' })
  @ApiCreatedResponse({ schema: CreatedIdSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiConflictResponse(MaintenanceActivityNameTakenResponse)
  async register(
    @Body() body: MaintenanceActivityNameDto,
  ): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RegisterMaintenanceActivityCommand(
        MaintenanceActivityName.fromString(body.name),
      ),
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rename a maintenance activity' })
  @ApiNoContentResponse({ description: 'Activity renamed' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(MaintenanceActivityNameTakenResponse)
  async rename(
    @Param('id') id: string,
    @Body() body: MaintenanceActivityNameDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RenameMaintenanceActivityCommand(
        Identity.fromString(id),
        MaintenanceActivityName.fromString(body.name),
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
}

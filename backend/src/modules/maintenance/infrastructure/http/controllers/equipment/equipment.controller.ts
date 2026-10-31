import { Identity } from '@framework/domain';
import {
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RenameEquipmentCommand } from '@maintenance/application/commands/rename-equipment/rename-equipment.command';
import { RetireEquipmentCommand } from '@maintenance/application/commands/retire-equipment/retire-equipment.command';
import { EquipmentDetailReadModel } from '@maintenance/application/queries/get-equipment/equipment-detail.read-model';
import { GetEquipmentQuery } from '@maintenance/application/queries/get-equipment/get-equipment.query';
import { GetEquipmentMaintenanceHistoryQuery } from '@maintenance/application/queries/get-equipment-maintenance-history/get-equipment-maintenance-history.query';
import { MaintenanceExecutionReadModel } from '@maintenance/application/queries/get-equipment-maintenance-history/maintenance-execution.read-model';
import { EquipmentReadModel } from '@maintenance/application/queries/list-equipment/equipment.read-model';
import { ListEquipmentQuery } from '@maintenance/application/queries/list-equipment/list-equipment.query';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import {
  MAINTENANCE_PLANNER_ROLES,
  PM_SCHEDULE_ROLES,
} from '@maintenance/domain/value/maintenance-roles';
import {
  CreatedIdSchema,
  EquipmentDetailSchema,
  EquipmentListItemSchema,
  EquipmentNameTakenResponse,
  EquipmentRetiredResponse,
  ForbiddenResponse,
  MaintenanceExecutionSchema,
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

import { EquipmentNameDto } from './dto/equipment-name.dto';

@ApiTags('Equipment')
@ApiBearerAuth()
@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MAINTENANCE_PLANNER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class EquipmentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register equipment by name' })
  @ApiCreatedResponse({ schema: CreatedIdSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiConflictResponse(EquipmentNameTakenResponse)
  async register(@Body() body: EquipmentNameDto): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RegisterEquipmentCommand(EquipmentName.fromString(body.name)),
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rename equipment' })
  @ApiNoContentResponse({ description: 'Equipment renamed' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse({
    description: '`equipment-name-taken` or `equipment-retired`',
    ...EquipmentNameTakenResponse,
  })
  async rename(
    @Param('id') id: string,
    @Body() body: EquipmentNameDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RenameEquipmentCommand(
        Identity.fromString(id),
        EquipmentName.fromString(body.name),
      ),
    );
  }

  @Post(':id/retirement')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Retire equipment: its plan stops, its history stays',
  })
  @ApiNoContentResponse({ description: 'Equipment retired' })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(EquipmentRetiredResponse)
  async retire(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new RetireEquipmentCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List every piece of equipment, by name' })
  @ApiOkResponse({ schema: { type: 'array', items: EquipmentListItemSchema } })
  async list(): Promise<EquipmentReadModel[]> {
    return this.queryBus.execute(new ListEquipmentQuery());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Equipment with its active PM plan items' })
  @ApiOkResponse({ schema: EquipmentDetailSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async get(@Param('id') id: string): Promise<EquipmentDetailReadModel> {
    return this.queryBus.execute(
      new GetEquipmentQuery(Identity.fromString(id)),
    );
  }

  @Get(':id/maintenance-history')
  @Roles(...PM_SCHEDULE_ROLES)
  @ApiOperation({
    summary:
      'Every execution recorded on the equipment, newest first — removed items’ included',
  })
  @ApiOkResponse({
    schema: { type: 'array', items: MaintenanceExecutionSchema },
  })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async maintenanceHistory(
    @Param('id') id: string,
  ): Promise<MaintenanceExecutionReadModel[]> {
    return this.queryBus.execute(
      new GetEquipmentMaintenanceHistoryQuery(Identity.fromString(id)),
    );
  }
}

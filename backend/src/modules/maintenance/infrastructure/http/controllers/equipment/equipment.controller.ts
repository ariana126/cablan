import { Identity, Role } from '@framework/domain';
import {
  ApplyToRelatedRecordsResolver,
  AuthenticatedUser,
  CurrentUser,
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  RecordHasDependentsSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { DeleteEquipmentCommand } from '@maintenance/application/commands/delete-equipment/delete-equipment.command';
import { ReactivateEquipmentCommand } from '@maintenance/application/commands/reactivate-equipment/reactivate-equipment.command';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RenameEquipmentCommand } from '@maintenance/application/commands/rename-equipment/rename-equipment.command';
import { RetireEquipmentCommand } from '@maintenance/application/commands/retire-equipment/retire-equipment.command';
import { EquipmentDetailReadModel } from '@maintenance/application/queries/get-equipment/equipment-detail.read-model';
import { GetEquipmentQuery } from '@maintenance/application/queries/get-equipment/get-equipment.query';
import { GetEquipmentMaintenanceHistoryQuery } from '@maintenance/application/queries/get-equipment-maintenance-history/get-equipment-maintenance-history.query';
import { MaintenanceHistoryEntryReadModel } from '@maintenance/application/queries/get-equipment-maintenance-history/maintenance-history-entry.read-model';
import { EquipmentReadModel } from '@maintenance/application/queries/list-equipment/equipment.read-model';
import { ListEquipmentQuery } from '@maintenance/application/queries/list-equipment/list-equipment.query';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
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
  EquipmentNotRetiredResponse,
  EquipmentRetiredResponse,
  ForbiddenResponse,
  MaintenanceHistoryEntrySchema,
  ReactivationBadRequestResponse,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { MaintenanceHistoryQueryDto } from './dto/maintenance-history-query.dto';
import { ReactivateEquipmentDto } from './dto/reactivate-equipment.dto';
import { RenameEquipmentDto } from './dto/rename-equipment.dto';

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
    private readonly applyToRelatedRecords: ApplyToRelatedRecordsResolver,
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
    description:
      '`equipment-name-taken`, `equipment-retired`, or `record-has-dependents` when its PM plan holds an item (active or deactivated) — unless a System Admin confirms with `applyToRelatedRecords`, which renames retired equipment too and carries the name into its history',
    schema: {
      oneOf: [
        EquipmentNameTakenResponse.schema,
        EquipmentRetiredResponse.schema,
        RecordHasDependentsSchema,
      ],
    },
  })
  async rename(
    @Param('id') id: string,
    @Body() body: RenameEquipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new RenameEquipmentCommand(
        Identity.fromString(id),
        EquipmentName.fromString(body.name),
        await this.applyToRelatedRecords.askedBy(
          user,
          body.applyToRelatedRecords,
        ),
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

  @Post(':id/reactivation')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Reactivate retired equipment (System Admin): each listed active row restarts from a new first due date, every other continues its calendar; the due dates while retired are not part of the PM commitment',
  })
  @ApiNoContentResponse({ description: 'Equipment back in service' })
  @ApiBadRequestResponse(ReactivationBadRequestResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(EquipmentNotRetiredResponse)
  async reactivate(
    @Param('id') id: string,
    @Body() body: ReactivateEquipmentDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new ReactivateEquipmentCommand(
        Identity.fromString(id),
        (body.rescheduledItems ?? []).map((item) => ({
          planItemId: Identity.fromString(item.planItemId),
          firstDueDate: CalendarDate.fromString(item.firstDueDate),
        })),
      ),
    );
  }

  @Delete(':id')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete retired equipment (System Admin) with every row of its plan and every execution of them; its name is free again',
  })
  @ApiNoContentResponse({ description: 'Equipment deleted' })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(EquipmentNotRetiredResponse)
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteEquipmentCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List every piece of equipment, by name' })
  @ApiOkResponse({ schema: { type: 'array', items: EquipmentListItemSchema } })
  async list(): Promise<EquipmentReadModel[]> {
    return this.queryBus.execute(new ListEquipmentQuery());
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Equipment with its active PM plan items and, read-only, its deactivated ones',
  })
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
      'The equipment’s PM history: every execution, plus every occurrence missed as of today (not done by its next due date) — deactivated items’ up to their deactivation day; none due inside a service gap (while the equipment was retired), but those due before a retirement included; newest first by history date (an execution’s Tehran performed day, a missed occurrence’s due date), ties by activity name',
  })
  @ApiOkResponse({
    schema: { type: 'array', items: MaintenanceHistoryEntrySchema },
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async maintenanceHistory(
    @Param('id') id: string,
    @Query() query: MaintenanceHistoryQueryDto,
  ): Promise<MaintenanceHistoryEntryReadModel[]> {
    return this.queryBus.execute(
      new GetEquipmentMaintenanceHistoryQuery(
        Identity.fromString(id),
        query.from && query.to
          ? CalendarDateRange.between(
              CalendarDate.fromString(query.from),
              CalendarDate.fromString(query.to),
            )
          : null,
      ),
    );
  }
}

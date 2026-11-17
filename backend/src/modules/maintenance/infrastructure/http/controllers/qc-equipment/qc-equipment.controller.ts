import { Identity } from '@framework/domain';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { AssignQcActivityCommand } from '@maintenance/application/commands/assign-qc-activity/assign-qc-activity.command';
import { RecordQcExecutionCommand } from '@maintenance/application/commands/record-qc-execution/record-qc-execution.command';
import { UnassignQcActivityCommand } from '@maintenance/application/commands/unassign-qc-activity/unassign-qc-activity.command';
import { GetQcEquipmentQuery } from '@maintenance/application/queries/get-qc-equipment/get-qc-equipment.query';
import { ListQcEquipmentQuery } from '@maintenance/application/queries/list-qc-equipment/list-qc-equipment.query';
import { QcEquipmentSummaryReadModel } from '@maintenance/application/queries/list-qc-equipment/qc-equipment-summary.read-model';
import { QcEquipmentReadModel } from '@maintenance/application/service/qc-equipment.read-model';
import {
  QC_MANAGER_ROLES,
  QC_RECORDER_ROLES,
} from '@maintenance/domain/value/qc-roles';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';
import {
  CreatedIdSchema,
  ForbiddenResponse,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  EquipmentNotFoundSchema,
  QcActivityAlreadyAssignedSchema,
  QcActivityNotAssignedSchema,
  QcActivityNotFoundSchema,
  QcEquipmentRetiredSchema,
  QcEquipmentSchema,
  QcEquipmentSummarySchema,
} from '@maintenance/infrastructure/http/qc-schemas';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import {
  AssignQcActivityDto,
  QcAssignmentParams,
  QcEquipmentIdParams,
  RecordQcExecutionDto,
} from './dto/qc-equipment.dto';

/**
 * «پرونده QC تجهیزات» (issue #119): each piece of equipment's QC activities —
 * assigned and unassigned by the managers — and, for the QC inspector too,
 * recording that one was done.
 */
@ApiTags('QC Equipment')
@ApiBearerAuth()
@Controller('qc-equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...QC_MANAGER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class QcEquipmentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Every piece of equipment, retired included, by name, with how many QC activities it has',
  })
  @ApiOkResponse({
    schema: { type: 'array', items: QcEquipmentSummarySchema },
  })
  async list(): Promise<QcEquipmentSummaryReadModel[]> {
    return this.queryBus.execute(new ListQcEquipmentQuery());
  }

  @Get(':equipmentId')
  @ApiOperation({
    summary:
      'One piece of equipment’s QC activities, each with its last execution',
  })
  @ApiOkResponse({ schema: QcEquipmentSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: EquipmentNotFoundSchema })
  async get(
    @Param() params: QcEquipmentIdParams,
  ): Promise<QcEquipmentReadModel> {
    return this.queryBus.execute(
      new GetQcEquipmentQuery(Identity.fromString(params.equipmentId)),
    );
  }

  @Post(':equipmentId/activities')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a QC activity to equipment in service' })
  @ApiCreatedResponse({ description: 'QC activity assigned' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({
    description: '`equipment-not-found` or `qc-activity-not-found`',
    schema: { oneOf: [EquipmentNotFoundSchema, QcActivityNotFoundSchema] },
  })
  @ApiConflictResponse({
    description: '`qc-activity-already-assigned` or `equipment-retired`',
    schema: {
      oneOf: [QcActivityAlreadyAssignedSchema, QcEquipmentRetiredSchema],
    },
  })
  async assign(
    @Param() params: QcEquipmentIdParams,
    @Body() body: AssignQcActivityDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AssignQcActivityCommand(
        Identity.fromString(params.equipmentId),
        Identity.fromString(body.activityId),
      ),
    );
  }

  @Delete(':equipmentId/activities/:activityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Unassign a QC activity: no more records of it on this equipment; those made stay',
  })
  @ApiNoContentResponse({ description: 'QC activity unassigned' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({
    description:
      '`equipment-not-found`, `qc-activity-not-found`, or `qc-activity-not-assigned` (404) when it is not assigned to this equipment',
    schema: {
      oneOf: [
        EquipmentNotFoundSchema,
        QcActivityNotFoundSchema,
        QcActivityNotAssignedSchema,
      ],
    },
  })
  @ApiConflictResponse({
    description: '`equipment-retired`',
    schema: QcEquipmentRetiredSchema,
  })
  async unassign(@Param() params: QcAssignmentParams): Promise<void> {
    await this.commandBus.execute(
      new UnassignQcActivityCommand(
        Identity.fromString(params.equipmentId),
        Identity.fromString(params.activityId),
      ),
    );
  }

  @Post(':equipmentId/activities/:activityId/executions')
  @Roles(...QC_RECORDER_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Record that a QC activity assigned to equipment in service was done, now, by the signed-in user',
  })
  @ApiCreatedResponse({ schema: CreatedIdSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({
    description: '`equipment-not-found` or `qc-activity-not-found`',
    schema: { oneOf: [EquipmentNotFoundSchema, QcActivityNotFoundSchema] },
  })
  @ApiConflictResponse({
    description:
      '`equipment-retired` (checked first), or `qc-activity-not-assigned` when the activity is not assigned to this equipment',
    schema: { oneOf: [QcEquipmentRetiredSchema, QcActivityNotAssignedSchema] },
  })
  async record(
    @Param() params: QcAssignmentParams,
    @Body() body: RecordQcExecutionDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RecordQcExecutionCommand(
        Identity.fromString(params.equipmentId),
        Identity.fromString(params.activityId),
        actingUser.id,
        QcTrackingNumber.fromString(body.trackingNumber),
        body.notes,
      ),
    );
  }
}

import { Identity } from '@framework/domain';
import {
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { GetQcEquipmentQuery } from '@maintenance/application/queries/get-qc-equipment/get-qc-equipment.query';
import { ListQcInspectionsQuery } from '@maintenance/application/queries/list-qc-inspections/list-qc-inspections.query';
import { QcEquipmentReadModel } from '@maintenance/application/service/qc-equipment.read-model';
import { QC_RECORDER_ROLES } from '@maintenance/domain/value/qc-roles';
import { ForbiddenResponse } from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  EquipmentNotFoundSchema,
  QcEquipmentSchema,
} from '@maintenance/infrastructure/http/qc-schemas';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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

import { QcEquipmentIdParams } from '../qc-equipment/dto/qc-equipment.dto';

/**
 * «بازرسی حین تولید» (issue #119): what the QC inspector records — the
 * equipment a scanned QR code names (its id) and every piece of equipment
 * with QC activities.
 */
@ApiTags('QC Inspections')
@ApiBearerAuth()
@Controller('qc-inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...QC_RECORDER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class QcInspectionController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    summary:
      'The equipment in service with at least one QC activity, by name, each activity with its last execution',
  })
  @ApiOkResponse({ schema: { type: 'array', items: QcEquipmentSchema } })
  async list(): Promise<QcEquipmentReadModel[]> {
    return this.queryBus.execute(new ListQcInspectionsQuery());
  }

  @Get(':equipmentId')
  @ApiOperation({
    summary:
      'One piece of equipment’s QC activities, each with its last execution — retired equipment too (`retired: true`)',
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
}

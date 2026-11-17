import { Identity, Role } from '@framework/domain';
import {
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { DeleteQcExecutionCommand } from '@maintenance/application/commands/delete-qc-execution/delete-qc-execution.command';
import { GetQcExecutionFilterOptionsQuery } from '@maintenance/application/queries/get-qc-execution-filter-options/get-qc-execution-filter-options.query';
import { QcExecutionFilterOptionsReadModel } from '@maintenance/application/queries/get-qc-execution-filter-options/qc-execution-filter-options.read-model';
import { GetQcExecutionHistoryQuery } from '@maintenance/application/queries/get-qc-execution-history/get-qc-execution-history.query';
import { QcExecutionHistoryReadModel } from '@maintenance/application/queries/get-qc-execution-history/qc-execution-history.read-model';
import { QC_MANAGER_ROLES } from '@maintenance/domain/value/qc-roles';
import { ForbiddenResponse } from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  QcExecutionFilterOptionsSchema,
  QcExecutionHistorySchema,
  QcExecutionNotFoundSchema,
} from '@maintenance/infrastructure/http/qc-schemas';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  QcExecutionIdParams,
  QcExecutionQueryDto,
} from './dto/qc-execution-query.dto';

/**
 * «سوابق فعالیت‌های QC» (issue #119): every QC record, read by the managers;
 * only the System Admin deletes one.
 */
@ApiTags('QC Executions')
@ApiBearerAuth()
@Controller('qc-executions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...QC_MANAGER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class QcExecutionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'The QC records the filters admit, newest first, each with its interval since the previous record of its equipment and activity, and their counts',
  })
  @ApiOkResponse({ schema: QcExecutionHistorySchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  async history(
    @Query() query: QcExecutionQueryDto,
  ): Promise<QcExecutionHistoryReadModel> {
    return this.queryBus.execute(
      new GetQcExecutionHistoryQuery({
        from: query.from === undefined ? null : new Date(query.from),
        to: query.to === undefined ? null : new Date(query.to),
        equipmentId: idOrNull(query.equipmentId),
        activityId: idOrNull(query.activityId),
        performedById: idOrNull(query.performedById),
        trackingNumber: query.trackingNumber ?? null,
      }),
    );
  }

  @Get('filter-options')
  @ApiOperation({
    summary:
      'What the QC records’ filters offer: every piece of equipment, the QC catalog and everyone who made a record',
  })
  @ApiOkResponse({ schema: QcExecutionFilterOptionsSchema })
  async filterOptions(): Promise<QcExecutionFilterOptionsReadModel> {
    return this.queryBus.execute(new GetQcExecutionFilterOptionsQuery());
  }

  @Delete(':id')
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete one QC record; intervals, counts and last executions follow the records left',
  })
  @ApiNoContentResponse({ description: 'QC record deleted' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: QcExecutionNotFoundSchema })
  async delete(@Param() params: QcExecutionIdParams): Promise<void> {
    await this.commandBus.execute(
      new DeleteQcExecutionCommand(Identity.fromString(params.id)),
    );
  }
}

function idOrNull(id: string | undefined): Identity | null {
  return id === undefined ? null : Identity.fromString(id);
}

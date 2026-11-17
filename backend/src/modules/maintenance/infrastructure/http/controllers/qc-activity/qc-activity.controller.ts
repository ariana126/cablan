import { Identity } from '@framework/domain';
import {
  ApplyToRelatedRecordsResolver,
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  RecordHasDependentsSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { DefineQcActivityCommand } from '@maintenance/application/commands/define-qc-activity/define-qc-activity.command';
import { DeleteQcActivityCommand } from '@maintenance/application/commands/delete-qc-activity/delete-qc-activity.command';
import { RenameQcActivityCommand } from '@maintenance/application/commands/rename-qc-activity/rename-qc-activity.command';
import { ListQcActivitiesQuery } from '@maintenance/application/queries/list-qc-activities/list-qc-activities.query';
import { QcActivityReadModel } from '@maintenance/application/queries/list-qc-activities/qc-activity.read-model';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';
import { QC_MANAGER_ROLES } from '@maintenance/domain/value/qc-roles';
import {
  CreatedIdSchema,
  ForbiddenResponse,
} from '@maintenance/infrastructure/http/maintenance-schemas';
import {
  QcActivityNameTakenSchema,
  QcActivityNotFoundSchema,
  QcActivitySchema,
} from '@maintenance/infrastructure/http/qc-schemas';
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
  QcActivityDto,
  QcActivityIdParams,
  RenameQcActivityDto,
} from './dto/qc-activity.dto';

/** «فعالیت‌های QC» (issue #119): the catalog, defined independently of equipment. */
@ApiTags('QC Activities')
@ApiBearerAuth()
@Controller('qc-activities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...QC_MANAGER_ROLES)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse(ForbiddenResponse)
export class QcActivityController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly applyToRelatedRecords: ApplyToRelatedRecordsResolver,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Define a QC activity, assigned to no equipment' })
  @ApiCreatedResponse({ schema: CreatedIdSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiConflictResponse({ schema: QcActivityNameTakenSchema })
  async define(@Body() body: QcActivityDto): Promise<{ id: string }> {
    return this.commandBus.execute(
      new DefineQcActivityCommand(QcActivityName.fromString(body.name)),
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rename a QC activity' })
  @ApiNoContentResponse({ description: 'QC activity renamed' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: QcActivityNotFoundSchema })
  @ApiConflictResponse({
    description:
      '`qc-activity-name-taken`, or `record-has-dependents` while it is assigned to equipment or has a QC record — unless a System Admin confirms the correction with `applyToRelatedRecords`',
    schema: { oneOf: [QcActivityNameTakenSchema, RecordHasDependentsSchema] },
  })
  async rename(
    @Param() params: QcActivityIdParams,
    @Body() body: RenameQcActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new RenameQcActivityCommand(
        Identity.fromString(params.id),
        QcActivityName.fromString(body.name),
        await this.applyToRelatedRecords.askedBy(
          user,
          body.applyToRelatedRecords,
        ),
      ),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a QC activity neither assigned nor ever recorded',
  })
  @ApiNoContentResponse({ description: 'QC activity deleted' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiNotFoundResponse({ schema: QcActivityNotFoundSchema })
  @ApiConflictResponse({
    description:
      '`record-has-dependents` while it is assigned to equipment or has a QC record, even unassigned since',
    schema: RecordHasDependentsSchema,
  })
  async delete(@Param() params: QcActivityIdParams): Promise<void> {
    await this.commandBus.execute(
      new DeleteQcActivityCommand(Identity.fromString(params.id)),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List the QC catalog, by name' })
  @ApiOkResponse({ schema: { type: 'array', items: QcActivitySchema } })
  async list(): Promise<QcActivityReadModel[]> {
    return this.queryBus.execute(new ListQcActivitiesQuery());
  }
}

import { AuditLogChanges } from '@audit-logging/application/queries/get-audit-log-changes/audit-log-changes.read-model';
import { GetAuditLogChangesQuery } from '@audit-logging/application/queries/get-audit-log-changes/get-audit-log-changes.query';
import { AuditLogPage } from '@audit-logging/application/queries/list-audit-log/audit-log.read-model';
import { ListAuditLogQuery } from '@audit-logging/application/queries/list-audit-log/list-audit-log.query';
import { Identity, Role } from '@framework/domain';
import {
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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

import { ListAuditLogDto } from './dto/list-audit-log.dto';

// Not `as const`, unlike this codebase's other controller-local schema
// constants (e.g. `BomController`'s `BomSchema`): an `enum` array under a
// top-level `as const` becomes a `readonly` tuple, which the Swagger
// `SchemaObject` type rejects (`Role`-based schemas elsewhere sidestep this
// by building their `enum` from `Object.values(Role)`, a plain mutable
// array, rather than a literal one).
const AuditLogEntrySchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
    occurredAt: { type: 'string', example: '2026-06-22T09:45:00.000Z' },
    actorName: { type: 'string', example: 'مصطفی' },
    recordType: {
      type: 'string',
      enum: ['User', 'Product', 'Component', 'Material', 'StandardBom', 'Bom'],
      example: 'StandardBom',
    },
    recordId: {
      type: 'string',
      example: '66666666-6666-6666-6666-666666666666',
    },
    action: {
      type: 'string',
      enum: ['Registered', 'Edited', 'Deleted'],
      example: 'Edited',
    },
  },
};

const AuditLogPageSchema = {
  properties: {
    items: { type: 'array', items: AuditLogEntrySchema },
    total: { type: 'number', example: 10 },
  },
};

const AuditLogChangesSchema = {
  properties: {
    changes: {
      type: 'array',
      items: {
        properties: {
          field: { type: 'string', example: 'standardLength' },
          previousValue: { type: 'string', example: '305' },
          newValue: { type: 'string', example: '310' },
        },
      },
    },
  },
};

const ForbiddenResponse = {
  description: 'Not a System Admin',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('Audit Log')
@ApiBearerAuth()
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly queryBus: QueryBus) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search the system-wide audit log of mutating events across every module, newest first',
  })
  @ApiOkResponse({ schema: AuditLogPageSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  async list(@Body() body: ListAuditLogDto): Promise<AuditLogPage> {
    return this.queryBus.execute(
      new ListAuditLogQuery(body.page, body.pageSize, {
        actorName: body.actorName,
        recordId: body.recordId,
        from: body.from === undefined ? undefined : new Date(body.from),
        to: body.to === undefined ? undefined : new Date(body.to),
      }),
    );
  }

  @Get(':id/changes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @ApiOperation({
    summary: "Get a single audit log entry's field-level changes",
  })
  @ApiOkResponse({ schema: AuditLogChangesSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async changes(@Param('id') id: string): Promise<AuditLogChanges> {
    return this.queryBus.execute(
      new GetAuditLogChangesQuery(Identity.fromString(id)),
    );
  }
}

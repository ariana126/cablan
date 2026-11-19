import { Role } from '@framework/domain';
import {
  domainErrorSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
} from '@framework/infrastructure';
import { ImportPmPlansCommand } from '@maintenance/application/commands/import-pm-plans/import-pm-plans.command';
import { PmPlanImportFileUnreadable } from '@maintenance/application/exceptions';
import { PreviewPmPlanImportQuery } from '@maintenance/application/queries/preview-pm-plan-import/preview-pm-plan-import.query';
import { PmPlanImportPreview as PmPlanImportPreviewReadModel } from '@maintenance/application/service/pm-plan-import-result';
import { PM_PLAN_IMPORT_ERROR_REASONS } from '@maintenance/domain/service/pm-plan-import-check';
import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { PmPlanImportPreview } from './dto/pm-plan-import-preview.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const FileBody = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description:
          'The PM plan .xlsx (sheet «pm», else the first), at most 5 MB',
      },
    },
  },
};

const FileUnreadableSchema = domainErrorSchema(
  'pm-plan-import-file-unreadable',
  'PM Plan Import File Unreadable',
  400,
  'فایل بارگذاری شده یک فایل اکسل (xlsx) قابل خواندن نیست.',
);

// Hoisted rather than inline: `domainErrorSchema` types each member as
// `{ type, example }`, and this one carries `items` besides.
const ERRORS_EXTENSION = {
  errors: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        sheet: { type: 'string', example: 'pm' },
        cell: { type: 'string', example: 'D1' },
        row: { type: 'integer', example: 1 },
        column: { type: 'string', example: 'D' },
        value: { type: 'string', example: 'روغن کاری' },
        reason: { type: 'string', enum: PM_PLAN_IMPORT_ERROR_REASONS },
        message: { type: 'string', example: 'فعالیت تعریف نشده است' },
      },
    },
    example: [
      {
        sheet: 'pm',
        cell: 'D1',
        row: 1,
        column: 'D',
        value: 'روغن کاری',
        reason: 'activity-not-found',
        message: 'فعالیت تعریف نشده است',
      },
    ],
  },
};

/** The part of multer's file object this controller reads. */
interface UploadedSpreadsheet {
  readonly buffer: Buffer;
}

/**
 * Bulk import of PM plans from the plant's Excel matrix (issue #127) — the
 * System Admin's only. Preview a file, then confirm it by sending the same
 * file again; the confirmation adds every new item or none. The guards run
 * before the file interceptor, so a caller without the role is refused
 * before the upload is read.
 */
@ApiTags('PM Plan Imports')
@ApiBearerAuth()
@Controller('pm-plan-imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SystemAdmin)
@ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
@ApiForbiddenResponse({
  description: 'Not a System Admin user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
})
@ApiPayloadTooLargeResponse({ description: 'The file is larger than 5 MB' })
export class PmPlanImportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody(FileBody)
  @ApiOperation({
    summary:
      'Check a PM plan file: every error, the plan items it would add, those already in force and those differing from an active item (stores nothing)',
  })
  @ApiOkResponse({ type: PmPlanImportPreview })
  @ApiBadRequestResponse({
    description: 'No file, or not a readable .xlsx',
    schema: FileUnreadableSchema,
  })
  async preview(
    @UploadedFile() file: UploadedSpreadsheet | undefined,
  ): Promise<PmPlanImportPreviewReadModel> {
    if (!file) {
      throw PmPlanImportFileUnreadable.missing();
    }
    return this.queryBus.execute(new PreviewPmPlanImportQuery(file.buffer));
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody(FileBody)
  @ApiOperation({
    summary:
      'Import a PM plan file: checked again, then every new plan item added — all of them or none',
  })
  @ApiCreatedResponse({
    description: 'What was added, and what was already in force or differs',
    type: PmPlanImportPreview,
  })
  @ApiBadRequestResponse({
    description:
      'No file, not a readable .xlsx, or the file has errors (nothing added)',
    schema: {
      oneOf: [
        FileUnreadableSchema,
        domainErrorSchema(
          'pm-plan-import-has-errors',
          'PM Plan Import Has Errors',
          400,
          'فایل برنامه PM خطا دارد و هیچ برنامه ای ثبت نشد.',
          ERRORS_EXTENSION,
        ),
      ],
    },
  })
  async import(
    @UploadedFile() file: UploadedSpreadsheet | undefined,
  ): Promise<PmPlanImportPreviewReadModel> {
    if (!file) {
      throw PmPlanImportFileUnreadable.missing();
    }
    return this.commandBus.execute(new ImportPmPlansCommand(file.buffer));
  }
}

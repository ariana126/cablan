import { Identity, Role } from '@framework/domain';
import {
  domainErrorSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
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
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfirmMaterialImportCommand } from '@products/application/commands/confirm-material-import/confirm-material-import.command';
import { RevertMaterialImportCommand } from '@products/application/commands/revert-material-import/revert-material-import.command';
import { MaterialImportFileUnreadable } from '@products/application/exceptions';
import { MaterialImportPreview as MaterialImportPreviewReadModel } from '@products/application/queries/preview-material-import/material-import-preview.read-model';
import { PreviewMaterialImportQuery } from '@products/application/queries/preview-material-import/preview-material-import.query';

import { ConfirmMaterialImportDto } from './dto/confirm-material-import.dto';
import { MaterialImportPreview } from './dto/material-import-preview.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ROW_ERRORS = [
  'name-required',
  'code-required',
  'duplicate-name-in-file',
  'duplicate-code-in-file',
  'code-taken',
  'material-targeted-twice',
];

const IMPORT_ID_EXTENSION = {
  importId: {
    type: 'string',
    example: '550e8400-e29b-41d4-a716-446655440000',
  },
};

// Hoisted rather than inline: `domainErrorSchema` types each member as
// `{ type, example }`, and these carry `items`/`enum` besides.
const INVALID_ROWS_EXTENSION = {
  rows: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        row: { type: 'integer', example: 4 },
        name: { type: 'string', example: 'مسی' },
        code: { type: 'string', example: 'B-1' },
        errors: {
          type: 'array',
          items: { type: 'string', enum: ROW_ERRORS },
          example: ['code-taken'],
        },
      },
    },
    example: [{ row: 4, name: 'مسی', code: 'B-1', errors: ['code-taken'] }],
  },
};

const NOT_REVERTIBLE_EXTENSION = {
  ...IMPORT_ID_EXTENSION,
  reason: {
    type: 'string',
    enum: ['material-in-use', 'material-changed', 'value-taken'],
    example: 'material-in-use',
  },
};

const FileUnreadableSchema = domainErrorSchema(
  'material-import-file-unreadable',
  'Material Import File Unreadable',
  400,
  'No row of the spreadsheet holds both the «کد کالا» and «نام کالا» headers',
);

const ImportForbiddenResponse = {
  description: 'Not a System Admin or Management user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

/** The part of multer's file object this controller reads. */
interface UploadedSpreadsheet {
  readonly buffer: Buffer;
}

// Importing materials from the accounting software's Excel (issue #74):
// preview a file, confirm the rows kept, revert the latest import. The
// guards run before the file interceptor, so a caller without the role is
// refused before the upload is read.
@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialImportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('import-preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List what an accounting export would change in the registered materials (stores nothing)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'The .xlsx exported by the accounting software, at most 5 MB',
        },
      },
    },
  })
  @ApiOkResponse({ type: MaterialImportPreview })
  @ApiBadRequestResponse({
    description:
      'Not a readable .xlsx, or no header row naming «کد کالا» and «نام کالا»',
    schema: FileUnreadableSchema,
  })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ImportForbiddenResponse)
  @ApiPayloadTooLargeResponse({ description: 'The file is larger than 5 MB' })
  async preview(
    @UploadedFile() file: UploadedSpreadsheet | undefined,
  ): Promise<MaterialImportPreviewReadModel> {
    if (!file) {
      throw MaterialImportFileUnreadable.missing();
    }
    return this.queryBus.execute(new PreviewMaterialImportQuery(file.buffer));
  }

  @Post('imports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Apply the change-list rows kept from a preview — all of them or none',
  })
  @ApiCreatedResponse({
    description: 'The import was applied and recorded',
    schema: {
      properties: {
        id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'A kept row cannot be applied, nothing would change, or the body is malformed',
    schema: {
      oneOf: [
        domainErrorSchema(
          'material-import-has-invalid-rows',
          'Material Import Has Invalid Rows',
          400,
          '1 row(s) of the material import cannot be applied',
          INVALID_ROWS_EXTENSION,
        ),
        domainErrorSchema(
          'material-import-empty',
          'Material Import Empty',
          400,
          'The material import changes no material',
        ),
        ValidationErrorSchema,
      ],
    },
  })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ImportForbiddenResponse)
  async confirm(
    @Body() body: ConfirmMaterialImportDto,
  ): Promise<{ id: string }> {
    return this.commandBus.execute(
      new ConfirmMaterialImportCommand(
        body.rows.map(({ row, name, code }) => ({ row, name, code })),
      ),
    );
  }

  @Post('imports/:id/reversion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revert the latest material import still in place',
  })
  @ApiNoContentResponse({ description: 'The import was reverted' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse({
    description: 'Not a System Admin user',
    schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
  })
  @ApiNotFoundResponse({
    schema: domainErrorSchema(
      'material-import-not-found',
      'Material Import Not Found',
      404,
      'No material import exists with id 550e8400-e29b-41d4-a716-446655440000',
      IMPORT_ID_EXTENSION,
    ),
  })
  @ApiConflictResponse({
    description:
      'A later import is still in place, the import was already reverted, or what it changed has changed since',
    schema: {
      oneOf: [
        domainErrorSchema(
          'material-import-not-latest',
          'Material Import Not Latest',
          409,
          'Material import 550e8400-e29b-41d4-a716-446655440000 is not the latest import still in place',
          IMPORT_ID_EXTENSION,
        ),
        domainErrorSchema(
          'material-import-already-reverted',
          'Material Import Already Reverted',
          409,
          'Material import 550e8400-e29b-41d4-a716-446655440000 has already been reverted',
          IMPORT_ID_EXTENSION,
        ),
        domainErrorSchema(
          'material-import-not-revertible',
          'Material Import Not Revertible',
          409,
          'Material import 550e8400-e29b-41d4-a716-446655440000 can no longer be reverted: a material it registered is used by a product',
          NOT_REVERTIBLE_EXTENSION,
        ),
      ],
    },
  })
  async revert(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new RevertMaterialImportCommand(Identity.fromString(id)),
    );
  }
}

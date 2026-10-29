import { Identity, PRODUCTION_ROLES, Role } from '@framework/domain';
import {
  domainErrorSchema,
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  renderXlsxWorkbook,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
  xlsxAttachment,
  xlsxDownloadResponse,
} from '@framework/infrastructure';
import { DeleteManufacturingInstructionCommand } from '@manufacturing-instructions/application/commands/delete-manufacturing-instruction/delete-manufacturing-instruction.command';
import { EditManufacturingInstructionCommand } from '@manufacturing-instructions/application/commands/edit-manufacturing-instruction/edit-manufacturing-instruction.command';
import { RegisterManufacturingInstructionCommand } from '@manufacturing-instructions/application/commands/register-manufacturing-instruction/register-manufacturing-instruction.command';
import { ExportManufacturingInstructionsQuery } from '@manufacturing-instructions/application/queries/export-manufacturing-instructions/export-manufacturing-instructions.query';
import { ManufacturingInstructionExportResult } from '@manufacturing-instructions/application/queries/export-manufacturing-instructions/manufacturing-instruction-export.read-model';
import { GetManufacturingInstructionDetailQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/get-manufacturing-instruction-detail.query';
import { ManufacturingInstructionDetail } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/manufacturing-instruction-detail.read-model';
import { ListManufacturingInstructionsQuery } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/list-manufacturing-instructions.query';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { ManufacturingInstructionFilterOptionsQuery } from '@manufacturing-instructions/application/queries/manufacturing-instruction-filter-options/manufacturing-instruction-filter-options.query';
import { ManufacturingInstructionFilterOptions } from '@manufacturing-instructions/application/queries/manufacturing-instruction-filter-options/manufacturing-instruction-filter-options.read-model';
import { ManufacturingInstructionReportPage } from '@manufacturing-instructions/application/queries/report-manufacturing-instructions/manufacturing-instruction-report.read-model';
import { ReportManufacturingInstructionsQuery } from '@manufacturing-instructions/application/queries/report-manufacturing-instructions/report-manufacturing-instructions.query';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import {
  buildManufacturingInstructionExportGrid,
  STANDARD_BOM_EXPORT_FILE_NAME,
} from '@manufacturing-instructions/infrastructure/spreadsheet/standard-bom-export-grid';
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
  StreamableFile,
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

import { ExportStandardBomsDto } from './dto/export-standard-boms.dto';
import { RegisterStandardBomDto } from './dto/register-standard-bom.dto';
import { ReportStandardBomsDto } from './dto/report-standard-boms.dto';
import { UpdateStandardBomDto } from './dto/update-standard-bom.dto';

const ManufacturingInstructionCompositionSchema = {
  type: 'array',
  items: {
    properties: {
      id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
      name: { type: 'string', example: 'Bolt' },
      materials: {
        type: 'array',
        items: {
          properties: {
            id: {
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440002',
            },
            name: { type: 'string', example: 'Steel Rod' },
            weight: { type: 'number', example: 150 },
          },
        },
      },
    },
  },
} as const;

const ManufacturingInstructionSchema = {
  properties: {
    id: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440003',
    },
    miCode: { type: 'string', example: '1234' },
    brand: { type: 'string', example: 'Legrand' },
    standardLength: { type: 'number', example: 305 },
    active: { type: 'boolean', example: true },
    description: { type: 'string', example: 'Standard for network cables' },
    productId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    components: ManufacturingInstructionCompositionSchema,
  },
} as const;

const ManufacturingInstructionReportItemSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    miCode: { type: 'string', example: '1001' },
    brand: { type: 'string', example: 'لگراند' },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
    active: { type: 'boolean', example: true },
  },
} as const;

const ManufacturingInstructionReportPageSchema = {
  properties: {
    items: { type: 'array', items: ManufacturingInstructionReportItemSchema },
    total: { type: 'number', example: 4 },
  },
} as const;

const ManufacturingInstructionFilterOptionsSchema = {
  properties: {
    brands: { type: 'array', items: { type: 'string' }, example: ['لگراند'] },
    activeStatuses: {
      type: 'array',
      items: { type: 'boolean' },
      example: [true, false],
    },
    productNames: {
      type: 'array',
      items: { type: 'string' },
      example: ['کابل شبکه U/UTP 0.42 LEGRAND'],
    },
    componentNames: {
      type: 'array',
      items: { type: 'string' },
      example: ['مغزی'],
    },
    miCodes: {
      type: 'array',
      items: { type: 'string' },
      example: ['1001'],
    },
  },
} as const;

const ManufacturingInstructionDetailSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    miCode: { type: 'string', example: '1001' },
    brand: { type: 'string', example: 'لگراند' },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
    standardLength: { type: 'number', example: 305 },
    active: { type: 'boolean', example: true },
    description: { type: 'string', example: 'بررسی کیفیت اولیه' },
    components: ManufacturingInstructionCompositionSchema,
    totalWeight: { type: 'number', example: 23 },
  },
} as const;

const ManufacturingInstructionMiCodeAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'standard-bom-mi-code-already-exists',
    'Standard BOM MI Code Already Exists',
    409,
    'A standard BOM already exists with MI code 1234',
    { miCode: { type: 'string', example: '1234' } },
  ),
};

const ManufacturingInstructionMustHaveAtLeastOneComponentResponse = {
  schema: domainErrorSchema(
    'standard-bom-must-have-at-least-one-component',
    'Standard BOM Must Have At Least One Component',
    400,
    'A standard BOM must have at least one component',
  ),
};

const ManufacturingInstructionComponentMustHaveAtLeastOneMaterialResponse = {
  schema: domainErrorSchema(
    'standard-bom-component-must-have-at-least-one-material',
    'Standard BOM Component Must Have At Least One Material',
    400,
    'Component 550e8400-e29b-41d4-a716-446655440001 must have at least one material',
    {
      componentId: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  ),
};

// Thrown while registering or editing: the given `productId` doesn't resolve
// to an existing product. See `ManufacturingInstructionCompositionFactory` and
// src/modules/manufacturing-instructions/CLAUDE.md.
const ManufacturingInstructionProductNotFoundResponse = {
  schema: domainErrorSchema(
    'standard-bom-product-not-found',
    'Standard BOM Product Not Found',
    400,
    'No product exists with id 550e8400-e29b-41d4-a716-446655440000',
    {
      productId: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  ),
};

// Thrown while registering or editing: a requested (componentId, materialId)
// pair isn't part of the referenced product's *current* composition.
const ManufacturingInstructionCompositionEntryNotFoundResponse = {
  schema: domainErrorSchema(
    'standard-bom-composition-entry-not-found',
    'Standard BOM Composition Entry Not Found',
    400,
    "No component with id 550e8400-e29b-41d4-a716-446655440001 exists in the referenced product's current composition",
    {
      entryId: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  ),
};

const ForbiddenResponse = {
  description: 'Not a System Admin or Management user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('Standard BOMs')
@ApiBearerAuth()
@Controller('standard-boms')
export class StandardBomController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Register a new Standard BOM, cloning the referenced product's current composition",
  })
  @ApiCreatedResponse({
    description: 'Standard BOM registered successfully',
    schema: ManufacturingInstructionSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(
    ManufacturingInstructionMustHaveAtLeastOneComponentResponse,
  )
  @ApiBadRequestResponse(
    ManufacturingInstructionComponentMustHaveAtLeastOneMaterialResponse,
  )
  @ApiBadRequestResponse(ManufacturingInstructionProductNotFoundResponse)
  @ApiBadRequestResponse(
    ManufacturingInstructionCompositionEntryNotFoundResponse,
  )
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiConflictResponse(ManufacturingInstructionMiCodeAlreadyExistsResponse)
  async register(
    @Body() body: RegisterStandardBomDto,
  ): Promise<ManufacturingInstructionReadModel> {
    return this.commandBus.execute(
      new RegisterManufacturingInstructionCommand(
        Identity.fromString(body.productId),
        MiCode.fromString(body.miCode),
        Brand.fromString(body.brand),
        StandardLength.of(body.standardLength),
        body.active,
        body.description,
        body.components,
      ),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Edit an existing Standard BOM's fields and/or composition, replacing its components wholesale",
  })
  @ApiNoContentResponse({ description: 'Standard BOM updated successfully' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(
    ManufacturingInstructionMustHaveAtLeastOneComponentResponse,
  )
  @ApiBadRequestResponse(
    ManufacturingInstructionComponentMustHaveAtLeastOneMaterialResponse,
  )
  @ApiBadRequestResponse(ManufacturingInstructionProductNotFoundResponse)
  @ApiBadRequestResponse(
    ManufacturingInstructionCompositionEntryNotFoundResponse,
  )
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(ManufacturingInstructionMiCodeAlreadyExistsResponse)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStandardBomDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditManufacturingInstructionCommand(
        Identity.fromString(id),
        body.miCode === undefined ? undefined : MiCode.fromString(body.miCode),
        body.brand === undefined ? undefined : Brand.fromString(body.brand),
        body.standardLength === undefined
          ? undefined
          : StandardLength.of(body.standardLength),
        body.description,
        body.active,
        body.components,
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a Standard BOM' })
  @ApiNoContentResponse({ description: 'Standard BOM deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteManufacturingInstructionCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({ summary: 'List every registered Standard BOM' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiOkResponse({
    schema: { type: 'array', items: ManufacturingInstructionSchema },
  })
  async list(): Promise<ManufacturingInstructionReadModel[]> {
    return this.queryBus.execute(new ListManufacturingInstructionsQuery());
  }

  // No `@Roles()` here, deliberately, on this and the two endpoints below:
  // mirrors `boms/CLAUDE.md`'s reasoning — the report is exactly what
  // "گزارشگیر" (Reporter) exists to read.
  @Post('report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search standard BOMs with pagination, Excel-style filters and productName sort, paginated and projected to the list view',
  })
  @ApiOkResponse({ schema: ManufacturingInstructionReportPageSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async report(
    @Body() body: ReportStandardBomsDto,
  ): Promise<ManufacturingInstructionReportPage> {
    return this.queryBus.execute(
      new ReportManufacturingInstructionsQuery(
        body.page,
        body.pageSize,
        undefined,
        body.filters?.brands,
        body.filters?.activeStatuses,
        body.filters?.productNames,
        body.filters?.componentNames,
        body.filters?.miCodes,
        body.sortBy,
        body.sortDir,
      ),
    );
  }

  // No `@Roles()` here either, for the same reason as `report()` above: this
  // is "خروجی اکسل آنالیز های استاندارد", the Reporter's download. The query
  // returns the export set; shaping it into rows and writing the workbook is
  // presentation, so it happens here, mirroring `boms/`'s own `export()`. See
  // src/modules/manufacturing-instructions/CLAUDE.md.
  @Post('report/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Export every standard BOM matching the given filters, unpaginated, as an .xlsx workbook in the chosen row layout',
  })
  @ApiOkResponse(xlsxDownloadResponse(STANDARD_BOM_EXPORT_FILE_NAME))
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async export(@Body() body: ExportStandardBomsDto): Promise<StreamableFile> {
    const result: ManufacturingInstructionExportResult =
      await this.queryBus.execute(
        new ExportManufacturingInstructionsQuery({
          brands: body.filters?.brands,
          activeStatuses: body.filters?.activeStatuses,
          productNames: body.filters?.productNames,
          componentNames: body.filters?.componentNames,
          miCodes: body.filters?.miCodes,
        }),
      );
    const workbook = await renderXlsxWorkbook(
      buildManufacturingInstructionExportGrid(result.items, body.format),
    );
    return xlsxAttachment(workbook, STANDARD_BOM_EXPORT_FILE_NAME);
  }

  @Get('report/filter-options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({
    summary:
      'List every distinct filterable value across all registered standard BOMs, unfiltered',
  })
  @ApiOkResponse({ schema: ManufacturingInstructionFilterOptionsSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async filterOptions(): Promise<ManufacturingInstructionFilterOptions> {
    return this.queryBus.execute(
      new ManufacturingInstructionFilterOptionsQuery(),
    );
  }

  @Get('report/detail/:miCode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({
    summary:
      "Get a single standard BOM's full detail by MI code, including its composition and total weight",
  })
  @ApiOkResponse({ schema: ManufacturingInstructionDetailSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async detail(
    @Param('miCode') miCode: string,
  ): Promise<ManufacturingInstructionDetail> {
    return this.queryBus.execute(
      new GetManufacturingInstructionDetailQuery(miCode),
    );
  }
}

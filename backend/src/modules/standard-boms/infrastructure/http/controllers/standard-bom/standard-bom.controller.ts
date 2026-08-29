import { Identity, Role } from '@framework/domain';
import {
  domainErrorSchema,
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
import { DeleteStandardBomCommand } from '@standard-boms/application/commands/delete-standard-bom/delete-standard-bom.command';
import { EditStandardBomCommand } from '@standard-boms/application/commands/edit-standard-bom/edit-standard-bom.command';
import { RegisterStandardBomCommand } from '@standard-boms/application/commands/register-standard-bom/register-standard-bom.command';
import { GetStandardBomDetailQuery } from '@standard-boms/application/queries/get-standard-bom-detail/get-standard-bom-detail.query';
import { StandardBomDetail } from '@standard-boms/application/queries/get-standard-bom-detail/standard-bom-detail.read-model';
import { ListStandardBomsQuery } from '@standard-boms/application/queries/list-standard-boms/list-standard-boms.query';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';
import { ReportStandardBomsQuery } from '@standard-boms/application/queries/report-standard-boms/report-standard-boms.query';
import { StandardBomReportPage } from '@standard-boms/application/queries/report-standard-boms/standard-bom-report.read-model';
import { StandardBomFilterOptionsQuery } from '@standard-boms/application/queries/standard-bom-filter-options/standard-bom-filter-options.query';
import { StandardBomFilterOptions } from '@standard-boms/application/queries/standard-bom-filter-options/standard-bom-filter-options.read-model';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';

import { RegisterStandardBomDto } from './dto/register-standard-bom.dto';
import { ReportStandardBomsDto } from './dto/report-standard-boms.dto';
import { UpdateStandardBomDto } from './dto/update-standard-bom.dto';

const StandardBomCompositionSchema = {
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

const StandardBomSchema = {
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
    components: StandardBomCompositionSchema,
  },
} as const;

const StandardBomReportItemSchema = {
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

const StandardBomReportPageSchema = {
  properties: {
    items: { type: 'array', items: StandardBomReportItemSchema },
    total: { type: 'number', example: 4 },
  },
} as const;

const StandardBomFilterOptionsSchema = {
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
  },
} as const;

const StandardBomDetailSchema = {
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
    components: StandardBomCompositionSchema,
    totalWeight: { type: 'number', example: 23 },
  },
} as const;

const StandardBomMiCodeAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'standard-bom-mi-code-already-exists',
    'Standard BOM MI Code Already Exists',
    409,
    'A standard BOM already exists with MI code 1234',
    { miCode: { type: 'string', example: '1234' } },
  ),
};

const StandardBomMustHaveAtLeastOneComponentResponse = {
  schema: domainErrorSchema(
    'standard-bom-must-have-at-least-one-component',
    'Standard BOM Must Have At Least One Component',
    400,
    'A standard BOM must have at least one component',
  ),
};

const StandardBomComponentMustHaveAtLeastOneMaterialResponse = {
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
// to an existing product. See `StandardBomCompositionFactory` and
// src/modules/standard-boms/CLAUDE.md.
const StandardBomProductNotFoundResponse = {
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
const StandardBomCompositionEntryNotFoundResponse = {
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
    schema: StandardBomSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(StandardBomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(StandardBomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(StandardBomProductNotFoundResponse)
  @ApiBadRequestResponse(StandardBomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiConflictResponse(StandardBomMiCodeAlreadyExistsResponse)
  async register(
    @Body() body: RegisterStandardBomDto,
  ): Promise<StandardBomReadModel> {
    return this.commandBus.execute(
      new RegisterStandardBomCommand(
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
  @ApiBadRequestResponse(StandardBomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(StandardBomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(StandardBomProductNotFoundResponse)
  @ApiBadRequestResponse(StandardBomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(StandardBomMiCodeAlreadyExistsResponse)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStandardBomDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditStandardBomCommand(
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
      new DeleteStandardBomCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List every registered Standard BOM' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiOkResponse({
    schema: { type: 'array', items: StandardBomSchema },
  })
  async list(): Promise<StandardBomReadModel[]> {
    return this.queryBus.execute(new ListStandardBomsQuery());
  }

  // No `@Roles()` here, deliberately, on this and the two endpoints below:
  // mirrors `boms/CLAUDE.md`'s reasoning — the report is exactly what
  // "گزارشگیر" (Reporter) exists to read.
  @Post('report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search standard BOMs with pagination, Excel-style filters and productName sort, paginated and projected to the list view',
  })
  @ApiOkResponse({ schema: StandardBomReportPageSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async report(
    @Body() body: ReportStandardBomsDto,
  ): Promise<StandardBomReportPage> {
    return this.queryBus.execute(
      new ReportStandardBomsQuery(
        body.page,
        body.pageSize,
        undefined,
        body.filters?.brands,
        body.filters?.activeStatuses,
        body.filters?.productNames,
        body.filters?.componentNames,
        body.sortBy,
        body.sortDir,
      ),
    );
  }

  @Get('report/filter-options')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'List every distinct filterable value across all registered standard BOMs, unfiltered',
  })
  @ApiOkResponse({ schema: StandardBomFilterOptionsSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async filterOptions(): Promise<StandardBomFilterOptions> {
    return this.queryBus.execute(new StandardBomFilterOptionsQuery());
  }

  @Get('report/detail/:miCode')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      "Get a single standard BOM's full detail by MI code, including its composition and total weight",
  })
  @ApiOkResponse({ schema: StandardBomDetailSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async detail(@Param('miCode') miCode: string): Promise<StandardBomDetail> {
    return this.queryBus.execute(new GetStandardBomDetailQuery(miCode));
  }
}

import { DeleteBomCommand } from '@boms/application/commands/delete-bom/delete-bom.command';
import { EditBomCommand } from '@boms/application/commands/edit-bom/edit-bom.command';
import { RegisterBomCommand } from '@boms/application/commands/register-bom/register-bom.command';
import { BomFilterOptionsQuery } from '@boms/application/queries/bom-filter-options/bom-filter-options.query';
import { BomFilterOptions } from '@boms/application/queries/bom-filter-options/bom-filter-options.read-model';
import { BomDetail } from '@boms/application/queries/get-bom/bom-detail.read-model';
import { GetBomQuery } from '@boms/application/queries/get-bom/get-bom.query';
import { BomReadModel } from '@boms/application/queries/list-boms/bom.read-model';
import { ListBomsQuery } from '@boms/application/queries/list-boms/list-boms.query';
import { BomReportPage } from '@boms/application/queries/report-boms/bom-report.read-model';
import { ReportBomsQuery } from '@boms/application/queries/report-boms/report-boms.query';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { DisplayNameProvider, Identity, Role } from '@framework/domain';
import {
  AuthenticatedUser,
  CurrentUser,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RegisterBomDto } from './dto/register-bom.dto';
import { ReportBomsDto } from './dto/report-boms.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

const BomCompositionSchema = {
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

const BomSchema = {
  properties: {
    id: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440003',
    },
    standardBomId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    orderNumber: { type: 'string', example: 'SO-1234' },
    trackingNumber: { type: 'string', example: 'TN-5678' },
    description: { type: 'string', example: 'Daily BOM for order SO-1234' },
    components: BomCompositionSchema,
  },
} as const;

const BomReportItemSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    orderNumber: { type: 'string', example: 'ORD-2001' },
    trackingNumber: { type: 'string', example: 'TRK-3001' },
    registeredAt: { type: 'string', example: '2026-06-22T04:00:00.000Z' },
    registeredBy: { type: 'string', example: 'نیکروش' },
    standardBomMiCode: { type: 'string', example: '1001' },
    brand: { type: 'string', example: 'لگراند' },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
  },
} as const;

const BomReportPageSchema = {
  properties: {
    items: { type: 'array', items: BomReportItemSchema },
    total: { type: 'number', example: 4 },
  },
} as const;

const BomFilterOptionsSchema = {
  properties: {
    brands: { type: 'array', items: { type: 'string' }, example: ['لگراند'] },
    componentNames: {
      type: 'array',
      items: { type: 'string' },
      example: ['مغزی'],
    },
    standardBomMiCodes: {
      type: 'array',
      items: { type: 'string' },
      example: ['1001'],
    },
    productNames: {
      type: 'array',
      items: { type: 'string' },
      example: ['کابل شبکه U/UTP 0.42 LEGRAND'],
    },
    registeredByUsers: {
      type: 'array',
      items: { type: 'string' },
      example: ['نیکروش'],
    },
  },
} as const;

const BomDetailSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    standardBomId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    standardBomMiCode: { type: 'string', example: '1001' },
    brand: { type: 'string', example: 'لگراند' },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
    standardLength: { type: 'number', example: 305 },
    orderNumber: { type: 'string', example: 'ORD-2001' },
    trackingNumber: { type: 'string', example: 'TRK-3001' },
    registeredBy: { type: 'string', example: 'نیکروش' },
    registeredAt: { type: 'string', example: '2026-06-22T04:00:00.000Z' },
    description: { type: 'string', example: 'بررسی کیفیت اولیه' },
    components: BomCompositionSchema,
    totalWeight: { type: 'number', example: 23 },
  },
} as const;

const BomMustHaveAtLeastOneComponentResponse = {
  schema: domainErrorSchema(
    'bom-must-have-at-least-one-component',
    'BOM Must Have At Least One Component',
    400,
    'A BOM must have at least one component',
  ),
};

const BomComponentMustHaveAtLeastOneMaterialResponse = {
  schema: domainErrorSchema(
    'bom-component-must-have-at-least-one-material',
    'BOM Component Must Have At Least One Material',
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

// Thrown while registering or editing: the given `standardBomMiCode` doesn't
// resolve to an existing standard BOM. See `BomCompositionFactory` and
// src/modules/boms/CLAUDE.md.
const BomStandardBomNotFoundResponse = {
  schema: domainErrorSchema(
    'bom-standard-bom-not-found',
    'BOM Standard BOM Not Found',
    400,
    'No standard BOM exists with MI code 0001',
    {
      standardBomMiCode: { type: 'string', example: '0001' },
    },
  ),
};

// Thrown while registering or editing: a requested (componentId, materialId)
// pair isn't part of the referenced standard BOM's *current* composition.
const BomCompositionEntryNotFoundResponse = {
  schema: domainErrorSchema(
    'bom-composition-entry-not-found',
    'BOM Composition Entry Not Found',
    400,
    "No component with id 550e8400-e29b-41d4-a716-446655440001 exists in the referenced standard BOM's current composition",
    {
      entryId: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  ),
};

const ForbiddenResponse = {
  description: 'Not a QC Inspector, Management or System Admin user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('BOMs')
@ApiBearerAuth()
@Controller('boms')
export class BomController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly displayNameProvider: DisplayNameProvider,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Register a new daily BOM, cloning the referenced standard BOM's current composition",
  })
  @ApiCreatedResponse({
    description: 'BOM registered successfully',
    schema: BomSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(BomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(BomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(BomStandardBomNotFoundResponse)
  @ApiBadRequestResponse(BomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  async register(
    @Body() body: RegisterBomDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<BomReadModel> {
    const registeredBy = await this.displayNameProvider.getName(actingUser.id);
    return this.commandBus.execute(
      new RegisterBomCommand(
        body.standardBomMiCode,
        OrderNumber.fromString(body.orderNumber),
        TrackingNumber.fromString(body.trackingNumber),
        body.description,
        body.components,
        registeredBy,
      ),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Edit an existing daily BOM's fields and/or composition, replacing its components wholesale",
  })
  @ApiNoContentResponse({ description: 'BOM updated successfully' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(BomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(BomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(BomStandardBomNotFoundResponse)
  @ApiBadRequestResponse(BomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBomDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditBomCommand(
        Identity.fromString(id),
        body.orderNumber === undefined
          ? undefined
          : OrderNumber.fromString(body.orderNumber),
        body.trackingNumber === undefined
          ? undefined
          : TrackingNumber.fromString(body.trackingNumber),
        body.description,
        body.components,
        body.standardBomMiCode,
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a daily BOM' })
  @ApiNoContentResponse({ description: 'BOM deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteBomCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List every registered daily BOM' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiOkResponse({
    schema: { type: 'array', items: BomSchema },
  })
  async list(): Promise<BomReadModel[]> {
    return this.queryBus.execute(new ListBomsQuery());
  }

  // No `@Roles()` here, deliberately, on this and the two endpoints below:
  // this report is exactly what the "گزارشگیر" (Reporter) role — excluded
  // from every write endpoint above — exists to read. See
  // src/modules/boms/CLAUDE.md.
  @Post('report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search daily BOMs with pagination and Excel-style filters, newest-registered first',
  })
  @ApiOkResponse({ schema: BomReportPageSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async report(@Body() body: ReportBomsDto): Promise<BomReportPage> {
    return this.queryBus.execute(
      new ReportBomsQuery(body.page, body.pageSize, {
        brands: body.filters?.brands,
        componentNames: body.filters?.componentNames,
        standardBomMiCodes: body.filters?.standardBomMiCodes,
        productNames: body.filters?.productNames,
        registeredByUsers: body.filters?.registeredByUsers,
        registeredAtFrom:
          body.filters?.registeredAtFrom === undefined
            ? undefined
            : new Date(body.filters.registeredAtFrom),
        registeredAtTo:
          body.filters?.registeredAtTo === undefined
            ? undefined
            : new Date(body.filters.registeredAtTo),
      }),
    );
  }

  @Get('report/filter-options')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'List every distinct filterable value across all registered daily BOMs, unfiltered',
  })
  @ApiOkResponse({ schema: BomFilterOptionsSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async filterOptions(): Promise<BomFilterOptions> {
    return this.queryBus.execute(new BomFilterOptionsQuery());
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      "Get a single daily BOM's full detail, including its composition and total weight",
  })
  @ApiOkResponse({ schema: BomDetailSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async get(@Param('id') id: string): Promise<BomDetail> {
    return this.queryBus.execute(new GetBomQuery(Identity.fromString(id)));
  }
}

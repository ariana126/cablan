import { DeleteBomCommand } from '@boms/application/commands/delete-bom/delete-bom.command';
import { EditBomCommand } from '@boms/application/commands/edit-bom/edit-bom.command';
import { RegisterBomCommand } from '@boms/application/commands/register-bom/register-bom.command';
import { BomReadModel } from '@boms/application/queries/list-boms/bom.read-model';
import { ListBomsQuery } from '@boms/application/queries/list-boms/list-boms.query';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
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
  async register(@Body() body: RegisterBomDto): Promise<BomReadModel> {
    return this.commandBus.execute(
      new RegisterBomCommand(
        body.standardBomMiCode,
        OrderNumber.fromString(body.orderNumber),
        TrackingNumber.fromString(body.trackingNumber),
        body.description,
        body.components,
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
}

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
import { DeleteProductCommand } from '@products/application/commands/delete-product/delete-product.command';
import { EditProductCommand } from '@products/application/commands/edit-product/edit-product.command';
import { RegisterProductCommand } from '@products/application/commands/register-product/register-product.command';
import { ListProductsQuery } from '@products/application/queries/list-products/list-products.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import { ProductName } from '@products/domain/value/product-name.vo';

import { RegisterProductDto } from './dto/register-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const ProductCompositionSchema = {
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
          },
        },
      },
    },
  },
} as const;

const ProductSchema = {
  properties: {
    id: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    name: { type: 'string', example: 'Widget' },
    components: ProductCompositionSchema,
  },
} as const;

// Reused verbatim from `ComponentsExceptionMapper`/`MaterialsExceptionMapper`:
// `ProductCompositionFactory` can surface either while creating a new
// component's/material's master row on this product's behalf — see
// src/modules/products/CLAUDE.md.
const ComponentNameAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'component-name-already-exists',
    'Component Name Already Exists',
    409,
    'A component already exists with name Bolt',
    { name: { type: 'string', example: 'Bolt' } },
  ),
};

const MaterialNameAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'material-name-already-exists',
    'Material Name Already Exists',
    409,
    'A material already exists with name Steel Rod',
    { name: { type: 'string', example: 'Steel Rod' } },
  ),
};

// Editing a product: a composition entry's `id` must belong to this
// product's *current* composition (see
// `ProductCompositionFactory.reconcileComponentLines`); otherwise the edit
// is rejected outright rather than silently registering it as new.
const ProductCompositionEntryNotFoundResponse = {
  schema: domainErrorSchema(
    'product-composition-entry-not-found',
    'Product Composition Entry Not Found',
    400,
    "No component with id 550e8400-e29b-41d4-a716-446655440001 exists in this product's current composition",
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

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
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
      'Register a new product, creating a new component and material for every one listed',
  })
  @ApiCreatedResponse({
    description: 'Product registered successfully',
    schema: ProductSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiConflictResponse(ComponentNameAlreadyExistsResponse)
  @ApiConflictResponse(MaterialNameAlreadyExistsResponse)
  async register(@Body() body: RegisterProductDto): Promise<ProductReadModel> {
    return this.commandBus.execute(
      new RegisterProductCommand(
        ProductName.fromString(body.name),
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
      "Edit an existing product's name and/or composition, replacing its components wholesale",
  })
  @ApiNoContentResponse({ description: 'Product updated successfully' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(ProductCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(ComponentNameAlreadyExistsResponse)
  @ApiConflictResponse(MaterialNameAlreadyExistsResponse)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditProductCommand(
        Identity.fromString(id),
        body.name === undefined ? undefined : ProductName.fromString(body.name),
        body.components,
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiNoContentResponse({ description: 'Product deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteProductCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List every registered product' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiOkResponse({
    schema: { type: 'array', items: ProductSchema },
  })
  async list(): Promise<ProductReadModel[]> {
    return this.queryBus.execute(new ListProductsQuery());
  }
}

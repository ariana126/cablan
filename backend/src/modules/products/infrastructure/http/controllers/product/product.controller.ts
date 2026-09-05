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

// A component/material name given in the request must already be registered
// in the `components`/`materials` module: `ProductCompositionFactory` only
// ever resolves an existing master row by exact name, it never creates one
// on this product's behalf. See src/modules/products/CLAUDE.md.
const ComponentNotRegisteredResponse = {
  schema: domainErrorSchema(
    'component-not-registered',
    'Component Not Registered',
    400,
    'No component named "Bolt" is registered',
    { componentName: { type: 'string', example: 'Bolt' } },
  ),
};

const MaterialNotRegisteredResponse = {
  schema: domainErrorSchema(
    'material-not-registered',
    'Material Not Registered',
    400,
    'No material named "Steel Rod" is registered',
    { materialName: { type: 'string', example: 'Steel Rod' } },
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
      'Register a new product, resolving every listed component and material to a row already registered in components/materials',
  })
  @ApiCreatedResponse({
    description: 'Product registered successfully',
    schema: ProductSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(ComponentNotRegisteredResponse)
  @ApiBadRequestResponse(MaterialNotRegisteredResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
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
  @ApiBadRequestResponse(ComponentNotRegisteredResponse)
  @ApiBadRequestResponse(MaterialNotRegisteredResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
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

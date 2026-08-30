import { GetProductDailyBomsQuery } from '@boms/application/queries/get-product-daily-boms/get-product-daily-boms.query';
import { ProductDailyBom } from '@boms/application/queries/get-product-daily-boms/product-daily-bom.read-model';
import { ListDashboardProductsQuery } from '@boms/application/queries/list-dashboard-products/list-dashboard-products.query';
import { ProductDashboardSummary } from '@boms/application/queries/list-dashboard-products/product-dashboard-summary.read-model';
import { Identity } from '@framework/domain';
import {
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { DashboardProductsDto } from './dto/dashboard-products.dto';
import { ProductDailyBomsDto } from './dto/product-daily-boms.dto';

// Read-only sidecar of `BomController`: the two endpoints that drive the
// "داشبورد بررسی روزانه آنالیز های روزانه" page. Like the reporting
// endpoints on `BomController` (`POST /boms/report`, `GET /boms/:id`),
// this controller deliberately has **no** `@Roles()` — the "گزارشگیر"
// (Reporter) persona, which is excluded from every write endpoint on
// `BomController`, is exactly who this dashboard exists for. See
// src/modules/boms/CLAUDE.md.
//
// Both endpoints take the same `from`/`to` optional pair (absent means
// "unfiltered", inclusive-on-both-ends when present) and are wired
// through the `QueryBus` to their own application handlers — no direct
// call into the dashboard repository from here.
//
// One intentional non-404: a `:productId` that doesn't resolve to an
// existing product is *not* a 404 from this controller. The application
// handler does not validate the productId (it just passes it through to
// the repository's `listProductDailyBoms`, which returns an empty list
// when no standard BOMs match that productId), and adding a 404 here
// would mean introducing a new domain exception type just to surface
// "this productId had no daily BOMs in range" — a case the dashboard
// already renders correctly as an empty list. The only practical
// "product not found" surface is a query that returns an empty list;
// rather than special-case it, the controller lets that fall through
// as a 200 with `items: []`. This matches how `GET /boms/report` treats
// "no BOMs match these filters" — the same "empty set is a valid
// response, not an error" convention.
const DashboardProductSchema = {
  properties: {
    productId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440010',
    },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
    dailyBomCount: { type: 'number', example: 4 },
  },
} as const;

const DashboardProductsResponseSchema = {
  properties: {
    items: { type: 'array', items: DashboardProductSchema },
  },
} as const;

const ProductDailyBomLineSchema = {
  properties: {
    componentName: { type: 'string', example: 'مغزی' },
    materialName: { type: 'string', example: 'مس' },
    actualWeight: { type: 'number', example: 12 },
    standardWeight: { type: 'number', example: 10 },
  },
} as const;

const ProductDailyBomSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    orderNumber: { type: 'string', example: 'ORD-2001' },
    registeredAt: { type: 'string', example: '2026-06-22T04:00:00.000Z' },
    description: { type: 'string', example: 'بررسی کیفیت اولیه' },
    score: { type: 'number', example: 3 },
    lines: { type: 'array', items: ProductDailyBomLineSchema },
  },
} as const;

const ProductDailyBomsResponseSchema = {
  properties: {
    items: { type: 'array', items: ProductDailyBomSchema },
  },
} as const;

@ApiTags('boms-dashboard')
@ApiBearerAuth()
@Controller('boms/dashboard')
export class BomDashboardController {
  constructor(private readonly queryBus: QueryBus) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "List every product with at least one daily BOM in the given range, with each product's daily-BOM count, sorted by product name ascending",
  })
  @ApiOkResponse({ schema: DashboardProductsResponseSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async listProducts(
    @Body() body: DashboardProductsDto,
  ): Promise<{ items: ProductDashboardSummary[] }> {
    const items: ProductDashboardSummary[] = await this.queryBus.execute(
      new ListDashboardProductsQuery(
        body.from === undefined ? undefined : new Date(body.from),
        body.to === undefined ? undefined : new Date(body.to),
      ),
    );
    return { items };
  }

  @Post(':productId/daily-boms')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "List every daily BOM for the given product in the given range, with each BOM's score (sum of |actualWeight - standardWeight| over its material lines) and a breakdown of those lines, sorted by score descending",
  })
  @ApiOkResponse({ schema: ProductDailyBomsResponseSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async listProductDailyBoms(
    @Param('productId') productId: string,
    @Body() body: ProductDailyBomsDto,
  ): Promise<{ items: ProductDailyBom[] }> {
    const items: ProductDailyBom[] = await this.queryBus.execute(
      new GetProductDailyBomsQuery(
        Identity.fromString(productId),
        body.from === undefined ? undefined : new Date(body.from),
        body.to === undefined ? undefined : new Date(body.to),
      ),
    );
    return { items };
  }
}

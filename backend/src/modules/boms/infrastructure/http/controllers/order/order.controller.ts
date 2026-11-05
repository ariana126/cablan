import { AddOrderMiCodeCommand } from '@boms/application/commands/add-order-mi-code/add-order-mi-code.command';
import { DefineOrderCommand } from '@boms/application/commands/define-order/define-order.command';
import { DeleteOrderCommand } from '@boms/application/commands/delete-order/delete-order.command';
import { EditOrderCommand } from '@boms/application/commands/edit-order/edit-order.command';
import { GetOrderQuery } from '@boms/application/queries/get-order/get-order.query';
import { GetOrderByNumberQuery } from '@boms/application/queries/get-order-by-number/get-order-by-number.query';
import { ListOrdersQuery } from '@boms/application/queries/list-orders/list-orders.query';
import {
  OrderList,
  OrderReadModel,
} from '@boms/application/queries/list-orders/order.read-model';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import {
  Identity,
  PRODUCTION_ROLES,
  Role,
  UserRoleProvider,
} from '@framework/domain';
import {
  ApplyToRelatedRecordsResolver,
  AuthenticatedUser,
  CurrentUser,
  domainErrorSchema,
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  RecordHasDependentsSchema,
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

import { AddOrderMiCodeDto } from './dto/add-order-mi-code.dto';
import { DefineOrderDto } from './dto/define-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

// Who may define, edit and delete orders, and add MI codes to them; every
// production role reads them (issue #101).
export const ORDER_WRITER_ROLES = [Role.Management, Role.SystemAdmin];

const OrderSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440010' },
    orderNumber: { type: 'string', example: 'ORD-5001' },
    miCodes: {
      type: 'array',
      description: 'In assignment order',
      items: {
        properties: {
          standardBomId: {
            type: 'string',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          miCode: { type: 'string', example: '1001' },
          productId: {
            type: 'string',
            example: '550e8400-e29b-41d4-a716-446655440001',
          },
          productName: { type: 'string', example: 'کابل 2.5' },
        },
      },
    },
    dailyBomCount: {
      type: 'number',
      example: 2,
      description: 'How many daily BOMs are registered for the order',
    },
  },
} as const;

const OrderListSchema = {
  properties: {
    items: {
      type: 'array',
      items: OrderSchema,
      description: 'Sorted by order number',
    },
  },
} as const;

const OrderIdSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440010' },
  },
} as const;

const OrderNumberTakenSchema = domainErrorSchema(
  'order-number-taken',
  'Order Number Taken',
  409,
  'An order with number ORD-5001 already exists',
  { orderNumber: { type: 'string', example: 'ORD-5001' } },
);

const OrderMiCodeAlreadyAssignedSchema = domainErrorSchema(
  'order-mi-code-already-assigned',
  'Order MI Code Already Assigned',
  409,
  'MI code 1001 is already assigned to the order',
  { miCode: { type: 'string', example: '1001' } },
);

const OrderMiCodeNotFoundResponse = {
  schema: domainErrorSchema(
    'order-mi-code-not-found',
    'Order MI Code Not Found',
    400,
    'No standard BOM exists with MI code 9999',
    { miCode: { type: 'string', example: '9999' } },
  ),
};

const ForbiddenResponse = {
  description: 'Not a Management or System Admin user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

const ReadForbiddenResponse = {
  description: 'Not a production user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

/**
 * Orders («سفارشات», issue #101): an order number with the MI codes assigned
 * to it. A daily BOM is registered only for a defined order, with one of its
 * MI codes. An order with daily BOMs can be neither renumbered, lose an MI
 * code, nor be deleted — except the System Admin's correction of its number
 * (`applyToRelatedRecords`) and the System Admin's delete, which takes its
 * daily BOMs with it.
 */
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly userRoleProvider: UserRoleProvider,
    private readonly applyToRelatedRecords: ApplyToRelatedRecordsResolver,
  ) {}

  @Get()
  @Roles(...PRODUCTION_ROLES)
  @ApiOperation({ summary: 'List every order, sorted by order number' })
  @ApiOkResponse({ schema: OrderListSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ReadForbiddenResponse)
  async list(): Promise<OrderList> {
    return this.queryBus.execute(new ListOrdersQuery());
  }

  // Declared before `:id`, which would otherwise take `by-number` as an id.
  @Get('by-number/:orderNumber')
  @Roles(...PRODUCTION_ROLES)
  @ApiOperation({
    summary:
      'Get the order with a number (Persian digits read as English ones) — the daily-BOM form looks its MI codes up with it',
  })
  @ApiOkResponse({ schema: OrderSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ReadForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async getByNumber(
    @Param('orderNumber') orderNumber: string,
  ): Promise<OrderReadModel> {
    return this.queryBus.execute(
      new GetOrderByNumberQuery(OrderNumber.fromString(orderNumber)),
    );
  }

  @Get(':id')
  @Roles(...PRODUCTION_ROLES)
  @ApiOperation({ summary: 'Get an order' })
  @ApiOkResponse({ schema: OrderSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ReadForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async get(@Param('id') id: string): Promise<OrderReadModel> {
    return this.queryBus.execute(new GetOrderQuery(Identity.fromString(id)));
  }

  @Post()
  @Roles(...ORDER_WRITER_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Define an order with the MI codes assigned to it' })
  @ApiCreatedResponse({ description: 'Order defined', schema: OrderIdSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(OrderMiCodeNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiConflictResponse({
    description:
      'Another order has the number, or the same MI code is given twice',
    schema: {
      oneOf: [OrderNumberTakenSchema, OrderMiCodeAlreadyAssignedSchema],
    },
  })
  async define(@Body() body: DefineOrderDto): Promise<{ id: string }> {
    const id: string = await this.commandBus.execute(
      new DefineOrderCommand(
        OrderNumber.fromString(body.orderNumber),
        body.miCodes,
      ),
    );
    return { id };
  }

  @Post(':id/mi-codes')
  @Roles(...ORDER_WRITER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Assign one more MI code to an order — allowed while it has daily BOMs, which it leaves untouched',
  })
  @ApiNoContentResponse({ description: 'MI code added' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(OrderMiCodeNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse({
    description: 'The order has the MI code already',
    schema: OrderMiCodeAlreadyAssignedSchema,
  })
  async addMiCode(
    @Param('id') id: string,
    @Body() body: AddOrderMiCodeDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AddOrderMiCodeCommand(Identity.fromString(id), body.miCode),
    );
  }

  @Patch(':id')
  @Roles(...ORDER_WRITER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Edit an order's number and/or replace its MI codes — refused while it has daily BOMs, but for the System Admin's correction of its number alone, confirmed with `applyToRelatedRecords` and carried into its daily BOMs",
  })
  @ApiNoContentResponse({ description: 'Order edited' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(OrderMiCodeNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse({
    description:
      'Daily BOMs are registered for the order, another order has the number, or the same MI code is given twice',
    schema: {
      oneOf: [
        RecordHasDependentsSchema,
        OrderNumberTakenSchema,
        OrderMiCodeAlreadyAssignedSchema,
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditOrderCommand(
        Identity.fromString(id),
        body.orderNumber === undefined
          ? undefined
          : OrderNumber.fromString(body.orderNumber),
        body.miCodes,
        await this.applyToRelatedRecords.askedBy(
          user,
          body.applyToRelatedRecords,
        ),
      ),
    );
  }

  @Delete(':id')
  @Roles(...ORDER_WRITER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete an order — refused while it has daily BOMs, except for the System Admin, whose delete takes every daily BOM of the order with it',
  })
  @ApiNoContentResponse({ description: 'Order deleted' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse({
    description:
      'Daily BOMs are registered for the order (not the System Admin)',
    schema: RecordHasDependentsSchema,
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // The caller's current role, never a token claim — as `RolesGuard` reads it.
    const role = await this.userRoleProvider.getRole(user.id);
    await this.commandBus.execute(
      new DeleteOrderCommand(Identity.fromString(id), role),
    );
  }
}

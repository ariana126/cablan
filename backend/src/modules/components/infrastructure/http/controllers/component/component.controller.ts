import { DeleteComponentCommand } from '@components/application/commands/delete-component/delete-component.command';
import { EditComponentCommand } from '@components/application/commands/edit-component/edit-component.command';
import { RegisterComponentCommand } from '@components/application/commands/register-component/register-component.command';
import { ComponentReadModel } from '@components/application/queries/list-components/component.read-model';
import { ListComponentsQuery } from '@components/application/queries/list-components/list-components.query';
import { ComponentName } from '@components/domain/value/component-name.vo';
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

import { RegisterComponentDto } from './dto/register-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

const ComponentNameAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'component-name-already-exists',
    'Component Name Already Exists',
    409,
    'A component already exists with name Bolt',
    { name: { type: 'string', example: 'Bolt' } },
  ),
};

const ForbiddenResponse = {
  description: 'Not a System Admin or Management user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('Components')
@ApiBearerAuth()
@Controller('components')
export class ComponentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new component' })
  @ApiCreatedResponse({
    description: 'Component registered successfully',
    schema: {
      properties: {
        id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiConflictResponse(ComponentNameAlreadyExistsResponse)
  async register(@Body() body: RegisterComponentDto): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RegisterComponentCommand(ComponentName.fromString(body.name)),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rename an existing component' })
  @ApiNoContentResponse({ description: 'Component updated successfully' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(ComponentNameAlreadyExistsResponse)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateComponentDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditComponentCommand(
        Identity.fromString(id),
        ComponentName.fromString(body.name),
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a component' })
  @ApiNoContentResponse({ description: 'Component deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteComponentCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List every registered component' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        properties: {
          id: {
            type: 'string',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          name: { type: 'string', example: 'Bolt' },
        },
      },
    },
  })
  async list(): Promise<ComponentReadModel[]> {
    return this.queryBus.execute(new ListComponentsQuery());
  }
}

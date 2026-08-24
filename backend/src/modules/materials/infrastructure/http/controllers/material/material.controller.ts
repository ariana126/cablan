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
import { DeleteMaterialCommand } from '@materials/application/commands/delete-material/delete-material.command';
import { EditMaterialCommand } from '@materials/application/commands/edit-material/edit-material.command';
import { RegisterMaterialCommand } from '@materials/application/commands/register-material/register-material.command';
import { ListMaterialsQuery } from '@materials/application/queries/list-materials/list-materials.query';
import { MaterialReadModel } from '@materials/application/queries/list-materials/material.read-model';
import { MaterialName } from '@materials/domain/value/material-name.vo';
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

import { RegisterMaterialDto } from './dto/register-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

const MaterialNameAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'material-name-already-exists',
    'Material Name Already Exists',
    409,
    'A material already exists with name Steel Rod',
    { name: { type: 'string', example: 'Steel Rod' } },
  ),
};

const ForbiddenResponse = {
  description: 'Not a System Admin or Management user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new raw material' })
  @ApiCreatedResponse({
    description: 'Material registered successfully',
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
  @ApiConflictResponse(MaterialNameAlreadyExistsResponse)
  async register(@Body() body: RegisterMaterialDto): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RegisterMaterialCommand(MaterialName.fromString(body.name)),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rename an existing raw material' })
  @ApiNoContentResponse({ description: 'Material updated successfully' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(MaterialNameAlreadyExistsResponse)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMaterialDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditMaterialCommand(
        Identity.fromString(id),
        MaterialName.fromString(body.name),
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin, Role.Management)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a raw material' })
  @ApiNoContentResponse({ description: 'Material deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteMaterialCommand(Identity.fromString(id)),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List every registered raw material' })
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
          name: { type: 'string', example: 'Steel Rod' },
        },
      },
    },
  })
  async list(): Promise<MaterialReadModel[]> {
    return this.queryBus.execute(new ListMaterialsQuery());
  }
}

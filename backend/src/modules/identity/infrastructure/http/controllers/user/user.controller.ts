import { Identity, Role } from '@framework/domain';
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
import { DeleteUserCommand } from '@identity/application/commands/delete-user/delete-user.command';
import { RegisterUserCommand } from '@identity/application/commands/register-user/register-user.command';
import { UpdateUserCommand } from '@identity/application/commands/update-user/update-user.command';
import { GetCurrentUserQuery } from '@identity/application/queries/get-current-user/get-current-user.query';
import { ListUsersQuery } from '@identity/application/queries/list-users/list-users.query';
import { UserReadModel } from '@identity/application/queries/list-users/user.read-model';
import { Username } from '@identity/domain/value/username.vo';
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

import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const UsernameAlreadyExistsResponse = {
  schema: domainErrorSchema(
    'username-already-exists',
    'Username Already Exists',
    409,
    'A user already exists with username sina.q',
    { username: { type: 'string', example: 'sina.q' } },
  ),
};

const ForbiddenResponse = {
  description: 'Not a System Admin',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({
    description: 'User registered successfully',
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
  @ApiConflictResponse(UsernameAlreadyExistsResponse)
  async register(@Body() body: RegisterUserDto): Promise<{ id: string }> {
    return this.commandBus.execute(
      new RegisterUserCommand(
        body.name,
        Username.fromString(body.username),
        body.password,
        body.role,
      ),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Edit an existing user' })
  @ApiNoContentResponse({ description: 'User updated successfully' })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse({
    schema: domainErrorSchema(
      'cannot-change-own-role',
      'Cannot Change Own Role',
      409,
      'A System Admin cannot change their own role',
    ),
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new UpdateUserCommand(
        Identity.fromString(id),
        actingUser.id,
        body.name,
        body.username === undefined
          ? undefined
          : Username.fromString(body.username),
        body.password,
        body.role,
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiNoContentResponse({ description: 'User deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteUserCommand(Identity.fromString(id)),
    );
  }

  // The one endpoint on this controller with no `@Roles()`: every role asks
  // who it is, and the answer is scoped to the caller's own `sub`, so there
  // is nothing here a role could over-reach. It exists because the JWT
  // carries no role claim — see `AccessTokenIssuer` for why — which leaves
  // the frontend no other way to learn what to show.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the signed-in user' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiOkResponse({
    schema: {
      properties: {
        id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        name: { type: 'string', example: 'Sina Ghadrdan' },
        username: { type: 'string', example: 'sina.q' },
        role: { type: 'string', enum: Object.values(Role) },
      },
    },
  })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserReadModel> {
    return this.queryBus.execute(new GetCurrentUserQuery(user.id));
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SystemAdmin)
  @ApiOperation({ summary: 'List every registered user' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        properties: {
          id: {
            type: 'string',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          name: { type: 'string', example: 'Sina Ghadrdan' },
          username: { type: 'string', example: 'sina.q' },
          role: { type: 'string', enum: Object.values(Role) },
        },
      },
    },
  })
  async list(): Promise<UserReadModel[]> {
    return this.queryBus.execute(new ListUsersQuery());
  }
}

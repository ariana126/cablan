import {
  domainErrorSchema,
  ValidationErrorSchema,
} from '@framework/infrastructure';
import { LoginCommand } from '@identity/application/commands/login/login.command';
import { Username } from '@identity/domain/value/username.vo';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { LoginUserDto } from './dto/login-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with a username and password' })
  @ApiOkResponse({
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({
    schema: domainErrorSchema(
      'invalid-credentials',
      'Invalid Credentials',
      401,
      'Invalid username or password provided.',
    ),
  })
  async login(@Body() body: LoginUserDto): Promise<{ accessToken: string }> {
    return this.commandBus.execute(
      new LoginCommand(Username.fromString(body.username), body.password),
    );
  }
}

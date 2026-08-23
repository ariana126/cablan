import { Identity, Role, UserRoleProvider } from '@framework/domain';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ROLES_KEY } from './decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userRoleProvider: UserRoleProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authedRequest = request as Request & { user: { sub: string } };

    // Looked up fresh on every request, never trusted from the token: a
    // role can change — or the account can be deleted — after a token is
    // issued but before it expires, and a stale claim would keep granting
    // the old access until then. See UserRoleProvider.
    const role = await this.userRoleProvider.getRole(
      Identity.fromString(authedRequest.user.sub),
    );

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}

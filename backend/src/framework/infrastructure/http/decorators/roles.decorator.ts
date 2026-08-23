import { Role } from '@framework/domain';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Marks a route (or a whole controller) as restricted to the given roles.
// Read by `RolesGuard`, which must run after `JwtAuthGuard` so `request.user`
// is already populated: `@UseGuards(JwtAuthGuard, RolesGuard)`.
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

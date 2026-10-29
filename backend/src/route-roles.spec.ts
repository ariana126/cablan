import { Controllers as AuditLoggingControllers } from '@audit-logging/infrastructure/http/controllers';
import { Controllers as BomsControllers } from '@boms/infrastructure/http/controllers';
import { Role } from '@framework/domain';
import { JwtAuthGuard, ROLES_KEY } from '@framework/infrastructure';
import { Controllers as IdentityControllers } from '@identity/infrastructure/http/controllers';
import { UserController } from '@identity/infrastructure/http/controllers/user/user.controller';
import { Controllers as MaintenanceControllers } from '@maintenance/infrastructure/http/controllers';
import { Controllers as ManufacturingInstructionsControllers } from '@manufacturing-instructions/infrastructure/http/controllers';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Controllers as ProductsControllers } from '@products/infrastructure/http/controllers';

type ControllerClass = abstract new (...args: never[]) => unknown;

interface GuardedRoute {
  readonly name: string;
  readonly roles: readonly Role[] | undefined;
}

// Every route behind `JwtAuthGuard`, with the roles it is restricted to —
// the handler's own `@Roles()` over its controller's, as `RolesGuard` reads
// them.
function guardedRoutes(
  controllers: readonly ControllerClass[],
): GuardedRoute[] {
  return controllers.flatMap((controller) => {
    const prototype = controller.prototype as Record<string, unknown>;
    return Object.getOwnPropertyNames(prototype)
      .filter((method) => method !== 'constructor')
      .map((method) => prototype[method])
      .filter((handler): handler is (...args: unknown[]) => unknown => {
        if (typeof handler !== 'function') return false;
        const guards = [
          ...((Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[]) ??
            []),
          ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ??
            []),
        ];
        return guards.includes(JwtAuthGuard);
      })
      .map((handler) => ({
        name: `${controller.name}.${handler.name}`,
        roles: (Reflect.getMetadata(ROLES_KEY, handler) ??
          Reflect.getMetadata(ROLES_KEY, controller)) as Role[] | undefined,
      }));
  });
}

// The roles the BOM, product, standard-BOM and audit sections were built
// for. The maintenance roles (issue #69) reach none of them.
const SECTION_ROLES = new Set([
  Role.SystemAdmin,
  Role.Management,
  Role.QcInspector,
  Role.Reporter,
]);

const OUTSIDE_MAINTENANCE = [
  ...IdentityControllers,
  ...ProductsControllers,
  ...ManufacturingInstructionsControllers,
  ...BomsControllers,
  ...AuditLoggingControllers,
] as ControllerClass[];

// The caller's own session: answered for whoever is signed in, whatever
// their role (src/modules/identity/CLAUDE.md).
const OPEN_TO_EVERY_SIGNED_IN_USER = [`${UserController.name}.me`];

describe('route roles', () => {
  it('restricts every signed-in route to named roles, but the caller’s own session', () => {
    const unrestricted = guardedRoutes(OUTSIDE_MAINTENANCE)
      .filter((route) => route.roles === undefined)
      .map((route) => route.name);

    expect(unrestricted).toEqual(OPEN_TO_EVERY_SIGNED_IN_USER);
  });

  it('opens no route outside maintenance to the technical manager or the PM inspector', () => {
    const reachable = guardedRoutes(OUTSIDE_MAINTENANCE)
      .filter((route) =>
        (route.roles ?? []).some((role) => !SECTION_ROLES.has(role)),
      )
      .map((route) => route.name);

    expect(reachable).toEqual([]);
  });

  it('restricts every maintenance route to the maintenance roles, the system admin always among them', () => {
    const routes = guardedRoutes(MaintenanceControllers);
    const maintenanceRoles = new Set([
      Role.SystemAdmin,
      Role.TechnicalManager,
      Role.PmInspector,
    ]);

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect([route.name, route.roles]).toEqual([
        route.name,
        expect.arrayContaining([Role.SystemAdmin]),
      ]);
      expect(
        (route.roles ?? []).filter((role) => !maintenanceRoles.has(role)),
      ).toEqual([]);
    }
  });
});

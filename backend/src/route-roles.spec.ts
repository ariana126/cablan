import { Controllers as AuditLoggingControllers } from '@audit-logging/infrastructure/http/controllers';
import { AuditLogController } from '@audit-logging/infrastructure/http/controllers/audit-log/audit-log.controller';
import { Controllers as BomsControllers } from '@boms/infrastructure/http/controllers';
import { BomController } from '@boms/infrastructure/http/controllers/bom/bom.controller';
import { BomDashboardController } from '@boms/infrastructure/http/controllers/bom-dashboard/bom-dashboard.controller';
import { OrderController } from '@boms/infrastructure/http/controllers/order/order.controller';
import { PRODUCTION_ROLES, Role } from '@framework/domain';
import { JwtAuthGuard, ROLES_KEY } from '@framework/infrastructure';
import { Controllers as IdentityControllers } from '@identity/infrastructure/http/controllers';
import { UserController } from '@identity/infrastructure/http/controllers/user/user.controller';
import { Controllers as MaintenanceControllers } from '@maintenance/infrastructure/http/controllers';
import { MaintenanceActivityController } from '@maintenance/infrastructure/http/controllers/maintenance-activity/maintenance-activity.controller';
import { QcActivityController } from '@maintenance/infrastructure/http/controllers/qc-activity/qc-activity.controller';
import { QcEquipmentController } from '@maintenance/infrastructure/http/controllers/qc-equipment/qc-equipment.controller';
import { QcExecutionController } from '@maintenance/infrastructure/http/controllers/qc-execution/qc-execution.controller';
import { QcInspectionController } from '@maintenance/infrastructure/http/controllers/qc-inspection/qc-inspection.controller';
import { Controllers as ManufacturingInstructionsControllers } from '@manufacturing-instructions/infrastructure/http/controllers';
import { StandardBomController } from '@manufacturing-instructions/infrastructure/http/controllers/standard-bom/standard-bom.controller';
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
// for. The maintenance roles (issue #69) reach none of them; the factory
// manager (issue #130) reaches both sides.
const SECTION_ROLES = new Set([
  Role.SystemAdmin,
  Role.Management,
  Role.QcInspector,
  Role.Reporter,
  Role.FactoryManager,
]);

const OUTSIDE_MAINTENANCE = [
  ...IdentityControllers,
  ...ProductsControllers,
  ...ManufacturingInstructionsControllers,
  ...BomsControllers,
  ...AuditLoggingControllers,
] as ControllerClass[];

// Production QC (issue #119) lives in `maintenance` beside the equipment it
// hangs off, but is worked by the production roles: management, the QC
// inspector and the system admin — never the maintenance roles.
const QC_CONTROLLERS = [
  QcActivityController,
  QcEquipmentController,
  QcInspectionController,
  QcExecutionController,
] as ControllerClass[];

const PM_CONTROLLERS = (MaintenanceControllers as ControllerClass[]).filter(
  (controller) => !QC_CONTROLLERS.includes(controller),
);

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

  it('restricts every maintenance route but production QC’s to the maintenance roles, the system admin always among them', () => {
    const routes = guardedRoutes(PM_CONTROLLERS);
    const maintenanceRoles = new Set([
      Role.SystemAdmin,
      Role.TechnicalManager,
      Role.PmInspector,
      Role.FactoryManager,
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

  it('restricts every production QC route to management, the factory manager, the QC inspector and the system admin, the system admin always among them', () => {
    const routes = guardedRoutes(QC_CONTROLLERS);
    const qcRoles = new Set([
      Role.SystemAdmin,
      Role.Management,
      Role.QcInspector,
      Role.FactoryManager,
    ]);

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect([route.name, route.roles]).toEqual([
        route.name,
        expect.arrayContaining([Role.SystemAdmin]),
      ]);
      expect((route.roles ?? []).filter((role) => !qcRoles.has(role))).toEqual(
        [],
      );
    }
  });

  // Issue #132: the QC inspector records one activity or several at once;
  // every other QC equipment route is the managers'.
  it('opens recording QC activities, one or several at once, to the QC inspector', () => {
    const routes = guardedRoutes([QcEquipmentController])
      .filter((route) => (route.roles ?? []).includes(Role.QcInspector))
      .map((route) => route.name);

    expect(routes).toEqual([
      `${QcEquipmentController.name}.record`,
      `${QcEquipmentController.name}.recordSeveral`,
    ]);
  });

  // Issue #101: every production role reads orders; only Management and the
  // System Admin write them. Issue #130: the QC inspector reads only the one
  // order the daily-BOM form looks up by number; the factory manager writes.
  it('opens the orders to every production role but the QC inspector, who only looks one up by number, their writes to Management, the factory manager and the system admin', () => {
    const roles = Object.fromEntries(
      guardedRoutes([OrderController]).map((route) => [
        route.name.replace(`${OrderController.name}.`, ''),
        route.roles,
      ]),
    );
    const readers = PRODUCTION_ROLES.filter(
      (role) => role !== Role.QcInspector,
    );
    const writers = [Role.Management, Role.SystemAdmin, Role.FactoryManager];

    expect(roles).toEqual({
      list: readers,
      getByNumber: [...PRODUCTION_ROLES],
      get: readers,
      define: writers,
      addMiCode: writers,
      update: writers,
      delete: writers,
    });
  });

  it('leaves completing the activities’ missing specialties to the system admin alone', () => {
    const routes = guardedRoutes([MaintenanceActivityController]).filter(
      (route) =>
        [
          `${MaintenanceActivityController.name}.withoutSpecialty`,
          `${MaintenanceActivityController.name}.completeMissingSpecialties`,
        ].includes(route.name),
    );

    expect(routes.map((route) => route.roles)).toEqual([
      [Role.SystemAdmin],
      [Role.SystemAdmin],
    ]);
  });

  // Issue #130: the factory manager does everything Management, the
  // technical manager, both inspectors and the reporter do, and reads the
  // audit log — never a System-Admin-only power, never the users.
  it('opens to the factory manager every route another non-admin role reaches, and the audit log’s reads — nothing else', () => {
    const everyRoute = guardedRoutes([
      ...OUTSIDE_MAINTENANCE,
      ...(MaintenanceControllers as ControllerClass[]),
    ]);
    const otherNonAdminRoles = new Set([
      Role.Management,
      Role.TechnicalManager,
      Role.PmInspector,
      Role.QcInspector,
      Role.Reporter,
    ]);
    const auditLogReads = ['list', 'filterOptions', 'changes'].map(
      (method) => `${AuditLogController.name}.${method}`,
    );

    const reachedByFactoryManager = everyRoute
      .filter((route) => (route.roles ?? []).includes(Role.FactoryManager))
      .map((route) => route.name);
    const expected = everyRoute
      .filter(
        (route) =>
          (route.roles ?? []).some((role) => otherNonAdminRoles.has(role)) ||
          auditLogReads.includes(route.name),
      )
      .map((route) => route.name);

    expect(reachedByFactoryManager).toEqual(expected);
    expect(reachedByFactoryManager).toEqual(
      expect.arrayContaining(auditLogReads),
    );
  });

  it('keeps the users and every System-Admin-only route from the factory manager', () => {
    const routes = guardedRoutes([
      ...OUTSIDE_MAINTENANCE,
      ...(MaintenanceControllers as ControllerClass[]),
    ]).filter(
      (route) =>
        (route.name.startsWith(`${UserController.name}.`) &&
          !OPEN_TO_EVERY_SIGNED_IN_USER.includes(route.name)) ||
        (route.roles?.length === 1 && route.roles[0] === Role.SystemAdmin),
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(
      routes
        .filter((route) => (route.roles ?? []).includes(Role.FactoryManager))
        .map((route) => route.name),
    ).toEqual([]);
  });

  // Issue #130: the QC inspector loses the «گزارشات» folder — the standard
  // BOMs' report and export, and the daily-BOM dashboard — but keeps the
  // standard-BOM list the daily-BOM form reads compositions from, and every
  // daily-BOM route.
  it('keeps the standard-BOM report and export and the daily-BOM dashboard from the QC inspector', () => {
    const routes = guardedRoutes([
      BomDashboardController,
      StandardBomController,
    ])
      .filter((route) => (route.roles ?? []).includes(Role.QcInspector))
      .map((route) => route.name);

    expect(routes).toEqual([`${StandardBomController.name}.list`]);
  });

  it('opens every daily-BOM route but reviewing to the QC inspector', () => {
    const routes = guardedRoutes([BomController])
      .filter((route) => !(route.roles ?? []).includes(Role.QcInspector))
      .map((route) => route.name);

    expect(routes).toEqual([
      `${BomController.name}.approve`,
      `${BomController.name}.reject`,
    ]);
  });
});

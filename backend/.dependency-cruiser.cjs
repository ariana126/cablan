/**
 * dependency-cruiser configuration — enforces the DDD + CQRS layer boundaries
 * described in CLAUDE.md. Run with `make npm depcruise`.
 *
 * Layer direction (per module and in `framework/`):
 *   domain  <-  application  <-  infrastructure
 * Dependencies point inward: domain is pure, application may use domain,
 * infrastructure may use both. Nothing points outward.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Circular dependencies make the graph impossible to reason about. ' +
        'Cycles routed through a package `index.ts` barrel are ignored: internal ' +
        'files import the barrel for convenience and the barrel re-exports them, a ' +
        'benign artifact of the re-export pattern rather than a real logic cycle.',
      severity: 'error',
      from: {},
      to: { circular: true, viaNot: '(^|/)index\\.ts$' },
    },
    {
      name: 'domain-not-application-or-infra',
      comment:
        'The domain layer is the innermost ring: it must not depend on the ' +
        'application or infrastructure layers.',
      severity: 'error',
      from: { path: '(^|/)domain/' },
      to: { path: '(^|/)(application|infrastructure)/' },
    },
    {
      name: 'domain-no-framework-libs',
      comment:
        'The domain layer is framework-agnostic business logic — no NestJS or Prisma.',
      severity: 'error',
      from: { path: '(^|/)domain/' },
      to: { path: 'node_modules/(@nestjs|@prisma|prisma)' },
    },
    {
      name: 'application-not-infrastructure',
      comment:
        'The application layer orchestrates the domain; it must not reach into ' +
        'the infrastructure layer.',
      severity: 'error',
      from: { path: '(^|/)application/' },
      to: { path: '(^|/)infrastructure/' },
    },
    {
      name: 'framework-independent-of-modules',
      comment:
        'The shared framework must not depend on feature modules. The single ' +
        'exception is HttpExceptionFilter, which composes the module exception ' +
        'mappers (framework first, then module-specific) — a documented coupling ' +
        'in src/framework/CLAUDE.md.',
      severity: 'error',
      from: { path: '^src/framework/', pathNot: 'exception\\.filter\\.ts$' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-own-package-barrel',
      comment:
        'A file must not import its own package barrel (index.ts): it creates an ' +
        'index-routed re-export cycle whose load order is fragile and breaks under import ' +
        'sorting (see the FrameworkExceptionMapper crash). Import sibling files directly.',
      severity: 'error',
      from: {
        path: '^src/framework/(domain|application|infrastructure)/.+',
        pathNot: '/index\\.ts$',
      },
      to: { path: '^src/framework/$1/index\\.ts$' },
    },
    {
      name: 'modules-isolated',
      comment:
        'A feature module must not import another module internally. Cross-module ' +
        'interaction goes over HTTP, not by importing code. The documented exceptions are ' +
        '`ProductCompositionFactory`, which reuses components\'/materials\' own ' +
        'RegisterComponentCommand/RegisterMaterialCommand through the CommandBus instead of ' +
        'duplicating their name validation and uniqueness rules, ' +
        '`StandardBomCompositionFactory`, which reuses products\' own GetProductQuery through ' +
        'the QueryBus to read a product\'s current composition, and `BomCompositionFactory`, ' +
        'which reuses standard-boms\' own GetStandardBomByMiCodeQuery through the QueryBus to ' +
        'read a standard BOM\'s current composition — see src/modules/products/CLAUDE.md, ' +
        'src/modules/standard-boms/CLAUDE.md and src/modules/boms/CLAUDE.md, and the narrower ' +
        'rules below that bound exactly what each may import.',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/',
        pathNot:
          '^src/modules/(products/application/service/product-composition\\.factory\\.ts|standard-boms/application/service/standard-bom-composition\\.factory\\.ts|boms/application/service/bom-composition\\.factory\\.ts)$',
      },
      to: { path: '^src/modules/([^/]+)/', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'product-composition-factory-reuse-is-narrow',
      comment:
        '`ProductCompositionFactory` may reuse only components\'/materials\' own ' +
        'RegisterComponentCommand/RegisterMaterialCommand (dispatched through the CommandBus, ' +
        'never their handlers or repositories) and the ComponentName/MaterialName value ' +
        'objects needed to build them — nothing else from those modules.',
      severity: 'error',
      from: {
        path: '^src/modules/products/application/service/product-composition\\.factory\\.ts$',
      },
      to: {
        path: '^src/modules/(components|materials)/',
        pathNot:
          '^src/modules/(components/(application/commands/register-component/register-component\\.command\\.ts|domain/value/component-name\\.vo\\.ts)|materials/(application/commands/register-material/register-material\\.command\\.ts|domain/value/material-name\\.vo\\.ts))$',
      },
    },
    {
      name: 'standard-bom-composition-factory-reuse-is-narrow',
      comment:
        '`StandardBomCompositionFactory` may reuse only products\' own GetProductQuery ' +
        '(dispatched through the QueryBus, never its handler or repository) and the ' +
        'ProductReadModel type it returns — nothing else from that module.',
      severity: 'error',
      from: {
        path: '^src/modules/standard-boms/application/service/standard-bom-composition\\.factory\\.ts$',
      },
      to: {
        path: '^src/modules/products/',
        pathNot:
          '^src/modules/products/application/queries/(get-product/get-product\\.query\\.ts|list-products/product\\.read-model\\.ts)$',
      },
    },
    {
      name: 'bom-composition-factory-reuse-is-narrow',
      comment:
        '`BomCompositionFactory` may reuse only standard-boms\' own GetStandardBomByMiCodeQuery ' +
        '(dispatched through the QueryBus, never its handler or repository) and the ' +
        'StandardBomReadModel type it returns — nothing else from that module.',
      severity: 'error',
      from: {
        path: '^src/modules/boms/application/service/bom-composition\\.factory\\.ts$',
      },
      to: {
        path: '^src/modules/standard-boms/',
        pathNot:
          '^src/modules/standard-boms/application/queries/(get-standard-bom-by-mi-code/get-standard-bom-by-mi-code\\.query\\.ts|list-standard-boms/standard-bom\\.read-model\\.ts)$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Include type-only imports so an `import type` can't smuggle a layer break past the check.
    tsPreCompilationDeps: true,
    // Resolve the @framework/* path alias.
    tsConfig: { fileName: 'tsconfig.json' },
    // Co-located unit tests are not part of the layer graph.
    exclude: { path: '\\.spec\\.ts$' },
  },
};

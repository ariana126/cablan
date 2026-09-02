import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { canReach, DESTINATIONS, destinationsFor } from './navigation';

describe('navigation', () => {
  it('offers a System Admin every destination', () => {
    expect(destinationsFor(Role.system_admin).map((destination) => destination.path)).toEqual(
      DESTINATIONS.map((destination) => destination.path),
    );
  });

  it('withholds users and the audit log from Management', () => {
    const paths = destinationsFor(Role.management).map((destination) => destination.path);

    expect(paths).not.toContain('users');
    expect(paths).not.toContain('audit-log');
    expect(paths).toContain('boms/dashboard');
    expect(paths).toContain('products');
  });

  it('offers a QC Inspector only the two BOM pages, plus home', () => {
    expect(destinationsFor(Role.qc_inspector).map((destination) => destination.path)).toEqual([
      '',
      'boms',
      'standard-boms',
    ]);
  });

  it('offers a Reporter the same as a QC Inspector', () => {
    expect(destinationsFor(Role.reporter)).toEqual(destinationsFor(Role.qc_inspector));
  });

  it('keeps the running order the drawer renders in', () => {
    expect(DESTINATIONS.map((destination) => destination.path)).toEqual([
      '',
      'boms/dashboard',
      'boms',
      'standard-boms',
      'audit-log',
      'products',
      'components',
      'materials',
      'users',
    ]);
  });

  it('lets home through for every role', () => {
    for (const role of Object.values(Role)) {
      expect(canReach('', role)).toBe(true);
    }
  });

  it('denies a path no destination declares, whatever the role', () => {
    expect(canReach('no-such-page', Role.system_admin)).toBe(false);
  });

  // An anonymous visitor has no role: `authGuard` sends them to log in before this is consulted,
  // but nothing may fall open in the window before it does.
  it('denies every destination when there is no role', () => {
    expect(DESTINATIONS.every((destination) => canReach(destination.path, null) === false)).toBe(
      true,
    );
  });
});

import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import {
  canApproveBoms,
  canManageBoms,
  canManageStandardBoms,
  canRevertMaterialImports,
} from './permissions';

describe('permissions', () => {
  it('lets a System Admin write in both domains', () => {
    expect(canManageBoms(Role.system_admin)).toBe(true);
    expect(canManageStandardBoms(Role.system_admin)).toBe(true);
  });

  it('lets Management write in both domains', () => {
    expect(canManageBoms(Role.management)).toBe(true);
    expect(canManageStandardBoms(Role.management)).toBe(true);
  });

  it('lets a QC Inspector write daily BOMs but never standard ones', () => {
    expect(canManageBoms(Role.qc_inspector)).toBe(true);
    expect(canManageStandardBoms(Role.qc_inspector)).toBe(false);
  });

  it('lets a Reporter write nothing', () => {
    expect(canManageBoms(Role.reporter)).toBe(false);
    expect(canManageStandardBoms(Role.reporter)).toBe(false);
  });

  it('writes nothing when no role is known', () => {
    expect(canManageBoms(null)).toBe(false);
    expect(canManageStandardBoms(null)).toBe(false);
  });

  it.each([
    [Role.system_admin, true],
    [Role.management, true],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [null, false],
  ] as const)('lets %s approve a daily BOM: %s', (role, allowed) => {
    expect(canApproveBoms(role)).toBe(allowed);
  });

  it.each([
    [Role.system_admin, true],
    [Role.management, false],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [null, false],
  ] as const)('lets %s revert a bulk material import: %s', (role, allowed) => {
    expect(canRevertMaterialImports(role)).toBe(allowed);
  });
});

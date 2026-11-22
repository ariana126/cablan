import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import {
  canApproveBoms,
  canManageBoms,
  canManageOrders,
  canManageStandardBoms,
  canCorrectRecordsInUse,
  canDeleteMaintenanceRecords,
  canDeleteQcRecords,
  canImportPmPlans,
  canReactivateEquipment,
  canRevertMaterialImports,
} from './permissions';

describe('permissions', () => {
  // Issue #101: orders are defined, changed and deleted by Management and the System Admin — and,
  // since issue #130, the Factory Manager.
  it.each([
    [Role.system_admin, true],
    [Role.management, true],
    [Role.factory_manager, true],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [Role.technical_manager, false],
    [Role.pm_inspector, false],
    [null, false],
  ] as const)('lets %s manage orders: %s', (role, allowed) => {
    expect(canManageOrders(role)).toBe(allowed);
  });

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

  // Issue #130: the Factory Manager does everything Management does.
  it('lets a Factory Manager write in both domains', () => {
    expect(canManageBoms(Role.factory_manager)).toBe(true);
    expect(canManageStandardBoms(Role.factory_manager)).toBe(true);
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
    [Role.factory_manager, true],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [null, false],
  ] as const)('lets %s approve a daily BOM: %s', (role, allowed) => {
    expect(canApproveBoms(role)).toBe(allowed);
  });

  it.each([
    [Role.system_admin, true],
    [Role.management, false],
    [Role.factory_manager, false],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [null, false],
  ] as const)('lets %s revert a bulk material import: %s', (role, allowed) => {
    expect(canRevertMaterialImports(role)).toBe(allowed);
  });

  // Issue #127: importing PM plans from Excel is the System Admin's alone — Technical Manager included.
  it.each([
    [Role.system_admin, true],
    [Role.management, false],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [Role.technical_manager, false],
    [Role.pm_inspector, false],
    [Role.factory_manager, false],
    [null, false],
  ] as const)('lets %s import PM plans from Excel: %s', (role, allowed) => {
    expect(canImportPmPlans(role)).toBe(allowed);
  });

  // Issue #110: the System Admin's exceptions to issue #94's rule — nobody else's, Technical Manager
  // included.
  it.each([
    [Role.system_admin, true],
    [Role.management, false],
    [Role.qc_inspector, false],
    [Role.reporter, false],
    [Role.technical_manager, false],
    [Role.pm_inspector, false],
    // Issue #130: the Factory Manager gets none of the System Admin's exceptions.
    [Role.factory_manager, false],
    [null, false],
  ] as const)(
    'lets %s correct records in use, delete PM records and reactivate equipment: %s',
    (role, allowed) => {
      expect(canCorrectRecordsInUse(role)).toBe(allowed);
      expect(canDeleteMaintenanceRecords(role)).toBe(allowed);
      // Issue #119: deleting a QC record is the System Admin's alone too.
      expect(canDeleteQcRecords(role)).toBe(allowed);
      expect(canReactivateEquipment(role)).toBe(allowed);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { defaultModuleAccess, effectiveModulePermissions, hasModuleAccess, moduleOverridesForSave, normalizeModulePermissions } from './backofficeAccess';

describe('back-office access', () => {
  it('allows view but not edit when access is view', () => {
    const permissions = normalizeModulePermissions({ promotions: 'view' });
    expect(hasModuleAccess(permissions, 'promotions', 'view')).toBe(true);
    expect(hasModuleAccess(permissions, 'promotions', 'edit')).toBe(false);
  });

  it('keeps dashboard visible and admin modules restricted despite overrides', () => {
    const permissions = effectiveModulePermissions('edit', '', { dashboard: 'none', audit: 'edit', employees: 'edit' }, 'staff');
    expect(permissions.dashboard).toBe('view');
    expect(permissions.audit).toBe('none');
    expect(permissions.employees).toBe('none');
  });

  it('uses job role defaults without losing the account-level admin grant', () => {
    expect(effectiveModulePermissions('edit', '', {}, 'organizer').artists).toBe('edit');
    expect(effectiveModulePermissions('view_only', 'ฝ่ายการเงิน', {}, 'staff').artists).toBe('none');
    expect(effectiveModulePermissions('admin', '', {}, 'staff').employees).toBe('edit');
  });

  it('fails closed for malformed levels', () => {
    const permissions = normalizeModulePermissions({ promotions: 'owner' });
    expect(hasModuleAccess(permissions, 'promotions', 'view')).toBe(false);
  });

  it('persists only explicit individual overrides for non-admin accounts', () => {
    expect(moduleOverridesForSave('edit', { promotions: 'edit', reports: 'none' })).toEqual([
      { module: 'promotions', level: 'edit' },
      { module: 'reports', level: 'none' },
    ]);
    expect(moduleOverridesForSave('view_only', { concerts: 'view' })).toEqual([
      { module: 'concerts', level: 'view' },
    ]);
    expect(moduleOverridesForSave('admin', { promotions: 'none' })).toEqual([]);
  });

  it('derives department defaults and respects explicit denial', () => {
    expect(defaultModuleAccess('staff', 'ฝ่ายการตลาด', 'promotions')).toBe('edit');
    expect(defaultModuleAccess('view_only', 'ฝ่ายการเงิน', 'promotions')).toBe('none');
    expect(defaultModuleAccess('staff', 'ฝ่ายการเงิน', 'reports')).toBe('view');
    expect(defaultModuleAccess('staff', 'ฝ่ายการเงิน', 'concerts')).toBe('none');
    expect(defaultModuleAccess('staff', 'ฝ่ายการตลาด', 'audit')).toBe('none');
    const permissions = normalizeModulePermissions({ promotions: 'none' });
    expect(hasModuleAccess(permissions, 'promotions', 'view')).toBe(false);
  });
});

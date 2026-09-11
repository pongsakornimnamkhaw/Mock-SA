export type AccessLevel = 'none' | 'view' | 'edit';

export type BackofficeModule =
  | 'dashboard'
  | 'concerts'
  | 'artists'
  | 'venues'
  | 'registration'
  | 'concert_catalog'
  | 'promotions'
  | 'promotion_approvals'
  | 'sales'
  | 'audit'
  | 'employees'
  | 'reports';

export interface BackofficeModuleDefinition {
  key: BackofficeModule;
  label: string;
}

export const BACKOFFICE_MODULES: readonly BackofficeModuleDefinition[] = [
  { key: 'dashboard', label: 'ภาพรวม' },
  { key: 'concerts', label: 'จัดการคอนเสิร์ต' },
  { key: 'artists', label: 'ศิลปินและการแสดง' },
  { key: 'venues', label: 'สถานที่และที่นั่ง' },
  { key: 'registration', label: 'ลงทะเบียนเข้างาน' },
  { key: 'concert_catalog', label: 'จัดการรายการคอนเสิร์ตหน้าเว็บ' },
  { key: 'promotions', label: 'จัดการโปรโมชั่น' },
  { key: 'promotion_approvals', label: 'ตรวจสอบการอนุมัติ' },
  { key: 'sales', label: 'ตรวจสอบสลิปและออกบัตร' },
  { key: 'audit', label: 'ตรวจสอบประวัติ' },
  { key: 'employees', label: 'จัดการสิทธิ์พนักงาน' },
  { key: 'reports', label: 'รายงานหลังจบคอนเสิร์ต' },
] as const;

export type ModulePermissions = Partial<Record<BackofficeModule, AccessLevel>>;

export interface ModulePermissionInput {
  module: BackofficeModule;
  level: AccessLevel;
}

const moduleKeys = new Set(BACKOFFICE_MODULES.map(item => item.key));
const levels = new Set<AccessLevel>(['none', 'view', 'edit']);

export function normalizeModulePermissions(value: unknown): ModulePermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ModulePermissions = {};
  for (const [key, level] of Object.entries(value)) {
    if (moduleKeys.has(key as BackofficeModule)) {
      result[key as BackofficeModule] = levels.has(level as AccessLevel) ? level as AccessLevel : 'none';
    }
  }
  return result;
}

export function hasModuleAccess(permissions: ModulePermissions, module: BackofficeModule, required: Exclude<AccessLevel, 'none'>): boolean {
  const rank: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };
  return rank[permissions[module] ?? 'none'] >= rank[required];
}

export function moduleOverridesForSave(accountRole: string, overrides: ModulePermissions): ModulePermissionInput[] {
  if (accountRole === 'admin') return [];
  return BACKOFFICE_MODULES
    .filter(({ key }) => key !== 'dashboard' && key !== 'audit' && key !== 'employees' && overrides[key] !== undefined)
    .map(({ key }) => ({
      module: key,
      level: accountRole === 'view_only' && overrides[key] === 'edit' ? 'view' : overrides[key]!,
    }));
}

export function defaultModuleAccess(role: string, department: string, module: BackofficeModule): AccessLevel {
  const normalizedRole = role.trim().toLowerCase();
  const normalizedDepartment = department.trim().toLowerCase();
  if (['admin', 'administrator', 'ผู้ดูแลระบบ'].includes(normalizedRole)) return 'edit';
  if (normalizedRole === 'view_only') return 'none';
  if (module === 'dashboard') return 'view';
  if (module === 'audit' || module === 'employees') return 'none';
  if (module === 'concerts' && ['organizer', 'co_organizer', 'ผู้จัดงาน', 'ผู้จัดงานร่วม'].includes(normalizedRole)) return 'edit';
  if (module === 'artists' && ['organizer', 'ผู้จัดงาน'].includes(normalizedRole)) return 'edit';
  if (module === 'venues' && normalizedDepartment.includes('สถานที่')) return 'edit';
  if (module === 'registration' && (['event_staff', 'สตาฟงาน'].includes(normalizedRole) || normalizedDepartment.includes('สตาฟ'))) return 'edit';
  if ((module === 'concert_catalog' || module === 'promotions') && (normalizedDepartment.includes('การตลาด') || normalizedDepartment === 'marketing')) return 'edit';
  if (module === 'promotion_approvals' && ['approver', 'ผู้มีอำนาจอนุมัติ'].includes(normalizedRole)) return 'edit';
  if (module === 'promotion_approvals' && (normalizedDepartment.includes('การตลาด') || normalizedDepartment === 'marketing')) return 'view';
  if (module === 'reports' && (normalizedDepartment.includes('การเงิน') || normalizedDepartment === 'finance')) return 'view';
  return 'none';
}

export function effectiveModulePermissions(accountRole: string, department: string, overrides: ModulePermissions = {}, jobRole?: string): Record<BackofficeModule, AccessLevel> {
  const isAdmin = ['admin', 'administrator'].includes(accountRole.trim().toLowerCase());
  const isViewOnly = accountRole.trim().toLowerCase() === 'view_only';
  const defaultsRole = isAdmin ? 'admin' : (jobRole || accountRole);
  return Object.fromEntries(BACKOFFICE_MODULES.map(({ key }) => {
    if (key === 'dashboard') return [key, isAdmin ? 'edit' : 'view'];
    if (key === 'audit' || key === 'employees') return [key, isAdmin ? 'edit' : 'none'];
    const level = overrides[key] ?? defaultModuleAccess(defaultsRole, department, key);
    return [key, isViewOnly && level === 'edit' ? 'view' : level];
  })) as Record<BackofficeModule, AccessLevel>;
}

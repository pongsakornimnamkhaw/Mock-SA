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

export type BackofficeFeature =
  | 'concert.dashboard' | 'concert.create' | 'concert.edit' | 'concert.assignment'
  | 'concert.status' | 'concert.documents' | 'concert.history' | 'concert.search'
  | 'artist.dashboard' | 'artist.search' | 'artist.manage' | 'artist.invitation'
  | 'artist.schedule.create' | 'artist.schedule.view' | 'artist.performance.manage'
  | 'artist.history' | 'report.view' | 'report.manage';

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
  if (module === 'concerts') {
    return canAccessBackofficeFeature(normalizedRole, normalizedDepartment, 'concert.create') === 'edit'
      ? 'edit' : canAccessBackofficeFeature(normalizedRole, normalizedDepartment, 'concert.dashboard');
  }
  if (module === 'artists') return canAccessBackofficeFeature(normalizedRole, normalizedDepartment, 'artist.search');
  if (module === 'venues' && normalizedDepartment.includes('สถานที่')) return 'edit';
  if (module === 'registration' && (['event_staff', 'สตาฟงาน'].includes(normalizedRole) || normalizedDepartment.includes('สตาฟ'))) return 'edit';
  if ((module === 'concert_catalog' || module === 'promotions') && (normalizedDepartment.includes('การตลาด') || normalizedDepartment === 'marketing')) return 'edit';
  if (module === 'promotion_approvals' && ['approver', 'ผู้มีอำนาจอนุมัติ'].includes(normalizedRole)) return 'edit';
  if (module === 'promotion_approvals' && (normalizedDepartment.includes('การตลาด') || normalizedDepartment === 'marketing')) return 'view';
  if (module === 'reports') return canAccessBackofficeFeature(normalizedRole, normalizedDepartment, 'report.view');
  return 'none';
}

const concertActors = new Set(['organizer', 'co_organizer', 'production_staff', 'venue_staff', 'sales', 'marketing', 'finance', 'executive']);
const artistActors = new Set(['organizer', 'co_organizer', 'production_staff', 'technical_staff', 'artist', 'artist_manager', 'executive']);

function resolvedOperationalRole(role: string, department: string): string {
  const normalizedRole = role.trim().toLowerCase();
  const normalizedDepartment = department.trim().toLowerCase();
  if (['admin', 'administrator', 'ผู้ดูแลระบบ'].includes(normalizedRole)) return 'admin';
  if (normalizedRole !== '' && normalizedRole !== 'staff' && normalizedRole !== 'edit' && normalizedRole !== 'view_only') return normalizedRole;
  if (normalizedDepartment.includes('โปรดักชั่น')) return 'production_staff';
  if (normalizedDepartment.includes('สถานที่')) return 'venue_staff';
  if (normalizedDepartment.includes('ขาย')) return 'sales';
  if (normalizedDepartment.includes('การตลาด')) return 'marketing';
  if (normalizedDepartment.includes('การเงิน')) return 'finance';
  if (normalizedDepartment.includes('เทคนิค')) return 'technical_staff';
  if (normalizedDepartment.includes('ผู้บริหาร')) return 'executive';
  return normalizedRole;
}

export function canAccessBackofficeFeature(role: string, department: string, feature: BackofficeFeature): AccessLevel {
  const actor = resolvedOperationalRole(role, department);
  if (actor === 'admin') return 'edit';
  if (feature === 'concert.dashboard' || feature === 'concert.search' || feature === 'concert.history') {
    return concertActors.has(actor) ? 'view' : 'none';
  }
  if (feature === 'concert.assignment' || feature === 'concert.documents') {
    return actor === 'organizer' ? 'edit' : concertActors.has(actor) ? 'view' : 'none';
  }
  if (feature === 'concert.create' || feature === 'concert.edit' || feature === 'concert.status') {
    return actor === 'organizer' ? 'edit' : 'none';
  }
  if (feature === 'artist.dashboard' || feature === 'artist.schedule.view' || feature === 'artist.history') {
    return artistActors.has(actor) ? 'view' : 'none';
  }
  if (feature === 'artist.search') {
    return actor === 'organizer' ? 'edit' : artistActors.has(actor) ? 'view' : 'none';
  }
  if (feature === 'artist.manage' || feature === 'artist.performance.manage') {
    return actor === 'artist_manager' ? 'edit' : 'none';
  }
  if (feature === 'artist.invitation') {
    if (actor === 'organizer') return 'edit';
    return actor === 'artist' || actor === 'artist_manager' ? 'view' : 'none';
  }
  if (feature === 'artist.schedule.create') return actor === 'organizer' ? 'edit' : 'none';
  if (feature === 'report.view') return actor ? 'view' : 'none';
  if (feature === 'report.manage') return actor === 'organizer' ? 'edit' : 'none';
  return 'none';
}

export function effectiveFeatureAccess(accountRole: string, jobRole: string | undefined, department: string, feature: BackofficeFeature): AccessLevel {
  const normalizedAccountRole = accountRole.trim().toLowerCase();
  const authorizationRole = ['admin', 'administrator'].includes(normalizedAccountRole)
    ? normalizedAccountRole : (jobRole || accountRole);
  const level = canAccessBackofficeFeature(authorizationRole, department, feature);
  return normalizedAccountRole === 'view_only' && level === 'edit' ? 'view' : level;
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

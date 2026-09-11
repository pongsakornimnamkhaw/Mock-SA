import type { EmployeeSession } from '@/utils/employeeSession';
import { normalizeModulePermissions } from '@/access/backofficeAccess';

export const EMPLOYEE_SETUP_TOKEN_KEY = 'octavia-employee-setup-token-v1';
export type EmployeeLoginResult =
  | { kind: 'authenticated'; session: EmployeeSession }
  | { kind: 'password_setup_required'; setupToken: string };

export function mapEmployeeSession(d: Record<string, any>): EmployeeSession {
  return {
    userId: d.user_id,
    employeeCode: d.employee_code,
    firstName: d.first_name,
    lastName: d.last_name,
    name: d.name,
    department: d.department,
    role: d.role,
    jobRole: d.job_role,
    email: d.email,
    phone: d.phone,
    userType: d.user_type,
    personnelType: d.personnel_type,
    lastLoginAt: d.last_login_at,
    modulePermissions: normalizeModulePermissions(d.module_permissions),
  };
}

export class EmployeeAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'EmployeeAuthError';
  }
}

export const employeeAuthApi = {
  async login(username: string, password: string): Promise<EmployeeLoginResult> {
    try {
      const response = await fetch('/api/employee/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new EmployeeAuthError(json.error || json.message || 'ไม่สามารถเข้าสู่ระบบพนักงานได้', response.status);
      }

      if (json.requires_password_setup === true) {
        const setupToken = String(json.setup_token || '');
        if (!/^[a-f0-9]{64}$/i.test(setupToken)) throw new EmployeeAuthError('ข้อมูลตั้งรหัสผ่านไม่ถูกต้อง', 500);
        sessionStorage.setItem(EMPLOYEE_SETUP_TOKEN_KEY, setupToken);
        return { kind: 'password_setup_required', setupToken };
      }
      return { kind: 'authenticated', session: mapEmployeeSession(json.data) };
    } catch (err) {
      if (err instanceof EmployeeAuthError) throw err;
      throw new EmployeeAuthError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ กรุณาตรวจสอบ Backend', 0);
    }
  },

  async completePasswordSetup(newPassword: string, confirmPassword: string): Promise<void> {
    const token = sessionStorage.getItem(EMPLOYEE_SETUP_TOKEN_KEY);
    if (!token) throw new EmployeeAuthError('ไม่พบโทเคนตั้งรหัสผ่าน กรุณาเข้าสู่ระบบใหม่', 400);
    const response = await fetch('/api/employee/auth/setup-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Employee-Setup-Token': token },
      body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new EmployeeAuthError(json.error || json.message || 'ไม่สามารถตั้งรหัสผ่านได้', response.status);
    }
    sessionStorage.removeItem(EMPLOYEE_SETUP_TOKEN_KEY);
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/employee/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
  },

  async getMe(): Promise<EmployeeSession | null> {
    try {
      const response = await fetch('/api/employee/auth/me', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      const json = await response.json();
      const d = json.data;
      return mapEmployeeSession(d);
    } catch {
      return null;
    }
  },
};

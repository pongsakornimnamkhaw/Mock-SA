import type { PersonnelType, EmployeeResetRequest } from '@/types/promotion';

// ─── Error class ──────────────────────────────────────────────────────────────

export class EmployeeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'EmployeeApiError';
  }
}

// ─── sessionStorage key for the browser-bound reset token ────────────────────

export const EMPLOYEE_RESET_TOKEN_KEY = 'octavia-employee-reset-v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeProfile {
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  role: string;
  personnelType: PersonnelType;
  lastLoginAt?: string;
  active: boolean;
}

export interface EmployeeActivity {
  logId: string;
  action: string;
  module: string;
  targetId?: string;
  description?: string;
  createdAt: string;
}

export interface EmployeeActivityPage {
  data: EmployeeActivity[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ActivityQueryParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  module?: string;
  action?: string;
}

export interface ResetRequestResult {
  referenceCode: string;
  browserToken: string;
  message: string;
}

export interface ResetStatusResult {
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  rejectionReason?: string;
}

export interface ResetRequestItem {
  requestId: string;
  referenceCode: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  personnelType: PersonnelType;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface ResetRequestPage {
  data: ResetRequestItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResetDecisionInput {
  decision: 'approve' | 'reject';
  phoneVerified: boolean;
  reason?: string;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  return response;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new EmployeeApiError('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง', response.status);
  }
  if (!response.ok) {
    const err = data as { error?: string; message?: string } | null;
    throw new EmployeeApiError(
      err?.error || err?.message || `ไม่สามารถดำเนินการได้ (${response.status})`,
      response.status,
    );
  }
  return data as T;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapProfile(d: Record<string, unknown>): EmployeeProfile {
  return {
    userId: d.user_id as string,
    employeeCode: d.employee_code as string,
    firstName: d.first_name as string,
    lastName: d.last_name as string,
    name: d.name as string,
    email: d.email as string,
    phone: d.phone as string | undefined,
    department: d.department as string,
    role: d.role as string,
    personnelType: (d.personnel_type as PersonnelType) ?? 'internal',
    lastLoginAt: d.last_login_at as string | undefined,
    active: d.active as boolean,
  };
}

function mapActivity(d: Record<string, unknown>): EmployeeActivity {
  return {
    logId: d.log_id as string,
    action: d.action as string,
    module: d.module as string,
    targetId: d.target_id as string | undefined,
    description: d.description as string | undefined,
    createdAt: d.created_at as string,
  };
}

function mapResetRequestItem(d: Record<string, unknown>): ResetRequestItem {
  return {
    requestId: d.request_id as string,
    referenceCode: d.reference_code as string,
    userId: d.user_id as string,
    name: d.name as string,
    email: d.email as string,
    phone: d.phone as string,
    department: d.department as string,
    personnelType: (d.personnel_type as PersonnelType) ?? 'internal',
    status: d.status as string,
    approvedBy: d.approved_by as string | undefined,
    approvedAt: d.approved_at as string | undefined,
    rejectionReason: d.rejection_reason as string | undefined,
    createdAt: d.created_at as string,
  };
}

// ─── API client ───────────────────────────────────────────────────────────────

export const employeeAccountApi = {
  // ── Account profile ──────────────────────────────────────────────────────

  async getProfile(): Promise<EmployeeProfile> {
    const resp = await authFetch('/api/employee/account');
    const body = await parseOrThrow<{ data: Record<string, unknown> }>(resp);
    return mapProfile(body.data);
  },

  async updateProfile(payload: { email?: string; phone?: string }): Promise<EmployeeProfile> {
    const resp = await authFetch('/api/employee/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const body = await parseOrThrow<{ data: Record<string, unknown> }>(resp);
    return mapProfile(body.data);
  },

  async updatePassword(params: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    const resp = await authFetch('/api/employee/account/password', {
      method: 'PATCH',
      body: JSON.stringify({
        current_password: params.currentPassword,
        new_password: params.newPassword,
        confirm_password: params.confirmPassword,
      }),
    });
    if (resp.status === 204) return;
    await parseOrThrow<void>(resp);
  },

  // ── Activity history ─────────────────────────────────────────────────────

  async getActivity(params: ActivityQueryParams = {}): Promise<EmployeeActivityPage> {
    const q = new URLSearchParams();
    if (params.page !== undefined) q.set('page', String(params.page));
    if (params.pageSize !== undefined) q.set('page_size', String(params.pageSize));
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.module) q.set('module', params.module);
    if (params.action) q.set('action', params.action);

    const url = `/api/employee/account/activity${q.toString() ? '?' + q.toString() : ''}`;
    const resp = await authFetch(url);
    const body = await parseOrThrow<{
      data: Record<string, unknown>[];
      page: number;
      page_size: number;
      total: number;
    }>(resp);
    return {
      data: body.data.map(mapActivity),
      page: body.page,
      pageSize: body.page_size,
      total: body.total,
    };
  },

  // ── Password reset — public flow ─────────────────────────────────────────

  async createResetRequest(identifier: string): Promise<ResetRequestResult> {
    const resp = await fetch('/api/employee/auth/password-reset/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const body = await parseOrThrow<{
      reference_code: string;
      browser_token: string;
      message: string;
    }>(resp);
    // Store token only in sessionStorage — never in URL, logs, or localStorage
    sessionStorage.setItem(EMPLOYEE_RESET_TOKEN_KEY, body.browser_token);
    return {
      referenceCode: body.reference_code,
      browserToken: body.browser_token,
      message: body.message,
    };
  },

  async getResetStatus(): Promise<ResetStatusResult> {
    const token = sessionStorage.getItem(EMPLOYEE_RESET_TOKEN_KEY);
    if (!token) {
      throw new EmployeeApiError('ไม่พบโทเคนการรีเซ็ต กรุณาส่งคำร้องใหม่', 400);
    }
    const resp = await fetch('/api/employee/auth/password-reset/status', {
      headers: { 'X-Employee-Reset-Token': token },
    });
    const body = await parseOrThrow<{
      status: ResetStatusResult['status'];
      rejection_reason?: string;
    }>(resp);
    return {
      status: body.status,
      rejectionReason: body.rejection_reason,
    };
  },

  async completeReset(params: { newPassword: string; confirmPassword: string }): Promise<void> {
    const token = sessionStorage.getItem(EMPLOYEE_RESET_TOKEN_KEY);
    if (!token) {
      throw new EmployeeApiError('ไม่พบโทเคนการรีเซ็ต กรุณาส่งคำร้องใหม่', 400);
    }
    const resp = await fetch('/api/employee/auth/password-reset/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Employee-Reset-Token': token,
      },
      body: JSON.stringify({
        new_password: params.newPassword,
        confirm_password: params.confirmPassword,
      }),
    });
    if (!resp.ok) {
      // Do NOT clear token on failure so the user can retry or see the error
      const text = await resp.text();
      let err: { error?: string; message?: string } | null = null;
      try { err = text ? JSON.parse(text) : null; } catch { /* ignore */ }
      throw new EmployeeApiError(
        err?.error || err?.message || `ไม่สามารถตั้งรหัสผ่านได้ (${resp.status})`,
        resp.status,
      );
    }
    // Clear token on success — it has been consumed
    sessionStorage.removeItem(EMPLOYEE_RESET_TOKEN_KEY);
  },

  // ── Password reset — admin operations ────────────────────────────────────

  async getPendingResetCount(): Promise<number> {
    try {
      const resp = await authFetch('/api/employee/password-reset-requests/count');
      const body = await parseOrThrow<{ count: number }>(resp);
      return body.count;
    } catch {
      return 0;
    }
  },

  async getResetRequests(params: { page?: number; pageSize?: number } = {}): Promise<ResetRequestPage> {
    const q = new URLSearchParams();
    if (params.page !== undefined) q.set('page', String(params.page));
    if (params.pageSize !== undefined) q.set('page_size', String(params.pageSize));
    const url = `/api/employee/password-reset-requests${q.toString() ? '?' + q.toString() : ''}`;
    const resp = await authFetch(url);
    const body = await parseOrThrow<{
      data: Record<string, unknown>[];
      total: number;
      page: number;
      page_size: number;
    }>(resp);
    return {
      data: body.data.map(mapResetRequestItem),
      total: body.total,
      page: body.page,
      pageSize: body.page_size,
    };
  },

  async decideResetRequest(
    id: string,
    input: ResetDecisionInput,
  ): Promise<{ status: string }> {
    const resp = await authFetch(
      `/api/employee/password-reset-requests/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          decision: input.decision,
          phone_verified: input.phoneVerified,
          reason: input.reason ?? '',
        }),
      },
    );
    return parseOrThrow<{ status: string }>(resp);
  },
};

// Re-export types that other modules may need
export type { PersonnelType, EmployeeResetRequest };

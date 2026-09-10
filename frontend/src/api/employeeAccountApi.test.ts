import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EmployeeApiError,
  employeeAccountApi,
  EMPLOYEE_RESET_TOKEN_KEY,
} from '@/api/employeeAccountApi';

// ─── helpers ────────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const noContent = () => new Response(null, { status: 204 });

const errorResponse = (status: number, message: string) =>
  json({ error: message }, status);

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

// ─── getProfile ──────────────────────────────────────────────────────────────

describe('employeeAccountApi.getProfile', () => {
  it('maps personnel_type and sends credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        data: {
          user_id: 'US1',
          employee_code: 'B123',
          first_name: 'ทดสอบ',
          last_name: 'ผู้ใช้',
          name: 'ทดสอบ ผู้ใช้',
          email: 'test@example.com',
          phone: '0812345678',
          department: 'IT',
          role: 'internal',
          personnel_type: 'external',
          last_login_at: '2026-09-10T06:19:00Z',
          active: true,
        },
      }),
    );

    const profile = await employeeAccountApi.getProfile();
    expect(profile.personnelType).toBe('external');
    expect(profile.lastLoginAt).toBe('2026-09-10T06:19:00Z');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/account');
    expect(init?.credentials).toBe('include');
  });

  it('throws EmployeeApiError on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(401, 'ไม่ได้รับอนุญาต'),
    );
    await expect(employeeAccountApi.getProfile()).rejects.toMatchObject({
      status: 401,
    });
  });
});

// ─── updateProfile ───────────────────────────────────────────────────────────

describe('employeeAccountApi.updateProfile', () => {
  it('patches profile and returns updated data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        data: {
          user_id: 'US1',
          employee_code: 'B123',
          first_name: 'ทดสอบ',
          last_name: 'ผู้ใช้',
          name: 'ทดสอบ ผู้ใช้',
          email: 'test@example.com',
          phone: '0899999999',
          department: 'IT',
          role: 'internal',
          personnel_type: 'internal',
          active: true,
        },
      }),
    );

    const result = await employeeAccountApi.updateProfile({ phone: '0899999999' });
    expect(result.phone).toBe('0899999999');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/account/profile');
    expect(init?.method).toBe('PATCH');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse(String(init?.body))).toEqual({ phone: '0899999999' });
  });

  it('throws EmployeeApiError with 403 when internal user tries to change email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(403, 'บุคลากรภายในไม่สามารถเปลี่ยนอีเมลได้'),
    );
    await expect(
      employeeAccountApi.updateProfile({ email: 'new@example.com' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

// ─── updatePassword ──────────────────────────────────────────────────────────

describe('employeeAccountApi.updatePassword', () => {
  it('patches password with credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent());

    await expect(
      employeeAccountApi.updatePassword({
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
        confirmPassword: 'NewPass1!',
      }),
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/account/password');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      current_password: 'OldPass1!',
      new_password: 'NewPass1!',
      confirm_password: 'NewPass1!',
    });
  });

  it('throws EmployeeApiError with 400 when current password is wrong', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง'),
    );
    await expect(
      employeeAccountApi.updatePassword({
        currentPassword: 'wrong',
        newPassword: 'NewPass1!',
        confirmPassword: 'NewPass1!',
      }),
    ).rejects.toMatchObject({ status: 400, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  });
});

// ─── getActivity ─────────────────────────────────────────────────────────────

describe('employeeAccountApi.getActivity', () => {
  it('sends pagination query params and returns mapped page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        data: [
          { log_id: 'L1', action: 'เพิ่ม', module: 'ศิลปิน', target_id: 'A1', created_at: '2026-09-10T01:00:00Z' },
        ],
        page: 1,
        page_size: 20,
        total: 1,
      }),
    );

    const result = await employeeAccountApi.getActivity({ page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.data[0].action).toBe('เพิ่ม');

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/employee/account/activity');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('page_size=20');
  });
});

// ─── createResetRequest ───────────────────────────────────────────────────────

describe('employeeAccountApi.createResetRequest', () => {
  it('posts identifier and stores token in sessionStorage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        reference_code: 'RST-123456',
        browser_token: 'abc'.repeat(21) + 'x',
        message: 'คำร้องถูกส่งแล้ว',
      }, 202),
    );

    const result = await employeeAccountApi.createResetRequest('B6728786');
    expect(result.referenceCode).toBe('RST-123456');
    expect(sessionStorage.getItem(EMPLOYEE_RESET_TOKEN_KEY)).toBe('abc'.repeat(21) + 'x');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/auth/password-reset/requests');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ identifier: 'B6728786' });
  });
});

// ─── getResetStatus ───────────────────────────────────────────────────────────

describe('employeeAccountApi.getResetStatus', () => {
  it('sends token via X-Employee-Reset-Token header', async () => {
    sessionStorage.setItem(EMPLOYEE_RESET_TOKEN_KEY, 'my-token-value');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ status: 'pending' }),
    );

    const result = await employeeAccountApi.getResetStatus();
    expect(result.status).toBe('pending');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/auth/password-reset/status');
    expect((init?.headers as Record<string, string>)['X-Employee-Reset-Token']).toBe('my-token-value');
  });

  it('throws when no token in sessionStorage', async () => {
    await expect(employeeAccountApi.getResetStatus()).rejects.toBeInstanceOf(EmployeeApiError);
  });

  it('returns rejection_reason when status is rejected', async () => {
    sessionStorage.setItem(EMPLOYEE_RESET_TOKEN_KEY, 'tok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ status: 'rejected', rejection_reason: 'ข้อมูลไม่ตรง' }),
    );
    const result = await employeeAccountApi.getResetStatus();
    expect(result.rejectionReason).toBe('ข้อมูลไม่ตรง');
  });
});

// ─── completeReset ────────────────────────────────────────────────────────────

describe('employeeAccountApi.completeReset', () => {
  it('sends token header and body, clears sessionStorage on success', async () => {
    sessionStorage.setItem(EMPLOYEE_RESET_TOKEN_KEY, 'reset-tok');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent());

    await employeeAccountApi.completeReset({ newPassword: 'Fresh1234!', confirmPassword: 'Fresh1234!' });

    expect(sessionStorage.getItem(EMPLOYEE_RESET_TOKEN_KEY)).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/auth/password-reset/complete');
    expect((init?.headers as Record<string, string>)['X-Employee-Reset-Token']).toBe('reset-tok');
    expect(JSON.parse(String(init?.body))).toEqual({
      new_password: 'Fresh1234!',
      confirm_password: 'Fresh1234!',
    });
  });

  it('surfaces token errors without clearing sessionStorage', async () => {
    sessionStorage.setItem(EMPLOYEE_RESET_TOKEN_KEY, 'reset-tok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(400, 'โทเคนหมดอายุแล้ว'),
    );
    await expect(
      employeeAccountApi.completeReset({ newPassword: 'Fresh1234!', confirmPassword: 'Fresh1234!' }),
    ).rejects.toMatchObject({ status: 400 });
    // token should NOT be cleared on failure
    expect(sessionStorage.getItem(EMPLOYEE_RESET_TOKEN_KEY)).toBe('reset-tok');
  });
});

// ─── getPendingResetCount ─────────────────────────────────────────────────────

describe('employeeAccountApi.getPendingResetCount', () => {
  it('returns the count number from the endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ count: 3 }));
    const count = await employeeAccountApi.getPendingResetCount();
    expect(count).toBe(3);
  });

  it('returns 0 on any error instead of throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network error'));
    const count = await employeeAccountApi.getPendingResetCount();
    expect(count).toBe(0);
  });
});

// ─── getResetRequests ─────────────────────────────────────────────────────────

describe('employeeAccountApi.getResetRequests', () => {
  it('returns paginated reset request list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        data: [
          {
            request_id: 'ER-001',
            reference_code: 'RST-123456',
            user_id: 'U1',
            name: 'ทดสอบ',
            email: 'test@example.com',
            phone: '0812345678',
            department: 'IT',
            personnel_type: 'internal',
            status: 'pending',
            created_at: '2026-09-10T06:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      }),
    );

    const result = await employeeAccountApi.getResetRequests({ page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.data[0].referenceCode).toBe('RST-123456');
    expect(result.data[0].personnelType).toBe('internal');
  });
});

// ─── decideResetRequest ───────────────────────────────────────────────────────

describe('employeeAccountApi.decideResetRequest', () => {
  it('patches with approve decision and phone_verified', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ status: 'approved' }),
    );

    const result = await employeeAccountApi.decideResetRequest('ER-001', {
      decision: 'approve',
      phoneVerified: true,
    });
    expect(result.status).toBe('approved');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/employee/password-reset-requests/ER-001');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      decision: 'approve',
      phone_verified: true,
    });
  });

  it('patches with reject decision and reason', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ status: 'rejected' }),
    );

    await employeeAccountApi.decideResetRequest('ER-001', {
      decision: 'reject',
      phoneVerified: false,
      reason: 'ข้อมูลไม่ตรงกัน',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      decision: 'reject',
      reason: 'ข้อมูลไม่ตรงกัน',
    });
  });

  it('surfaces 409 when request is no longer pending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(409, 'คำร้องนี้ถูกตัดสินใจไปแล้ว'),
    );
    await expect(
      employeeAccountApi.decideResetRequest('ER-001', { decision: 'approve', phoneVerified: true }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

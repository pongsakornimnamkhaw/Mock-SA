import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPLOYEE_SETUP_TOKEN_KEY, employeeAuthApi, mapEmployeeSession } from './employeeAuthApi';

afterEach(() => vi.restoreAllMocks());

describe('mapEmployeeSession', () => {
  it('maps effective module permissions from the backend response', () => {
    const session = mapEmployeeSession({
      user_id: 'U1', employee_code: 'E1', first_name: 'A', last_name: 'B', name: 'A B',
      department: 'ฝ่ายการตลาด', role: 'staff', email: 'a@example.com',
      module_permissions: { dashboard: 'view', promotions: 'edit', employees: 'none' },
    });
    expect(session.modulePermissions?.dashboard).toBe('view');
    expect(session.modulePermissions?.promotions).toBe('edit');
    expect(session.modulePermissions?.employees).toBe('none');
  });

  it('maps a first-login response to a password setup result', async () => {
    const token = 'a'.repeat(64);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ requires_password_setup: true, setup_token: token }), { status: 200 })));
    await expect(employeeAuthApi.login('OCT-EMP-011', '0812345678')).resolves.toEqual({ kind: 'password_setup_required', setupToken: token });
    expect(sessionStorage.getItem('octavia-employee-setup-token-v1')).toBe(token);
  });

  it('does not create a privileged local session when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(employeeAuthApi.login('B6728786', 'anything')).rejects.toMatchObject({ status: 0 });
  });

  it('sends the setup token in a header and clears it after success', async () => {
    const token = 'b'.repeat(64);
    sessionStorage.setItem(EMPLOYEE_SETUP_TOKEN_KEY, token);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await employeeAuthApi.completePasswordSetup('NewSecure123!', 'NewSecure123!');
    expect(fetchMock).toHaveBeenCalledWith('/api/employee/auth/setup-password', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Employee-Setup-Token': token }),
    }));
    expect(sessionStorage.getItem(EMPLOYEE_SETUP_TOKEN_KEY)).toBeNull();
  });

  it('keeps the setup token when completion fails so the user can retry', async () => {
    const token = 'c'.repeat(64);
    sessionStorage.setItem(EMPLOYEE_SETUP_TOKEN_KEY, token);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'retry' }), { status: 500 })));
    await expect(employeeAuthApi.completePasswordSetup('NewSecure123!', 'NewSecure123!')).rejects.toMatchObject({ status: 500 });
    expect(sessionStorage.getItem(EMPLOYEE_SETUP_TOKEN_KEY)).toBe(token);
  });
});

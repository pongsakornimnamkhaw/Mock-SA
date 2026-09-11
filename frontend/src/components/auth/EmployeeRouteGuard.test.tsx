import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeAuthApi } from '@/api/employeeAuthApi';
import EmployeeRouteGuard from './EmployeeRouteGuard';
import { saveCustomerSession } from '@/utils/customerSession';

vi.mock('@/api/employeeAuthApi', () => ({
  employeeAuthApi: {
    getMe: vi.fn(),
  },
}));

function LoginLocation() {
  const location = useLocation();
  return <div>login:{location.pathname}{location.search}</div>;
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <EmployeeRouteGuard>
              <div>protected dashboard</div>
            </EmployeeRouteGuard>
          }
        />
        <Route path="/employee/login" element={<LoginLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EmployeeRouteGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows access denied for a module with none access', async () => {
    const session = {
      userId: 'U1',
      employeeCode: 'E1',
      firstName: 'A',
      lastName: 'B',
      name: 'A B',
      department: 'ฝ่ายการตลาด',
      role: 'staff',
      email: 'a@example.com',
      modulePermissions: { audit: 'none' as const },
    };
    vi.mocked(employeeAuthApi.getMe).mockResolvedValue(session as any);

    render(
      <MemoryRouter>
        <EmployeeRouteGuard module="audit">
          <div>secret</div>
        </EmployeeRouteGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByText('ไม่มีสิทธิ์เข้าถึงส่วนนี้')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('returns an authenticated customer to the customer home', async () => {
    vi.mocked(employeeAuthApi.getMe).mockResolvedValue(null);
    saveCustomerSession({
      userId: 'C1',
      firstName: 'Customer',
      lastName: 'One',
      dateOfBirth: '2000-01-01',
      gender: 'female',
      phone: '0812345678',
      address: 'Bangkok',
      email: 'customer@example.com',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<EmployeeRouteGuard><div>backoffice</div></EmployeeRouteGuard>} />
          <Route path="/home" element={<div>customer home</div>} />
          <Route path="/employee/login" element={<div>employee login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('customer home')).toBeInTheDocument();
    expect(screen.queryByText('employee login')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to employee login', async () => {
    vi.mocked(employeeAuthApi.getMe).mockResolvedValue(null);

    renderGuard();

    expect(screen.queryByText('protected dashboard')).not.toBeInTheDocument();
    expect(await screen.findByText('login:/employee/login?redirect=%2Fdashboard')).toBeInTheDocument();
  });

  it('rejects a forged or stale localStorage session', async () => {
    localStorage.setItem('octavia-employee-session-ui-v1', JSON.stringify({ userId: 'fake', name: 'Fake User' }));
    vi.mocked(employeeAuthApi.getMe).mockResolvedValue(null);

    renderGuard();

    expect(await screen.findByText('login:/employee/login?redirect=%2Fdashboard')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('octavia-employee-session-ui-v1')).toBeNull());
  });

  it('renders the dashboard only after the backend validates the session', async () => {
    vi.mocked(employeeAuthApi.getMe).mockResolvedValue({
      userId: 'US-1',
      employeeCode: 'EMP-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      department: 'Operations',
      role: 'staff',
      email: 'employee@example.test',
    } as any);

    renderGuard();

    expect(await screen.findByText('protected dashboard')).toBeInTheDocument();
  });
});

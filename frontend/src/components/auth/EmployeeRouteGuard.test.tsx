import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import EmployeeRouteGuard from './EmployeeRouteGuard';
import { saveEmployeeSession } from '@/utils/employeeSession';
import { saveCustomerSession } from '@/utils/customerSession';

describe('EmployeeRouteGuard', () => {
  beforeEach(() => localStorage.clear());

  it('shows access denied for a module with none access', () => {
    saveEmployeeSession({
      userId: 'U1', employeeCode: 'E1', firstName: 'A', lastName: 'B', name: 'A B',
      department: 'ฝ่ายการตลาด', role: 'staff', email: 'a@example.com',
      modulePermissions: { audit: 'none' },
    });
    render(<MemoryRouter><EmployeeRouteGuard module="audit"><div>secret</div></EmployeeRouteGuard></MemoryRouter>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('ไม่มีสิทธิ์เข้าถึงส่วนนี้')).toBeInTheDocument();
  });

  it('returns an authenticated customer to the customer home', () => {
    saveCustomerSession({
      userId: 'C1', firstName: 'Customer', lastName: 'One', dateOfBirth: '2000-01-01',
      gender: 'female', phone: '0812345678', address: 'Bangkok', email: 'customer@example.com',
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

    expect(screen.getByText('customer home')).toBeInTheDocument();
    expect(screen.queryByText('employee login')).not.toBeInTheDocument();
  });
});

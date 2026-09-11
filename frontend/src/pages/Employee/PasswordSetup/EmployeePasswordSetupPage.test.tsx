import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeePasswordSetupPage from '.';
import { employeeAuthApi, EMPLOYEE_SETUP_TOKEN_KEY } from '@/api/employeeAuthApi';

describe('EmployeePasswordSetupPage', () => {
  beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

  it('sets the password and returns to employee login', async () => {
    sessionStorage.setItem(EMPLOYEE_SETUP_TOKEN_KEY, 'a'.repeat(64));
    vi.spyOn(employeeAuthApi, 'completePasswordSetup').mockResolvedValue();
    render(<MemoryRouter initialEntries={['/employee/setup-password']}><Routes>
      <Route path="/employee/setup-password" element={<EmployeePasswordSetupPage />} />
      <Route path="/employee/login" element={<div>employee login</div>} />
    </Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: 'NewSecure123!' } });
    fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), { target: { value: 'NewSecure123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่าน' }));
    expect(await screen.findByText('employee login')).toBeInTheDocument();
  });

  it('redirects to login with an error marker when the setup token is missing', async () => {
    function LoginLocation() {
      return <div>{useLocation().search}</div>;
    }
    render(<MemoryRouter initialEntries={['/employee/setup-password']}><Routes>
      <Route path="/employee/setup-password" element={<EmployeePasswordSetupPage />} />
      <Route path="/employee/login" element={<LoginLocation />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('?password_setup=missing')).toBeInTheDocument();
  });

  it('can reveal and hide both password fields', () => {
    sessionStorage.setItem(EMPLOYEE_SETUP_TOKEN_KEY, 'a'.repeat(64));
    render(<MemoryRouter><EmployeePasswordSetupPage /></MemoryRouter>);
    const password = screen.getByLabelText(/^รหัสผ่านใหม่/);
    const confirmation = screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/);
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'แสดงรหัสผ่าน' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(confirmation).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('rejects mismatched passwords before calling the API', async () => {
    sessionStorage.setItem(EMPLOYEE_SETUP_TOKEN_KEY, 'a'.repeat(64));
    const complete = vi.spyOn(employeeAuthApi, 'completePasswordSetup').mockResolvedValue();
    render(<MemoryRouter><EmployeePasswordSetupPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: 'NewSecure123!' } });
    fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), { target: { value: 'Different123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่าน' }));
    expect(await screen.findByText('รหัสผ่านและการยืนยันไม่ตรงกัน')).toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled();
  });
});

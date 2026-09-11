import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeLoginPage from '@/pages/Employee/Login';
import { saveCustomerSession } from '@/utils/customerSession';
import { employeeAuthApi } from '@/api/employeeAuthApi';

describe('EmployeeLoginPage', () => {
    beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });
    it('does not expose demo employee credentials', () => {
        render(
            <MemoryRouter>
                <EmployeeLoginPage />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('button', { name: /B6728786/ })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('does not show the obsolete department description', () => {
        const { container } = render(
            <MemoryRouter>
                <EmployeeLoginPage />
            </MemoryRouter>,
        );

        expect(container).not.toHaveTextContent('ฝ่ายขายและการตรวจสอบสลิป');
        expect(container).not.toHaveTextContent('จัดการคอนเสิร์ตและโปรโมชั่น');
        expect(screen.getByRole('heading', { name: 'ระบบงานพนักงาน (Staff Portal)' })).toBeInTheDocument();
    });

    it('returns an authenticated customer home without showing the employee login', () => {
        saveCustomerSession({
            userId: 'C1', firstName: 'Customer', lastName: 'One', dateOfBirth: '2000-01-01',
            gender: 'female', phone: '0812345678', address: 'Bangkok', email: 'customer@example.com',
        });

        render(
            <MemoryRouter initialEntries={['/employee/login']}>
                <Routes>
                    <Route path="/employee/login" element={<EmployeeLoginPage />} />
                    <Route path="/home" element={<div>customer home</div>} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('customer home')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'ระบบงานพนักงาน (Staff Portal)' })).not.toBeInTheDocument();
    });

    it('always opens the dashboard after a successful employee login', async () => {
        vi.spyOn(employeeAuthApi, 'login').mockResolvedValue({ kind: 'authenticated', session: {
            userId: 'E7', employeeCode: 'OCT-EMP-007', firstName: 'Marketing', lastName: 'Staff',
            name: 'Marketing Staff', department: 'ฝ่ายการตลาด', role: 'edit', jobRole: 'staff',
            email: 'marketing@example.com', modulePermissions: { dashboard: 'view', sales: 'none' },
        } });

        render(
            <MemoryRouter initialEntries={['/employee/login?redirect=%2Fsales%2Fbookings']}>
                <Routes>
                    <Route path="/employee/login" element={<EmployeeLoginPage />} />
                    <Route path="/dashboard" element={<div>employee dashboard</div>} />
                    <Route path="/sales/bookings" element={<div>sales bookings</div>} />
                </Routes>
            </MemoryRouter>,
        );

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'OCT-EMP-007' } });
        fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), { target: { value: 'Octavia@2026' } });
        fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบพนักงาน' }));

        expect(await screen.findByText('employee dashboard')).toBeInTheDocument();
        expect(screen.queryByText('sales bookings')).not.toBeInTheDocument();
    });

    it('forces a new employee to the password setup page', async () => {
        vi.spyOn(employeeAuthApi, 'login').mockResolvedValue({ kind: 'password_setup_required', setupToken: 'a'.repeat(64) });
        render(<MemoryRouter initialEntries={['/employee/login']}><Routes>
            <Route path="/employee/login" element={<EmployeeLoginPage />} />
            <Route path="/employee/setup-password" element={<div>password setup</div>} />
        </Routes></MemoryRouter>);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), { target: { value: '0812345678' } });
        fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบพนักงาน' }));
        expect(await screen.findByText('password setup')).toBeInTheDocument();
        expect(localStorage.getItem('octavia-employee-session-ui-v1')).toBeNull();
    });
});

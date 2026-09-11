import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveEmployeeSession } from '@/utils/employeeSession';
import Sidebar from './Sidebar';

vi.mock('@/api/employeeAccountApi', () => ({
  employeeAccountApi: { getPendingResetCount: vi.fn().mockResolvedValue(0) },
}));

describe('Sidebar module locks', () => {
  beforeEach(() => {
    localStorage.clear();
    saveEmployeeSession({
      userId: 'SEED_EMP_010', employeeCode: 'OCT-EMP-010', firstName: 'ภาคภูมิ', lastName: 'รัตนชัย',
      name: 'ภาคภูมิ รัตนชัย', department: 'ฝ่ายการเงิน', role: 'view_only', jobRole: 'staff',
      email: 'phakphum.viewer@octavia.test', modulePermissions: {},
    });
  });

  it('lets finance view concerts and reports while locking the artist module', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Sidebar /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /งานคอนเสิร์ต/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /ศิลปินและการแสดง/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /ภาพรวมทั้งหมด/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /รายการคอนเสิร์ตที่เสร็จสิ้นแล้ว/ })).toBeEnabled();
  });
});

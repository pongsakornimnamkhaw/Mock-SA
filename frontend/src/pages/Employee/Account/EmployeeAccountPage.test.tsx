import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EmployeeAccountPage from './index';
import type { EmployeeProfile, EmployeeActivityPage } from '@/api/employeeAccountApi';
import type { PersonnelType } from '@/types/promotion';

// ─── mock API ────────────────────────────────────────────────────────────────
const { getProfile, updateProfile, updatePassword, getActivity } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  updatePassword: vi.fn(),
  getActivity: vi.fn(),
}));

vi.mock('@/api/employeeAccountApi', () => ({
  employeeAccountApi: { getProfile, updateProfile, updatePassword, getActivity },
}));

// ─── mock session ─────────────────────────────────────────────────────────────
const { saveEmployeeSession } = vi.hoisted(() => ({
  saveEmployeeSession: vi.fn(),
}));

vi.mock('@/utils/employeeSession', () => ({
  getEmployeeSession: vi.fn(() => null),
  saveEmployeeSession,
  clearEmployeeSession: vi.fn(),
  EMPLOYEE_SESSION_EVENT: 'octavia-employee-session-change',
}));

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeProfile = (personnelType: PersonnelType = 'internal'): EmployeeProfile => ({
  userId: 'US1',
  employeeCode: 'B6728786',
  firstName: 'ทดสอบ',
  lastName: 'ผู้ใช้',
  name: 'ทดสอบ ผู้ใช้',
  email: 'test@example.com',
  phone: '0812345678',
  department: 'IT',
  role: 'staff',
  personnelType,
  lastLoginAt: '2026-09-10T01:19:00+07:00',
  active: true,
});

const makeActivityPage = (): EmployeeActivityPage => ({
  data: [
    {
      logId: 'L1',
      action: 'เพิ่ม',
      module: 'ศิลปิน',
      targetId: 'A1',
      createdAt: '2026-09-10T01:19:00+07:00',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
});

function renderAccount(_personnelType: PersonnelType = 'internal') {
  render(
    <MemoryRouter>
      <EmployeeAccountPage />
    </MemoryRouter>,
  );
}

function setupDefaults(personnelType: PersonnelType = 'internal') {
  getProfile.mockResolvedValue(makeProfile(personnelType));
  getActivity.mockResolvedValue(makeActivityPage());
  updateProfile.mockResolvedValue(makeProfile(personnelType));
  updatePassword.mockResolvedValue(undefined);
}

// ─── tests ───────────────────────────────────────────────────────────────────
describe('EmployeeAccountPage — ProfileTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps internal email readonly and allows phone editing', async () => {
    renderAccount('internal');
    expect(await screen.findByLabelText('อีเมล')).toBeDisabled();
    expect(screen.getByLabelText('เบอร์โทรศัพท์')).toBeEnabled();
  });

  it('allows external user to edit both email and phone', async () => {
    setupDefaults('external');
    renderAccount('external');
    expect(await screen.findByLabelText('อีเมล')).toBeEnabled();
    expect(screen.getByLabelText('เบอร์โทรศัพท์')).toBeEnabled();
  });

  it('calls updateProfile and saves session on successful profile save', async () => {
    setupDefaults('external');
    renderAccount('external');
    await screen.findByLabelText('อีเมล');

    await userEvent.clear(screen.getByLabelText('เบอร์โทรศัพท์'));
    await userEvent.type(screen.getByLabelText('เบอร์โทรศัพท์'), '0899999999');
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    await waitFor(() => expect(saveEmployeeSession).toHaveBeenCalled());
  });

  it('shows API error message when profile save fails', async () => {
    updateProfile.mockRejectedValue(new Error('เซิร์ฟเวอร์ไม่ตอบสนอง'));
    renderAccount('internal');
    await screen.findByLabelText('เบอร์โทรศัพท์');

    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText('เซิร์ฟเวอร์ไม่ตอบสนอง')).toBeInTheDocument();
  });
});

describe('EmployeeAccountPage — SecurityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it('shows password fields and clears them on success', async () => {
    renderAccount();
    await screen.findByLabelText('อีเมล');

    await userEvent.click(screen.getByRole('tab', { name: 'ความปลอดภัย' }));

    const currentField = screen.getByLabelText('รหัสผ่านปัจจุบัน');
    const newField = screen.getByLabelText('รหัสผ่านใหม่');
    const confirmField = screen.getByLabelText('ยืนยันรหัสผ่านใหม่');

    await userEvent.type(currentField, 'OldPass1!');
    await userEvent.type(newField, 'NewPass1!');
    await userEvent.type(confirmField, 'NewPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    }));
    // fields should be cleared after success
    await waitFor(() => expect(screen.getByLabelText('รหัสผ่านปัจจุบัน')).toHaveValue(''));
  });

  it('shows error when password change fails', async () => {
    updatePassword.mockRejectedValue(new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง'));
    renderAccount();
    await screen.findByLabelText('อีเมล');

    await userEvent.click(screen.getByRole('tab', { name: 'ความปลอดภัย' }));
    await userEvent.type(screen.getByLabelText('รหัสผ่านปัจจุบัน'), 'Wrong!');
    await userEvent.type(screen.getByLabelText('รหัสผ่านใหม่'), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), 'NewPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }));

    expect(await screen.findByText('รหัสผ่านปัจจุบันไม่ถูกต้อง')).toBeInTheDocument();
  });
});

describe('EmployeeAccountPage — ActivityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it('shows only server-provided activity and formats Bangkok time', async () => {
    renderAccount('external');
    await userEvent.click(await screen.findByRole('tab', { name: 'ประวัติการทำงานของฉัน' }));
    // 2026-09-10T01:19:00+07:00 in Thai Buddhist calendar should be 10/09/2569 01:19 น.
    expect(await screen.findByText('10/09/2569 01:19 น.')).toBeInTheDocument();
  });

  it('shows empty state when no activity', async () => {
    getActivity.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
    renderAccount();
    await userEvent.click(await screen.findByRole('tab', { name: 'ประวัติการทำงานของฉัน' }));
    expect(await screen.findByText(/ไม่พบประวัติ/)).toBeInTheDocument();
  });

  it('shows error when activity fetch fails', async () => {
    getActivity.mockRejectedValue(new Error('โหลดประวัติไม่ได้'));
    renderAccount();
    await userEvent.click(await screen.findByRole('tab', { name: 'ประวัติการทำงานของฉัน' }));
    expect(await screen.findByText('โหลดประวัติไม่ได้')).toBeInTheDocument();
  });
});

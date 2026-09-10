import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EmployeePasswordRecoveryPage from './index';

const { createResetRequest, getResetStatus, completeReset } = vi.hoisted(() => ({
  createResetRequest: vi.fn(),
  getResetStatus: vi.fn(),
  completeReset: vi.fn(),
}));

vi.mock('@/api/employeeAccountApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/employeeAccountApi')>();
  return {
    ...actual,
    employeeAccountApi: {
      ...actual.employeeAccountApi,
      createResetRequest,
      getResetStatus,
      completeReset,
    },
  };
});

function renderRecovery() {
  return render(
    <MemoryRouter>
      <EmployeePasswordRecoveryPage />
    </MemoryRouter>,
  );
}

describe('EmployeePasswordRecoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('moves from request to waiting and then reset on approval', async () => {
    createResetRequest.mockResolvedValue({
      referenceCode: 'RST-123456',
      browserToken: 'test-token-123',
      message: 'สร้างคำร้องสำเร็จ',
    });
    getResetStatus.mockResolvedValue({ status: 'approved' });
    completeReset.mockResolvedValue(undefined);

    renderRecovery();

    const input = screen.getByLabelText('รหัสพนักงานหรืออีเมล');
    fireEvent.change(input, { target: { value: 'B6728786' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ส่งคำร้อง' }));
    });

    // State 2: Waiting
    expect(screen.getByText('RST-123456')).toBeInTheDocument();
    expect(createResetRequest).toHaveBeenCalledWith('B6728786');

    // Trigger polling check
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // State 3: Reset Form
    expect(screen.getByLabelText('รหัสผ่านใหม่')).toBeInTheDocument();
    expect(screen.getByLabelText('ยืนยันรหัสผ่านใหม่')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('รหัสผ่านใหม่'), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), { target: { value: 'NewPassword123!' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));
    });

    expect(completeReset).toHaveBeenCalledWith({
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    });
  });

  it('handles rejected status and displays rejection reason', async () => {
    createResetRequest.mockResolvedValue({
      referenceCode: 'RST-999999',
      browserToken: 'test-token-999',
      message: 'สร้างคำร้องสำเร็จ',
    });
    getResetStatus.mockResolvedValue({
      status: 'rejected',
      rejectionReason: 'ติดต่อเบอร์โทรศัพท์ที่ลงทะเบียนไม่ได้',
    });

    renderRecovery();

    fireEvent.change(screen.getByLabelText('รหัสพนักงานหรืออีเมล'), { target: { value: 'EMP-999' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ส่งคำร้อง' }));
    });

    expect(screen.getByText('RST-999999')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText(/ติดต่อเบอร์โทรศัพท์ที่ลงทะเบียนไม่ได้/)).toBeInTheDocument();
  });

  it('handles expired status and allows restarting request', async () => {
    createResetRequest.mockResolvedValue({
      referenceCode: 'RST-EXPIRED',
      browserToken: 'token-expired',
      message: 'สร้างคำร้องสำเร็จ',
    });
    getResetStatus.mockResolvedValue({
      status: 'expired',
    });

    renderRecovery();

    fireEvent.change(screen.getByLabelText('รหัสพนักงานหรืออีเมล'), { target: { value: 'EMP-EXP' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ส่งคำร้อง' }));
    });

    expect(screen.getByText('RST-EXPIRED')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText(/คำร้องหมดอายุแล้ว/)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'ส่งคำร้องใหม่' });
    fireEvent.click(retryBtn);

    expect(screen.getByLabelText('รหัสพนักงานหรืออีเมล')).toBeInTheDocument();
  });
});


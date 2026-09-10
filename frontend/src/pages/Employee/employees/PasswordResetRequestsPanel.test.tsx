import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordResetRequestsPanel from './PasswordResetRequestsPanel';
import type { ResetRequestPage } from '@/api/employeeAccountApi';

const { getResetRequests, decideResetRequest } = vi.hoisted(() => ({
  getResetRequests: vi.fn(),
  decideResetRequest: vi.fn(),
}));

vi.mock('@/api/employeeAccountApi', () => ({
  employeeAccountApi: {
    getResetRequests,
    decideResetRequest,
  },
}));

const mockRequestsPage: ResetRequestPage = {
  data: [
    {
      requestId: 'ER-001',
      referenceCode: 'RST-123456',
      userId: 'EMP-001',
      name: 'สมชาย ทดสอบ',
      email: 'somchai@octavia.test',
      phone: '0812345678',
      department: 'ฝ่ายการตลาด',
      personnelType: 'internal',
      status: 'pending',
      createdAt: '2026-09-10T06:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

describe('PasswordResetRequestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getResetRequests.mockResolvedValue(mockRequestsPage);
    decideResetRequest.mockResolvedValue({ status: 'approved' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires phone verification before approval', async () => {
    render(<PasswordResetRequestsPanel />);
    expect(await screen.findByText('RST-123456')).toBeInTheDocument();
    
    const approveBtn = screen.getByRole('button', { name: 'อนุมัติ' });
    expect(approveBtn).toBeDisabled();

    const checkbox = screen.getByRole('checkbox', { name: 'โทรยืนยันกับเบอร์เดิมแล้ว' });
    await userEvent.click(checkbox);
    expect(approveBtn).toBeEnabled();

    await userEvent.click(approveBtn);
    await waitFor(() => {
      expect(decideResetRequest).toHaveBeenCalledWith('ER-001', {
        decision: 'approve',
        phoneVerified: true,
      });
    });
  });

  it('allows rejecting a request with a reason', async () => {
    decideResetRequest.mockResolvedValue({ status: 'rejected' });
    render(<PasswordResetRequestsPanel />);
    expect(await screen.findByText('RST-123456')).toBeInTheDocument();

    const rejectBtn = screen.getByRole('button', { name: 'ปฏิเสธ' });
    await userEvent.click(rejectBtn);

    expect(await screen.findByText(/ปฏิเสธคำร้องรีเซ็ตรหัสผ่าน/)).toBeInTheDocument();

    const reasonInput = screen.getByTestId('reject-reason-input');
    await userEvent.type(reasonInput, 'เบอร์โทรศัพท์ติดต่อไม่ได้');

    const confirmRejectBtn = await screen.findByTestId('confirm-reject-btn');
    await userEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(decideResetRequest).toHaveBeenCalledWith('ER-001', {
        decision: 'reject',
        phoneVerified: false,
        reason: 'เบอร์โทรศัพท์ติดต่อไม่ได้',
      });
    });
  });

  it('shows empty state when there are no requests', async () => {
    getResetRequests.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 });
    render(<PasswordResetRequestsPanel />);
    expect(await screen.findByText(/ไม่พบคำร้องรีเซ็ตรหัสผ่าน/)).toBeInTheDocument();
  });

  it('handles API error on fetch', async () => {
    getResetRequests.mockRejectedValue(new Error('เกิดข้อผิดพลาดในการโหลด'));
    render(<PasswordResetRequestsPanel />);
    expect(await screen.findByText('เกิดข้อผิดพลาดในการโหลด')).toBeInTheDocument();
  });
});

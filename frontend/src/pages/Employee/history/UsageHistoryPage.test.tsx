import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UsageHistoryPage from './UsageHistoryPage';

const { activityLogs } = vi.hoisted(() => ({ activityLogs: vi.fn() }));

vi.mock('../../../api/managementApi', () => ({
  managementApi: { activityLogs },
}));

const log = (id: string, activityType: string, detail: string, date = '2026-09-10T05:48:06Z') => ({
  log_id: id,
  date,
  user_name: 'ผู้ใช้ ทดสอบ',
  user_code: 'US-001',
  activity_type: activityType,
  action_code: activityType,
  detail,
  target_id: 'US-001',
});

describe('UsageHistoryPage', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
    activityLogs.mockReset();
    activityLogs.mockImplementation(async (kind: 'staff' | 'user') => ({
      data: kind === 'staff'
        ? [
            log('staff-login', 'เข้าสู่ระบบ', 'พนักงานเข้าสู่ระบบ'),
            log('staff-promotion', 'สร้างโปรโมชั่น', 'สร้างโปรโมชั่นที่ไม่ใช่กิจกรรมบัญชี'),
          ]
        : [
            log('user-register', 'สร้างบัญชี', 'สร้างบัญชีลูกค้า'),
            log('user-booking', 'จองบัตร', 'จองบัตรที่ไม่ใช่กิจกรรมบัญชี'),
          ],
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows only account activity for both staff and customer tabs', async () => {
    render(<UsageHistoryPage />);

    expect(screen.getByRole('heading', { name: 'ประวัติกิจกรรมบัญชี' })).toBeInTheDocument();
    expect(await screen.findByText('พนักงานเข้าสู่ระบบ')).toBeInTheDocument();
    expect(screen.queryByText('สร้างโปรโมชั่นที่ไม่ใช่กิจกรรมบัญชี')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'ผู้ใช้งาน' }));

    expect(await screen.findByText('สร้างบัญชีลูกค้า')).toBeInTheDocument();
    expect(screen.queryByText('จองบัตรที่ไม่ใช่กิจกรรมบัญชี')).not.toBeInTheDocument();
    await waitFor(() => expect(activityLogs).toHaveBeenLastCalledWith('user', 'account'));
  });

  it('shows activity timestamps in Thailand time when the device uses UTC', async () => {
    activityLogs.mockResolvedValue({
      data: [log('thai-time', 'เข้าสู่ระบบ', 'เวลาไทย', '2026-09-10T01:18:13+07:00')],
    });

    render(<UsageHistoryPage />);

    expect(await screen.findByText('10/09/2569 01:18:13 น.')).toBeInTheDocument();
  });

  it('filters activity by the Thailand calendar date', async () => {
    activityLogs.mockResolvedValue({
      data: [log('thai-next-day', 'เข้าสู่ระบบ', 'กิจกรรมหลังเที่ยงคืนไทย', '2026-09-10T01:30:00+07:00')],
    });

    render(<UsageHistoryPage />);
    expect(await screen.findByText('กิจกรรมหลังเที่ยงคืนไทย')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('ช่วงเวลา'), { target: { value: '2026-09-10' } });
    fireEvent.click(screen.getByRole('button', { name: /ค้นหา/ }));

    expect(screen.getByText('กิจกรรมหลังเที่ยงคืนไทย')).toBeInTheDocument();
  });
});

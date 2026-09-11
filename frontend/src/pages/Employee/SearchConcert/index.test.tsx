import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveEmployeeSession } from '@/utils/employeeSession';
import ConcertSearchPage from './index';

const concertApiMock = vi.hoisted(() => ({
  getConcerts: vi.fn(),
  deleteConcert: vi.fn(),
}));

vi.mock('@/api/concertApi', () => ({ concertApi: concertApiMock }));

describe('ConcertSearchPage permissions', () => {
  beforeEach(() => {
    localStorage.clear();
    saveEmployeeSession({
      userId: 'SEED_EMP_010', employeeCode: 'OCT-EMP-010', firstName: 'ภาคภูมิ', lastName: 'รัตนชัย',
      name: 'ภาคภูมิ รัตนชัย', department: 'ฝ่ายการเงิน', role: 'view_only', jobRole: 'staff',
      email: 'phakphum.viewer@octavia.test', modulePermissions: { concerts: 'view' },
    });
    concertApiMock.getConcerts.mockResolvedValue([
      { concert_id: 'CC9', concert_name: 'Database Concert', start_date: '2026-09-11', end_date: '2026-09-11', start_time: '18:00', end_time: '20:00', location: 'Hall', status: 'วางแผน', artists: ['Artist'], poster_url: '/api/concerts/CC9/poster?v=1', updated_at: '2026-09-11T12:00:00Z' },
      { concert_id: 'CC0', concert_name: 'No Poster', start_date: '2026-09-11', end_date: '2026-09-11', start_time: '18:00', end_time: '20:00', location: 'Hall', status: 'วางแผน', artists: [], poster_url: '' },
    ]);
  });

  it('loads poster concerts from the API and hides mutation actions for view-only employees', async () => {
    render(<MemoryRouter><ConcertSearchPage /></MemoryRouter>);
    expect(await screen.findByText('Database Concert')).toBeInTheDocument();
    expect(screen.queryByText('No Poster')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/แก้ไข Database Concert/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ลบ Database Concert/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/เอกสาร Database Concert/i)).toBeInTheDocument();
  });
});

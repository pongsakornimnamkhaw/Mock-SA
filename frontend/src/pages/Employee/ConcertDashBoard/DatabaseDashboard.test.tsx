import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DatabaseDashboard';

const dashboardApiMock = vi.hoisted(() => ({ getDashboard: vi.fn() }));
vi.mock('@/api/dashboardApi', () => ({ dashboardApi: dashboardApiMock }));

describe('DatabaseDashboard', () => {
  beforeEach(() => {
    dashboardApiMock.getDashboard.mockResolvedValue({
      summary: { total_concerts: 7, concerts_this_month: 2, total_budget: 250000, incomplete_tasks: 3, responsible_people: 2 },
      featured_concerts: [{ concert_id: 'CC9', concert_name: 'Database Concert', start_date: '2026-09-11', end_date: '2026-09-12', start_time: '18:00', end_time: '22:00', location: 'Database Hall', status: 'ยืนยันแล้ว', poster_url: '/api/concerts/CC9/poster?v=1', updated_at: '2026-09-11T00:00:00Z' }],
      concert_statuses: [], responsibilities: [], recent_updates: [],
    });
  });

  it('renders dashboard values and poster returned by the backend', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText('Database Concert')).toBeInTheDocument();
    expect(screen.getByText('7 คอนเสิร์ต')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Database Concert' })).toHaveAttribute('src', '/api/concerts/CC9/poster?v=1');
  });

  it('renders ISO datetime values returned by PostgreSQL without crashing', async () => {
    dashboardApiMock.getDashboard.mockResolvedValueOnce({
      summary: { total_concerts: 1, concerts_this_month: 1, total_budget: 0, incomplete_tasks: 0, responsible_people: 0 },
      featured_concerts: [],
      concert_statuses: [{
        concert_id: 'CC10', concert_name: 'ISO Date Concert',
        start_date: '2026-09-11T00:00:00Z', end_date: '2026-09-12T00:00:00Z',
        start_time: '18:00', end_time: '22:00', location: 'Database Hall',
        status: 'ยืนยันแล้ว', poster_url: '', updated_at: '2026-09-11T00:00:00Z',
      }],
      responsibilities: [], recent_updates: [],
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText('ISO Date Concert')).toBeInTheDocument();
  });
});

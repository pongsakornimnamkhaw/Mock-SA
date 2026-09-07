import type { ConcertItem } from '../types/report';
import type { ScheduleItem, TimelineStep } from '../types/contact';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

interface ReportRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  status: ConcertItem['status'];
  last_update: string;
  poster_url: string;
  tickets_sold: number;
  ticket_revenue: number;
  zones: Array<{ zone: string; seats_sold: number; revenue: number }>;
}

const money = (value: number) => `${value.toLocaleString('th-TH')} บาท`;
const thaiDate = (value: string) => {
  const normalized = value?.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)?.[1];
  if (!normalized) return '-';
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    : '-';
};

const thaiTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '-';
};

export const reportApi = {
  async getConcerts(): Promise<ConcertItem[]> {
    const rows = await request<ReportRow[]>('/reports/concerts');
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      poster: row.poster_url,
      date: row.start_date === row.end_date ? thaiDate(row.start_date) : `${thaiDate(row.start_date)} - ${thaiDate(row.end_date)}`,
      revenue: money(row.ticket_revenue),
      ticketsSold: `${row.tickets_sold.toLocaleString('th-TH')} ใบ`,
      location: row.location,
      status: row.status,
      lastUpdate: thaiTimestamp(row.last_update),
      seatingSummary: row.zones.map((zone) => ({ zone: zone.zone, seatsSold: `${zone.seats_sold.toLocaleString('th-TH')} ที่นั่ง`, revenue: money(zone.revenue) })),
      totalTicketRevenue: money(row.ticket_revenue),
      sponsorSummary: [],
      totalSponsorRevenue: money(0),
    }));
  },
};

export interface WorkPlanResponse {
  concert_id: string;
  concert_name: string;
  schedule: ScheduleItem[];
  approval_status: string;
  timeline: TimelineStep[];
}

export const workPlanApi = {
  getCurrent: () => request<WorkPlanResponse>('/work-plans/current'),
  save: (concertId: string, schedule: ScheduleItem[]) => request<WorkPlanResponse>('/work-plans/current', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concert_id: concertId, schedule }),
  }),
  submit: (concertId: string, schedule: ScheduleItem[]) => request<WorkPlanResponse>('/work-plans/current/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concert_id: concertId, schedule }),
  }),
};

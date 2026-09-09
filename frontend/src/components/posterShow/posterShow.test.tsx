import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import EventList from '@/components/posterShow/posterShow';

const concert = (id: string, name: string, location: string): CustomerPromotionConcert => ({
    concert_id: id,
    concert_name: name,
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    start_time: '18:00:00',
    location,
    status: 'ยืนยันแล้ว',
});

const mockConcerts = (rows: CustomerPromotionConcert[]) => vi
    .spyOn(customerPromotionApi, 'listConcerts')
    .mockResolvedValue({ data: rows });

const renderList = (query = '') => render(
    <MemoryRouter>
        <EventList query={query} />
    </MemoryRouter>,
);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('EventList', () => {
    it('renders concerts loaded from the database', async () => {
        mockConcerts([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        renderList();

        expect(await screen.findByText('Riverside Sound Festival')).toBeInTheDocument();
        expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
    });

    it('links each card to that concert id so the booking flow keeps the real id', async () => {
        mockConcerts([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        renderList();

        const link = await screen.findByRole('link', { name: 'ดูรายละเอียด' });
        expect(link).toHaveAttribute('href', '/event/CC0001');
    });

    it('filters by concert name and location', async () => {
        mockConcerts([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        renderList('neon');

        expect(await screen.findByText('Neon Nights Vol.3')).toBeInTheDocument();
        expect(screen.queryByText('Riverside Sound Festival')).not.toBeInTheDocument();
    });

    it('tells the customer when a search matches nothing', async () => {
        mockConcerts([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        renderList('ไม่มีคอนเสิร์ตชื่อนี้');

        expect(await screen.findByText(/ไม่พบคอนเสิร์ต/)).toBeInTheDocument();
    });

    it('tells the customer when there is no concert on sale at all', async () => {
        mockConcerts([]);

        renderList();

        expect(await screen.findByText(/ยังไม่มีคอนเสิร์ตที่เปิดจำหน่าย/)).toBeInTheDocument();
    });

    it('shows the failure reason when the concert list cannot be loaded', async () => {
        vi.spyOn(customerPromotionApi, 'listConcerts').mockRejectedValue(
            new Error('เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่'),
        );

        renderList();

        expect(await screen.findByText('เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่')).toBeInTheDocument();
    });
});

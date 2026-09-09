import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { customerAccountApi, CustomerApiError } from '@/api/customerAccountApi';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import CustomerHeader from '@/components/common/CustomerHeader';

const concert = (id: string, name: string, location: string): CustomerPromotionConcert => ({
    concert_id: id,
    concert_name: name,
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    start_time: '18:00:00',
    location,
    status: 'ยืนยันแล้ว',
});

const renderHeader = (rows: CustomerPromotionConcert[]) => {
    // หัวเว็บตรวจเซสชันตอน mount ให้ตอบเหมือนยังไม่ได้ล็อกอิน จะได้ไม่ยิง fetch จริง
    vi.spyOn(customerAccountApi, 'getAccount').mockRejectedValue(new CustomerApiError('ยังไม่ได้เข้าสู่ระบบ', 401));
    vi.spyOn(customerPromotionApi, 'listConcerts').mockResolvedValue({ data: rows });
    render(
        <MemoryRouter>
            <CustomerHeader />
        </MemoryRouter>,
    );
};

const openSearch = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'ค้นหาคอนเสิร์ต' }));
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CustomerHeader search', () => {
    it('suggests concerts loaded from the database', async () => {
        renderHeader([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        await openSearch();

        expect(await screen.findByText('Riverside Sound Festival')).toBeInTheDocument();
        expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
    });

    it('no longer suggests the retired mock concerts', async () => {
        renderHeader([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        await openSearch();

        await screen.findByText('Riverside Sound Festival');
        expect(screen.queryByText('Neon Pulse')).not.toBeInTheDocument();
        expect(screen.queryByText('Starlight Festival')).not.toBeInTheDocument();
    });

    it('narrows the suggestions as the customer types', async () => {
        renderHeader([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        await openSearch();
        await screen.findByText('Riverside Sound Festival');
        await userEvent.type(screen.getByLabelText('ชื่อคอนเสิร์ต หรือสถานที่'), 'neon');

        expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
        expect(screen.queryByText('Riverside Sound Festival')).not.toBeInTheDocument();
    });

    it('says nothing matched when the query has no result', async () => {
        renderHeader([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        await openSearch();
        await screen.findByText('Riverside Sound Festival');
        await userEvent.type(screen.getByLabelText('ชื่อคอนเสิร์ต หรือสถานที่'), 'ไม่มีคอนเสิร์ตชื่อนี้');

        expect(screen.getByText('ไม่พบคอนเสิร์ตที่ค้นหา')).toBeInTheDocument();
    });
});

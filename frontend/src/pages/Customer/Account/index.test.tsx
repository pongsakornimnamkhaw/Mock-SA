import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';
import type { CustomerAccount } from '@/api/customerAccountApi';
import type { BookingRecord } from '@/types/booking';
import CustomerAccountPage from '@/pages/Customer/Account';

const account: CustomerAccount = {
    userId: 'U1', firstName: 'สมชาย', lastName: 'ใจดี', dateOfBirth: '1990-01-01',
    gender: 'ชาย', phone: '0800000000', address: '-', email: 'test@example.com',
};

const issuedBooking = (overrides: Partial<BookingRecord>): BookingRecord => ({
    id: 'BK-1', concertId: 'CC1', concertTitle: 'Riverside Sound Festival',
    zoneId: 'A1', tierName: 'โซน A', quantity: 1, unitPrice: 2000, totalPrice: 2000,
    customerName: 'สมชาย ใจดี', customerEmail: 'test@example.com',
    status: 'issued', createdAt: '2026-09-10T00:00:00Z',
    ...overrides,
});

const renderTicketsTab = (bookings: BookingRecord[]) => {
    vi.spyOn(customerAccountApi, 'getAccount').mockResolvedValue(account);
    vi.spyOn(customerPromotionApi, 'listConcerts').mockResolvedValue({ data: [] });
    vi.spyOn(bookingPaymentApi, 'getCustomerBookings').mockResolvedValue(bookings);
    render(
        <MemoryRouter>
            <CustomerAccountPage mode="tickets" />
        </MemoryRouter>,
    );
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CustomerAccountPage บัตรของฉัน', () => {
    it('ไม่โชว์ตั๋วปลอมเมื่อการจองไม่มีตั๋วจริงผูกอยู่', async () => {
        renderTicketsTab([issuedBooking({ tickets: [], seats: [] })]);

        await screen.findByText(/รหัสการจอง BK-1/);
        expect(screen.getByText(/ไม่มีข้อมูลตั๋วสำหรับรายการนี้/)).toBeInTheDocument();
        expect(screen.queryByText(/^TCK-/)).not.toBeInTheDocument();
    });

    it('แสดงเลขที่นั่งจริงจากตั๋วที่ backend ส่งมา', async () => {
        renderTicketsTab([issuedBooking({
            tickets: [{ code: 'TK-BK-1-A5', seatLabel: 'A5', issuedAt: '2026-09-10T00:00:00Z', qrCodeUrl: 'https://example.test/qr.png' }],
            seats: ['A5'],
        })]);

        await screen.findByText('ที่นั่ง A5');
        expect(screen.getByText('TK-BK-1-A5')).toBeInTheDocument();
    });
});

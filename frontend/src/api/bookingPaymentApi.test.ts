import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const bookingArgs = {
    concertId: 'CC1',
    concertTitle: 'งานทดสอบ',
    zoneId: 'A1',
    tierName: 'โซน A',
    seats: ['A1', 'A2'],
    quantity: 2,
    unitPrice: 2000,
    discountAmount: 0,
    totalPrice: 4000,
    customerName: 'ลูกค้า',
    customerEmail: 'test@example.com',
    customerPhone: '0800000000',
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('bookingPaymentApi.createBooking', () => {
    it('โยน error พร้อมข้อความจากเซิร์ฟเวอร์เมื่อที่นั่งถูกจองไปแล้ว (409)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(409, { error: 'ที่นั่งไม่ว่างแล้ว: A2', unavailable_seats: ['A2'] }),
        );

        await expect(bookingPaymentApi.createBooking(bookingArgs)).rejects.toThrow('ที่นั่งไม่ว่างแล้ว: A2');
    });

    it('ยังบันทึกลง local store ได้เมื่อต่อเซิร์ฟเวอร์ไม่ติด', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        const record = await bookingPaymentApi.createBooking(bookingArgs);

        expect(record.id).toBeTruthy();
        expect(record.quantity).toBe(2);
    });
});

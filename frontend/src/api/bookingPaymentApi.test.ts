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

describe('bookingPaymentApi.getCustomerBookings', () => {
    it('ไม่ปั้นตั๋วปลอมเมื่อ backend ไม่ส่ง tickets มา แม้สถานะเป็น issued', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{
                booking_id: 'BK-1', concert_id: 'CC1', concert_title: 'งานทดสอบ',
                zone_id: 'A1', tier_name: 'โซน A', quantity: 2, unit_price: 2000,
                discount_amount: 0, total_price: 4000, customer_name: 'ลูกค้า',
                customer_email: 'test@example.com', customer_phone: '0800000000',
                status: 'issued', booking_date: '2026-09-10', tickets: [],
            }],
        }));

        const [booking] = await bookingPaymentApi.getCustomerBookings('U1');

        expect(booking.tickets).toEqual([]);
    });

    it('แปลงตั๋วจริงจาก backend และเติม seats จาก seatLabel ของตั๋ว', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{
                booking_id: 'BK-2', concert_id: 'CC1', concert_title: 'งานทดสอบ',
                zone_id: 'A1', tier_name: 'โซน A', quantity: 2, unit_price: 2000,
                discount_amount: 0, total_price: 4000, customer_name: 'ลูกค้า',
                customer_email: 'test@example.com', customer_phone: '0800000000',
                status: 'issued', booking_date: '2026-09-10',
                tickets: [
                    { ticket_id: 'TK-BK-2-A1', name_concert: 'งานทดสอบ', seat_label: 'A1', status_ticket: 'พร้อมใช้งาน', ticket_datetime: '2026-09-10T00:00:00Z' },
                    { ticket_id: 'TK-BK-2-A2', name_concert: 'งานทดสอบ', seat_label: 'A2', status_ticket: 'พร้อมใช้งาน', ticket_datetime: '2026-09-10T00:00:00Z' },
                ],
            }],
        }));

        const [booking] = await bookingPaymentApi.getCustomerBookings('U1');

        expect(booking.tickets?.map((t) => t.code)).toEqual(['TK-BK-2-A1', 'TK-BK-2-A2']);
        expect(booking.seats).toEqual(['A1', 'A2']);
    });
});

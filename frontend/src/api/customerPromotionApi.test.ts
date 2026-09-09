import { afterEach, describe, expect, it, vi } from 'vitest';
import { customerPromotionApi } from '@/api/customerPromotionApi';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const params = {
    code: 'save15',
    concertId: '2',
    concertName: 'Riverside Sound Festival',
    zoneId: 'B4',
    zoneLabel: 'โซน B',
    total: 4500,
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('customerPromotionApi.redeem', () => {
    it('sends the order context as query parameters', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(200, { data: { promotion: { promotion_id: 'PROMO_1' }, discount_amount: 300 } }),
        );

        const result = await customerPromotionApi.redeem(params);

        expect(result.data.discount_amount).toBe(300);
        const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
        expect(requestedUrl.pathname).toBe('/api/customer/promotions/redeem');
        expect(requestedUrl.searchParams.get('code')).toBe('save15');
        expect(requestedUrl.searchParams.get('concert_id')).toBe('2');
        expect(requestedUrl.searchParams.get('concert_name')).toBe('Riverside Sound Festival');
        expect(requestedUrl.searchParams.get('zone_id')).toBe('B4');
        expect(requestedUrl.searchParams.get('zone_label')).toBe('โซน B');
        expect(requestedUrl.searchParams.get('total')).toBe('4500');
    });

    it('surfaces the backend rejection reason as an Error message', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(409, { error: 'ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท' }),
        );

        await expect(customerPromotionApi.redeem(params)).rejects.toThrow('ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท');
    });

    it('surfaces a not-found code', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(404, { error: 'ไม่พบรหัสโปรโมชั่นนี้ หรือโปรโมชั่นนี้ใช้งานไม่ได้แล้ว' }),
        );

        await expect(customerPromotionApi.redeem(params)).rejects.toThrow('ไม่พบรหัสโปรโมชั่นนี้');
    });
});

describe('customerPromotionApi.listConcerts', () => {
    it('requests the customer concert list endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(200, { data: [{ concert_id: 'CC0001', concert_name: 'Riverside Sound Festival' }] }),
        );

        const result = await customerPromotionApi.listConcerts();

        expect(result.data).toHaveLength(1);
        expect(result.data[0].concert_id).toBe('CC0001');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/customer/concerts');
    });

    it('surfaces a server failure as an Error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(500, { error: 'ไม่สามารถโหลดคอนเสิร์ตได้' }),
        );

        await expect(customerPromotionApi.listConcerts()).rejects.toThrow('ไม่สามารถโหลดคอนเสิร์ตได้');
    });
});

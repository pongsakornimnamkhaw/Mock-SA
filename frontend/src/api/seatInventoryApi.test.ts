import { afterEach, describe, expect, it, vi } from 'vitest';
import { seatInventoryApi } from '@/api/seatInventoryApi';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('seatInventoryApi', () => {
    it('แปลงโซนจาก snake_case ของ backend เป็น camelCase', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{ zone_id: 'A1', zone_type: 'นั่ง', category_name: 'โซน A', color: '#E53935', price: 2000, capacity: 40, available: 38 }],
        }));

        const zones = await seatInventoryApi.listZones('CC1');

        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/concerts/CC1/zones');
        expect(zones).toEqual([
            { zoneId: 'A1', zoneType: 'นั่ง', categoryName: 'โซน A', color: '#E53935', price: 2000, capacity: 40, available: 38 },
        ]);
    });

    it('แปลงที่นั่งและคงสถานะจาก backend ไว้', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{ seat_id: 'ST1', label: 'A1', seat_row: 'A', seat_column: '1', status: 'ไม่ว่าง', position_x: 1, position_y: 2 }],
        }));

        const seats = await seatInventoryApi.listSeats('CC1', 'A1');

        expect(seats).toEqual([
            { seatId: 'ST1', label: 'A1', row: 'A', column: '1', status: 'ไม่ว่าง', positionX: 1, positionY: 2 },
        ]);
    });

    it('โยน error พร้อมข้อความจาก backend เมื่อโหลดไม่สำเร็จ', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, { error: 'ไม่สามารถโหลดที่นั่งได้' }));

        await expect(seatInventoryApi.listSeats('CC1', 'A1')).rejects.toThrow('ไม่สามารถโหลดที่นั่งได้');
    });
});

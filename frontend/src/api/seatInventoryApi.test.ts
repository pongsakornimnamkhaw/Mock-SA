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

    it('ส่ง hold token ตอนโหลดที่นั่งและคง SeatID แบบตัวเลข', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{ seat_id: 12, label: 'A12', seat_row: 1, seat_column: 12, status: 'LOCKED', position_x: 30, position_y: 40 }],
        }));

        const seats = await seatInventoryApi.listSeats('CC1', 'ZA', 'hold-1');

        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/concerts/CC1/zones/ZA/seats?hold_token=hold-1');
        expect(seats[0]).toMatchObject({ seatId: 12, label: 'A12', status: 'LOCKED', positionX: 30, positionY: 40 });
    });

    it('โหลดผังจริงและสร้าง hold ด้วย SeatID', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(jsonResponse(200, {
                zones: [{ id: 'ZA', kind: 'zone', name: 'VIP', color: '#ff0000', zonePrice: 2500, seatItems: [] }],
                layoutObjects: [{ id: 'stage', kind: 'object', name: 'เวที', x: 50, y: 10, width: 30, height: 8, z: 1 }],
            }))
            .mockResolvedValueOnce(jsonResponse(201, { hold_token: 'token-1', expires_at: '2026-09-11T10:15:00Z' }));

        const layout = await seatInventoryApi.getLayout('CC1');
        const hold = await seatInventoryApi.createHold('CC1', 'ZA', [12, 13]);

        expect(layout.zones[0].zonePrice).toBe(2500);
        expect(layout.layoutObjects[0].name).toBe('เวที');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/ticket-planning/concerts/CC1/layout');
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ concert_id: 'CC1', zone_id: 'ZA', seat_ids: [12, 13] });
        expect(hold).toEqual({ holdToken: 'token-1', expiresAt: '2026-09-11T10:15:00Z' });
    });

    it('โยน error พร้อมข้อความจาก backend เมื่อโหลดไม่สำเร็จ', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, { error: 'ไม่สามารถโหลดที่นั่งได้' }));

        await expect(seatInventoryApi.listSeats('CC1', 'A1')).rejects.toThrow('ไม่สามารถโหลดที่นั่งได้');
    });
});

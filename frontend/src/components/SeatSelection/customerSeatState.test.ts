import { describe, expect, it } from 'vitest';
import { mergeSeatInventory, zoneDisplayState } from './customerSeatState';

describe('customer seat state', () => {
    it('คง selected เฉพาะเมื่อ backend ยังรายงานว่าว่าง', () => {
        const previous = [
            { seatId: 1, id: 'A1', row: '1', number: 1, status: 'selected' as const, x: 10, y: 20 },
            { seatId: 2, id: 'A2', row: '1', number: 2, status: 'selected' as const, x: 30, y: 20 },
        ];
        const incoming = [
            { seatId: 1, label: 'A1', row: 1, column: 1, status: 'ว่าง', positionX: 10, positionY: 20 },
            { seatId: 2, label: 'A2', row: 1, column: 2, status: 'HELD', positionX: 30, positionY: 20 },
        ];

        expect(mergeSeatInventory(incoming, previous).map((seat) => seat.status)).toEqual(['selected', 'held']);
    });

    it('แยก locked reserved และ disabled เป็นสถานะที่กดไม่ได้', () => {
        const incoming = [
            { seatId: 1, label: 'A1', row: 1, column: 1, status: 'LOCKED', positionX: 10, positionY: 20 },
            { seatId: 2, label: 'A2', row: 1, column: 2, status: 'ไม่ว่าง', positionX: 30, positionY: 20 },
            { seatId: 3, label: 'A3', row: 1, column: 3, status: 'DISABLED', positionX: 50, positionY: 20 },
        ];

        expect(mergeSeatInventory(incoming, []).map((seat) => seat.status)).toEqual(['locked', 'reserved', 'disabled']);
    });

    it('ทำโซนหม่นเมื่อเต็มหรือไม่มีที่นั่ง', () => {
        expect(zoneDisplayState({ capacity: 10, available: 0 })).toEqual({ disabled: true, label: 'เต็ม' });
        expect(zoneDisplayState({ capacity: 0, available: 0 })).toEqual({ disabled: true, label: 'ยังไม่มีที่นั่ง' });
        expect(zoneDisplayState({ capacity: 10, available: 3 })).toEqual({ disabled: false, label: 'เหลือ 3 ที่นั่ง' });
    });
});

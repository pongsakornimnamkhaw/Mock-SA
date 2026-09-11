import type { SeatInventory } from '@/api/seatInventoryApi';
import type { SeatData, SeatStatus } from './types';

const backendSeatStatus = (status: string): SeatStatus => {
    if (status === 'LOCKED') return 'locked';
    if (status === 'HELD') return 'held';
    if (status === 'DISABLED') return 'disabled';
    if (status === 'ว่าง') return 'available';
    return 'reserved';
};

export const mergeSeatInventory = (incoming: SeatInventory[], previous: SeatData[]): SeatData[] => {
    const previousByID = new Map(previous.map((seat) => [seat.seatId, seat]));
    return incoming.map((seat) => {
        const backendStatus = backendSeatStatus(seat.status);
        const old = previousByID.get(seat.seatId);
        const status = backendStatus === 'available' && old?.status === 'selected' ? 'selected' : backendStatus;
        return {
            seatId: seat.seatId,
            id: seat.label,
            row: String(seat.row),
            number: Number(seat.column) || 0,
            status,
            x: seat.positionX,
            y: seat.positionY,
        };
    });
};

export const zoneDisplayState = ({ capacity, available }: { capacity: number; available: number }) => {
    if (capacity <= 0) return { disabled: true, label: 'ยังไม่มีที่นั่ง' };
    if (available <= 0) return { disabled: true, label: 'เต็ม' };
    return { disabled: false, label: `เหลือ ${available.toLocaleString('th-TH')} ที่นั่ง` };
};

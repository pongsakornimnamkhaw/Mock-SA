import { pulse, flux, celestial, starlight } from '@/assets/poster';
import type { EventData, ZoneInfo, SeatData } from './types';

// ข้อมูลคอนเสิร์ต (Mock)
export const eventsMap: Record<string, EventData> = {
    '1': { title: 'Neon Flux Festival 2024', image: flux, eventDate: 'วันที่ 16-18 สิงหาคม 2024', location: 'สยามพารากอน, กรุงเทพมหานคร', openTime: '17:00 น.', prices: '฿3,500 / 2,500 / 1,800 / 1,200' },
    '2': { title: 'Neon Pulse', image: pulse, eventDate: 'วันที่ 28 ตุลาคม 2026', location: 'The Mall Korat, นครราชสีมา', openTime: '18:30 น.', prices: '฿2,500 / 2,000 / 1,500' },
    '3': { title: 'Celestial Sounds', image: celestial, eventDate: 'วันที่ 26 ตุลาคม 2024', location: 'ลานเฉลิมพระเกียรติ, เชียงใหม่', openTime: '18:00 น.', prices: '฿2,800 / 2,200 / 1,600 / 1,000' },
    '4': { title: 'Starlight Festival', image: starlight, eventDate: 'วันที่ 23-25 สิงหาคม 2024', location: 'ขอนแก่น ฮอลล์, ขอนแก่น', openTime: '17:30 น.', prices: '฿3,000 / 2,200 / 1,500' },
};

// ข้อมูลราคาตามโซน
export const zonePriceMap: Record<string, ZoneInfo> = {
    A1: { price: 2000, color: '#E53935', label: 'โซน A' },
    A2: { price: 2000, color: '#E53935', label: 'โซน A' },
    B1: { price: 1500, color: '#43A047', label: 'โซน B' },
    B2: { price: 1500, color: '#43A047', label: 'โซน B' },
    B3: { price: 1500, color: '#43A047', label: 'โซน B' },
    B4: { price: 1500, color: '#43A047', label: 'โซน B' },
    C1: { price: 1000, color: '#FDD835', label: 'โซน C' },
    C2: { price: 1000, color: '#FDD835', label: 'โซน C' },
    C3: { price: 1000, color: '#FDD835', label: 'โซน C' },
    C4: { price: 1000, color: '#FDD835', label: 'โซน C' },
};

// เวลา Lock ชั่วคราว (วินาที) — ตั้ง 15 นาที (900 วินาที)
export const LOCK_DURATION = 900;

export const STEPS = ['เลือกโซนบัตร', 'เลือกที่นั่ง', 'ชำระเงิน'];

// สร้างที่นั่งจำลอง 5 แถว x 8 ที่นั่ง
export const generateSeats = (): SeatData[] => {
    const rows = ['A', 'B', 'C', 'D', 'E'];
    const seats: SeatData[] = [];
    const reservedSeats = new Set(['A3', 'A4', 'B2', 'B5', 'B7', 'C1', 'C6', 'D4', 'D8', 'E2', 'E3', 'E7']);

    rows.forEach((row) => {
        for (let i = 1; i <= 8; i++) {
            const seatId = `${row}${i}`;
            seats.push({
                id: seatId,
                row: row,
                number: i,
                status: reservedSeats.has(seatId) ? 'reserved' : 'available',
            });
        }
    });
    return seats;
};

// ========== Format เวลา mm:ss ==========
export const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export type SeatStatus = 'available' | 'reserved' | 'selected' | 'locked' | 'held' | 'disabled';

export interface SeatData {
    seatId: number;
    id: string;
    row: string;
    number: number;
    status: SeatStatus;
    x: number;
    y: number;
}

export interface EventData {
    title: string;
    image: string;
    eventDate: string;
    location?: string;
    openTime?: string;
    prices?: string;
}

export interface ZoneInfo {
    price: number;
    color: string;
    label: string;
}

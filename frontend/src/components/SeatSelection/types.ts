export type SeatStatus = 'available' | 'reserved' | 'selected' | 'locked';

export interface SeatData {
    id: string;
    row: string;
    number: number;
    status: SeatStatus;
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

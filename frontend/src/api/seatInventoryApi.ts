export type ZoneInventory = {
    zoneId: string;
    zoneType: string;
    categoryName: string;
    color: string;
    price: number;
    capacity: number;
    available: number;
};

export type SeatInventory = {
    seatId: number;
    label: string;
    row: number;
    column: number;
    status: string;
    positionX: number;
    positionY: number;
};

export type PlanningSeat = {
    id?: number;
    clientKey?: string;
    name: string;
    x: number;
    y: number;
    rotation?: number;
    disabled: boolean;
};

export type PlanningZone = {
    id: string;
    kind: string;
    name: string;
    color: string;
    seats: number;
    seatItems: PlanningSeat[];
    zonePrice: number;
    type: string;
    shape: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    z: number;
};

export type PlanningLayoutObject = {
    id: string;
    kind: string;
    shape: string;
    name: string;
    color: string;
    textColor?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    z: number;
    imageSrc?: string;
    fontSize?: number;
};

export type PlanningLayout = {
    zones: PlanningZone[];
    layoutObjects: PlanningLayoutObject[];
};

export class SeatHoldConflictError extends Error {
    unavailableSeats: string[];

    constructor(message: string, unavailableSeats: string[] = []) {
        super(message);
        this.name = 'SeatHoldConflictError';
        this.unavailableSeats = unavailableSeats;
    }
}

type ZoneWire = {
    zone_id: string;
    zone_type: string;
    category_name: string;
    color: string;
    price: number;
    capacity: number;
    available: number;
};

type SeatWire = {
    seat_id: number;
    label: string;
    seat_row: number;
    seat_column: number;
    status: string;
    position_x: number;
    position_y: number;
};

const readJson = async (response: Response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body?.error || 'ไม่สามารถโหลดข้อมูลที่นั่งได้');
    }
    return body;
};

export const seatInventoryApi = {
    async getLayout(concertId: string): Promise<PlanningLayout> {
        const response = await fetch(`/api/ticket-planning/concerts/${encodeURIComponent(concertId)}/layout`);
        const body = await readJson(response);
        return {
            zones: Array.isArray(body.zones) ? body.zones : [],
            layoutObjects: Array.isArray(body.layoutObjects) ? body.layoutObjects : [],
        };
    },

    async listZones(concertId: string): Promise<ZoneInventory[]> {
        const response = await fetch(`/api/concerts/${encodeURIComponent(concertId)}/zones`);
        const body = await readJson(response);
        return (body.data as ZoneWire[] ?? []).map((zone) => ({
            zoneId: zone.zone_id,
            zoneType: zone.zone_type,
            categoryName: zone.category_name,
            color: zone.color,
            price: zone.price,
            capacity: zone.capacity,
            available: zone.available,
        }));
    },

    async listSeats(concertId: string, zoneId: string, holdToken?: string): Promise<SeatInventory[]> {
        const query = holdToken ? `?hold_token=${encodeURIComponent(holdToken)}` : '';
        const response = await fetch(
            `/api/concerts/${encodeURIComponent(concertId)}/zones/${encodeURIComponent(zoneId)}/seats${query}`,
        );
        const body = await readJson(response);
        return (body.data as SeatWire[] ?? []).map((seat) => ({
            seatId: seat.seat_id,
            label: seat.label,
            row: seat.seat_row,
            column: seat.seat_column,
            status: seat.status,
            positionX: seat.position_x,
            positionY: seat.position_y,
        }));
    },

    async createHold(concertId: string, zoneId: string, seatIds: number[]): Promise<{ holdToken: string; expiresAt: string }> {
        const response = await fetch('/api/seat-holds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concert_id: concertId, zone_id: zoneId, seat_ids: seatIds }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new SeatHoldConflictError(body?.error || 'ไม่สามารถล็อกที่นั่งได้', body?.unavailable_seats ?? []);
        }
        return { holdToken: body.hold_token, expiresAt: body.expires_at };
    },

    async releaseHold(holdToken: string): Promise<void> {
        if (!holdToken) return;
        const response = await fetch(`/api/seat-holds/${encodeURIComponent(holdToken)}`, { method: 'DELETE' });
        await readJson(response);
    },
};

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
    seatId: string;
    label: string;
    row: string;
    column: string;
    status: string;
    positionX: number;
    positionY: number;
};

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
    seat_id: string;
    label: string;
    seat_row: string;
    seat_column: string;
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

    async listSeats(concertId: string, zoneId: string): Promise<SeatInventory[]> {
        const response = await fetch(
            `/api/concerts/${encodeURIComponent(concertId)}/zones/${encodeURIComponent(zoneId)}/seats`,
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
};

import type { Zone } from '@/interface/IZoneInterface'

export const ARENA_CENTER = { x: 200, y: 130 }

function buildRing(
  prefix: string,
  tierName: string,
  capacity: number,
  count: number,
  innerRadius: number,
  outerRadius: number,
  fullIndices: number[],
): Zone[] {
  const step = 180 / count
  const zones: Zone[] = []
  for (let i = 0; i < count; i++) {
    const segmentNumber = count - i
    const startAngle = i * step
    const endAngle = startAngle + step
    zones.push({
      id: `${prefix}${segmentNumber}`,
      tierName,
      capacity,
      booked: fullIndices.includes(i) ? capacity : 0,
      shape: { kind: 'arc', startAngle, endAngle, innerRadius, outerRadius },
    })
  }
  return zones
}

// C8 ถูกจองไปแล้วบางส่วน (เหลือ 2 ใบ) ไว้ทดสอบเพดานจำนวนบัตรที่ถูกจำกัดด้วยที่ว่างจริง
const PARTIALLY_BOOKED: Record<string, number> = { C8: 8 }

const RAW_NEON_FLUX_ZONES: Zone[] = [
  {
    id: 'A1',
    tierName: 'VIP',
    capacity: 20,
    booked: 0,
    shape: { kind: 'rect', x: 110, y: 60, width: 70, height: 55 },
  },
  {
    id: 'A2',
    tierName: 'VIP',
    capacity: 20,
    booked: 20,
    shape: { kind: 'rect', x: 220, y: 60, width: 70, height: 55 },
  },
  ...buildRing('B', 'Standard', 15, 6, 95, 145, [2]),
  ...buildRing('C', 'Economy', 10, 8, 150, 195, [4]),
]

const NEON_FLUX_ZONES: Zone[] = RAW_NEON_FLUX_ZONES.map((zone) => ({
  ...zone,
  booked: PARTIALLY_BOOKED[zone.id] ?? zone.booked,
}))

const ZONE_MAPS: Record<string, Zone[]> = {
  'neon-flux': NEON_FLUX_ZONES,
}

export function getZoneMap(concertId: string): Zone[] {
  return ZONE_MAPS[concertId] ?? []
}

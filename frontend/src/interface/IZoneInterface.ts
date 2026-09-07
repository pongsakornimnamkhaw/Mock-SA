export type ZoneShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'arc'; startAngle: number; endAngle: number; innerRadius: number; outerRadius: number }

export interface Zone {
  id: string
  tierName: string
  capacity: number
  booked: number
  shape: ZoneShape
}

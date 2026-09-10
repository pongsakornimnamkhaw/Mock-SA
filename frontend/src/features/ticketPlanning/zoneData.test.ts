import { describe, expect, it } from 'vitest'
import { normalizeZoneForEditor, seatKey } from './zoneData'

describe('ticket planning zone transport', () => {
  it('normalizes the persisted zone price and separates client seat keys from numeric IDs', () => {
    const zone = normalizeZoneForEditor({
      id: 'zone-a',
      price: 900,
      seatItems: [
        { id: 12, name: 'A12' },
        { id: 'seat-local-1', name: 'A13' },
      ],
    })

    expect(zone.zonePrice).toBe(900)
    expect(zone.seatItems[0]).toMatchObject({ id: 12, clientKey: 'seat-12' })
    expect(zone.seatItems[1]).toMatchObject({ id: undefined, clientKey: 'seat-local-1' })
    expect(seatKey(zone.seatItems[0])).toBe('seat-12')
    expect(seatKey(zone.seatItems[1])).toBe('seat-local-1')
  })
})

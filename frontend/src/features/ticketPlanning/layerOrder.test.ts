import { describe, expect, it } from 'vitest'

import { nextLayerOrder } from './layerOrder'

describe('nextLayerOrder', () => {
  it('uses a compact database-safe sequence instead of timestamps', () => {
    expect(nextLayerOrder([{ z: 0 }, { z: 5 }, { z: '3' }])).toBe(6)
    expect(nextLayerOrder([])).toBe(1)
    expect(nextLayerOrder([{ z: Date.now() }])).toBeLessThanOrEqual(2147483647)
  })
})

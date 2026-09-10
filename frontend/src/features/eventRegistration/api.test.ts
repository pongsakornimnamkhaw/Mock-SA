import { afterEach, describe, expect, it, vi } from 'vitest'
import { registrationApi } from './api'

afterEach(() => vi.restoreAllMocks())

describe('event registration API routing', () => {
  it('loads concerts from the new ticket-planning module', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    await registrationApi.listConcerts()

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/ticket-planning/concerts')
  })
})

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

  it('scopes ticket lookup and check-in to the selected concert', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    await registrationApi.lookupTicket('TK-1', 'concert-a')
    await registrationApi.checkIn('TK-1', 2, 'concert-a')

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/event-registration/tickets/TK-1?concertId=concert-a',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      ticketId: 'TK-1',
      gateId: 2,
      concertId: 'concert-a',
    })
  })
})

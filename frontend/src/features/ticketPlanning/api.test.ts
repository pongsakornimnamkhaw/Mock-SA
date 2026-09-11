import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearConcertLayout, saveConcertPlan, saveTicketDesign } from './api'

afterEach(() => vi.restoreAllMocks())

describe('ticket planning API writes', () => {
  it('rejects when a save fails instead of reporting success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))

    await expect(saveConcertPlan({ id: 'concert-1' })).rejects.toThrow('500')
  })

  it('sends clear-layout confirmation to the backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await clearConcertLayout('concert-1')

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/ticket-planning/concerts/concert-1/layout')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
  })

  it('saves ticket objects through the dedicated ticket-design endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"objects":[]}', { status: 200 }))

    await saveTicketDesign('concert-1', [{ id: 'ticket-title' }])

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/ticket-planning/concerts/concert-1/ticket-design')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ objects: [{ id: 'ticket-title' }] }),
    })
  })
})

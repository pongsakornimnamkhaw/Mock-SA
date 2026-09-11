import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import ZoneSelectionPage from './index'

const mocks = vi.hoisted(() => ({
  getConcert: vi.fn(),
  getLayout: vi.fn(),
  listZones: vi.fn(),
}))

vi.mock('@/api/customerPromotionApi', () => ({
  customerPromotionApi: { getConcert: mocks.getConcert },
}))

vi.mock('@/api/seatInventoryApi', () => ({
  seatInventoryApi: { getLayout: mocks.getLayout, listZones: mocks.listZones },
}))

describe('customer zone selection concert poster', () => {
  it('uses the poster asset when the concerts table has no poster bytes', async () => {
    mocks.getConcert.mockResolvedValue({ data: {
      concert_id: 'CC0002',
      concert_name: 'Neon Nights Vol.3',
      start_date: '2026-11-16',
      end_date: '2026-11-18',
      start_time: '18:00:00',
      location: 'MCC Hall',
      status: 'เลื่อนการจัด',
      poster_data: '',
    } })
    mocks.getLayout.mockResolvedValue({ zones: [], layoutObjects: [] })
    mocks.listZones.mockResolvedValue([])

    render(<MemoryRouter initialEntries={['/event/CC0002/zones']}><Routes><Route path="/event/:id/zones" element={<ZoneSelectionPage />} /></Routes></MemoryRouter>)

    const poster = await screen.findByRole('img', { name: 'Neon Nights Vol.3' })
    expect(poster).toHaveAttribute('src', expect.stringContaining('/src/assets/poster/flux.png'))
  })
})

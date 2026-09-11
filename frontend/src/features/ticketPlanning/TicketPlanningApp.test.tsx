import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TicketPlanningApp from './TicketPlanningApp'

const loadConcerts = vi.fn()

vi.mock('./api', () => ({
  clearConcertLayout: vi.fn(),
  loadConcerts: (...args: unknown[]) => loadConcerts(...args),
  saveConcertLayout: vi.fn(),
  saveConcertPlan: vi.fn(),
  saveTicketDesign: vi.fn(),
}))

const concert = (layoutObjects: object[] = []) => ({
  id: 'concert-layout-test',
  name: 'Layout Test Concert',
  artist: 'Test Artist',
  date: '2026-09-11',
  endDate: '',
  location: 'Test Hall',
  category: 'Concert',
  status: 'ฉบับร่าง',
  description: '',
  cover: '',
  rounds: [],
  publishing: {},
  zones: [],
  layoutObjects,
  ticketLayoutObjects: [],
})

const openOverview = async () => {
  const user = userEvent.setup()
  const selectButton = await screen.findByRole('button', { name: 'เลือกเพื่อวางแผน' })
  await user.click(selectButton)
  return screen.getByRole('heading', { name: 'แผนผังที่นั่งในสถานที่' }).closest('section')!
}

describe('ticket planning overview layout', () => {
  beforeEach(() => {
    localStorage.clear()
    loadConcerts.mockReset()
  })

  it('does not invent a stage when the saved layout is empty', async () => {
    loadConcerts.mockResolvedValue([concert()])
    render(<TicketPlanningApp />)

    const mapCard = await openOverview()

    expect(within(mapCard).queryByText('เวที')).not.toBeInTheDocument()
    expect(within(mapCard).getByText('ผังยังว่างอยู่')).toBeInTheDocument()
  })

  it('renders a saved layout object with its stored geometry and layer order', async () => {
    loadConcerts.mockResolvedValue([concert([{
      id: 'main-stage',
      kind: 'object',
      name: 'เวทีหลัก',
      shape: 'rectangle',
      color: '#123456',
      textColor: '#fedcba',
      x: 31,
      y: 17,
      width: 44,
      height: 9,
      rotation: 12,
      z: 7,
    }])])
    render(<TicketPlanningApp />)

    const mapCard = await openOverview()
    const stage = within(mapCard).getByText('เวทีหลัก')
    const node = stage.closest('.overview-layout-node')
    const item = stage.closest('.overview-layout-item')

    await waitFor(() => expect(node).toHaveStyle({
      left: '31%',
      top: '17%',
      width: '44%',
      height: '9%',
      transform: 'translate(-50%,-50%) rotate(12deg)',
      zIndex: '1',
    }))
    expect(item).toHaveStyle({ background: '#123456', color: '#fedcba' })
  })

  it('shows an empty concert list when the concerts API returns an empty table', async () => {
    loadConcerts.mockResolvedValue([])
    render(<TicketPlanningApp />)

    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'เลือกเพื่อวางแผน' })).toHaveLength(0))
    expect(screen.getByText('ไม่มีข้อมูล')).toBeInTheDocument()
  })
})

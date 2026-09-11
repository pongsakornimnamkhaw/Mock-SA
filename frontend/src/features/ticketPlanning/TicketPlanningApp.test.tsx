import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TicketPlanningApp, { avoidSeatCollision } from './TicketPlanningApp'

const loadConcerts = vi.fn()
const saveTicketDesign = vi.fn()

vi.mock('./api', () => ({
  clearConcertLayout: vi.fn(),
  loadConcerts: (...args: unknown[]) => loadConcerts(...args),
  saveConcertLayout: vi.fn(),
  saveConcertPlan: vi.fn(),
  saveTicketDesign: (...args: unknown[]) => saveTicketDesign(...args),
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
    saveTicketDesign.mockReset()
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

  it('does not offer creating a concert from ticket planning', async () => {
    loadConcerts.mockResolvedValue([concert()])
    render(<TicketPlanningApp />)

    await screen.findByRole('button', { name: 'เลือกเพื่อวางแผน' })
    expect(screen.queryByRole('button', { name: /เพิ่มรายการคอนเสิร์ต/ })).not.toBeInTheDocument()
  })

  it('keeps triangle seats inside the pink outline without overlap', async () => {
    loadConcerts.mockResolvedValue([concert()])
    render(<TicketPlanningApp />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'เลือกเพื่อวางแผน' }))
    await user.click(screen.getByRole('button', { name: /ออกแบบผังและที่นั่ง/ }))
    await user.click(screen.getByTitle('สร้างโซนสี่เหลี่ยม'))
    await user.type(screen.getByLabelText(/ชื่อโซน/), 'โซนทดสอบ')
    await user.click(screen.getByRole('button', { name: 'สร้างโซน' }))

    fireEvent.doubleClick(screen.getByText('โซนทดสอบ'))
    const addCount = document.querySelector('.add-seat-control input') as HTMLInputElement
    await user.clear(addCount)
    await user.type(addCount, '4')
    await user.click(screen.getByRole('button', { name: /เพิ่มเก้าอี้/ }))

    const canvas = document.querySelector('.free-seat-canvas') as HTMLElement
    await user.click(screen.getByRole('button', { name: 'สามเหลี่ยม' }))
    expect(within(canvas).getByTestId('triangle-zone-outline')).toHaveAttribute('stroke', '#e72d70')
    expect(within(canvas).getByTestId('triangle-zone-outline')).toHaveAttribute('fill', 'none')

    const expectInsideTriangle = (seat: HTMLElement) => {
      const x = Number.parseFloat(seat.style.left)
      const y = Number.parseFloat(seat.style.top)
      const halfSpan = ((y - 1.5) / 97) * 48.5
      expect(y).toBeGreaterThanOrEqual(7)
      expect(y).toBeLessThanOrEqual(93)
      expect(x).toBeGreaterThanOrEqual(50 - halfSpan + 3)
      expect(x).toBeLessThanOrEqual(50 + halfSpan - 3)
    }
    within(canvas).getAllByRole('button').forEach(expectInsideTriangle)

    await user.clear(addCount)
    await user.type(addCount, '3')
    await user.click(screen.getByRole('button', { name: /เพิ่มเก้าอี้/ }))
    const allSeatStyles = within(canvas).getAllByRole('button').map(seat => seat.getAttribute('style'))
    expect(new Set(allSeatStyles).size).toBe(allSeatStyles.length)
    within(canvas).getAllByRole('button').forEach(expectInsideTriangle)

    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) })
    const [firstSeat, secondSeat] = within(canvas).getAllByRole('button')
    fireEvent.pointerDown(firstSeat, { clientX: 500, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 500, clientY: 0 })
    fireEvent.pointerUp(window)
    fireEvent.pointerDown(secondSeat, { clientX: 500, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 500, clientY: 0 })
    fireEvent.pointerUp(window)

    const afterDragging = within(canvas).getAllByRole('button').map(seat => seat.getAttribute('style'))
    expect(new Set(afterDragging).size).toBe(afterDragging.length)
  })

  it('requires a QR object before saving a ticket design and inserts named placeholders', async () => {
    loadConcerts.mockResolvedValue([concert()])
    render(<TicketPlanningApp />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'เลือกเพื่อวางแผน' }))
    await user.click(screen.getByRole('button', { name: 'ออกแบบบัตร' }))
    fireEvent.pointerDown(document.querySelector('.ticket-object.qr')!)
    await user.click(screen.getByRole('button', { name: /ลบวัตถุ/ }))
    await user.click(screen.getByRole('button', { name: '{ชื่อคอนเสิร์ต}' }))

    expect(document.querySelector('.ticket-canvas')).toHaveTextContent('{ชื่อคอนเสิร์ต}')
    await user.click(screen.getByRole('button', { name: /บันทึกแบบบัตร/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาวาง QR Code')
    expect(saveTicketDesign).not.toHaveBeenCalled()
  })
})

describe('triangle seat dragging', () => {
  it('keeps the previous position when another seat occupies the destination', () => {
    const current = { id: 1, name: 'A1', x: 35, y: 50 }
    const seats = [current, { id: 2, name: 'A2', x: 50, y: 7 }]

    expect(avoidSeatCollision({ x: 50, y: 7 }, current, seats)).toEqual({ x: 35, y: 50 })
  })
})

import type { BookingRecord } from '@/interface/IBookingInterface'

const STORAGE_KEY = 'octavia.bookings.v1'

const SEED_BOOKINGS: BookingRecord[] = [
  {
    id: 'BK-1001',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'B3',
    tierName: 'Standard',
    quantity: 2,
    totalPrice: 7000,
    customerName: 'สมชาย ใจดี',
    status: 'paid',
    createdAt: '2024-01-05T10:15:00.000Z',
  },
  {
    id: 'BK-1002',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'C6',
    tierName: 'Economy',
    quantity: 1,
    totalPrice: 2000,
    customerName: 'สุดา รักดี',
    status: 'pending_payment',
    createdAt: '2024-01-06T14:30:00.000Z',
  },
  {
    id: 'BK-1003',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'A1',
    tierName: 'VIP',
    quantity: 3,
    totalPrice: 15000,
    customerName: 'ปรีชา มั่นคง',
    status: 'cancelled',
    createdAt: '2024-01-07T09:05:00.000Z',
  },
]

let cache: BookingRecord[] = SEED_BOOKINGS
let loaded = false
let loadError: string | null = null
let lastUpdatedAt = new Date().toISOString()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function writeToStorage(next: BookingRecord[]) {
  cache = next
  lastUpdatedAt = new Date().toISOString()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    loadError = null
  } catch {
    loadError = 'บันทึกข้อมูลการจองลงเครื่องไม่สำเร็จ'
  }
}

// เรียกได้จากทั้งตอน render (ผ่าน getSnapshot) จึงห้าม emit ในนี้ ไม่งั้น React จะวนรอบ
function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      writeToStorage(SEED_BOOKINGS)
      return
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('unexpected shape')
    cache = parsed as BookingRecord[]
    loadError = null
  } catch {
    loadError = 'อ่านข้อมูลการจองล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลชุดก่อนหน้า'
  }
  lastUpdatedAt = new Date().toISOString()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    loaded = false
    load()
    emit()
  })
}

export function subscribeBookings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getBookingsSnapshot(): BookingRecord[] {
  load()
  return cache
}

export function getLastUpdatedAt(): string {
  load()
  return lastUpdatedAt
}

export function getLoadError(): string | null {
  load()
  return loadError
}

export function addBooking(
  input: Omit<BookingRecord, 'id' | 'createdAt' | 'status'>,
): BookingRecord {
  load()
  const record: BookingRecord = {
    ...input,
    id: `BK-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    status: 'pending_payment',
  }
  writeToStorage([...cache, record])
  emit()
  return record
}

export function countSeatsForZone(
  bookings: BookingRecord[],
  concertId: string,
  zoneId: string,
): number {
  return bookings
    .filter((b) => b.concertId === concertId && b.zoneId === zoneId && b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.quantity, 0)
}

export function countSeatsForConcert(bookings: BookingRecord[], concertId: string): number {
  return bookings
    .filter((b) => b.concertId === concertId && b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.quantity, 0)
}

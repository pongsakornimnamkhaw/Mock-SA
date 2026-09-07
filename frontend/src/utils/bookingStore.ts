import type { BookingRecord, PaymentEvidence, Ticket } from '@/types/booking'
import { buildQrCodeUrl, buildSeatLabel, buildTicketCode } from '@/utils/ticketCode'

const STORAGE_KEY = 'octavia.bookings.v2'

const SEED_BOOKINGS: BookingRecord[] = [
  {
    id: 'BK-1001',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    eventDate: '16-18 ม.ค. 2024',
    location: 'Metroplex Arena, กรุงเทพมหานคร',
    zoneId: 'A1',
    tierName: 'VIP',
    seats: ['A1-01', 'A1-02'],
    quantity: 2,
    unitPrice: 5000,
    discountAmount: 1000,
    totalPrice: 9000,
    customerName: 'สมชาย ใจดี',
    customerEmail: 'somchai.j@example.com',
    customerPhone: '0812345678',
    status: 'issued',
    createdAt: '2024-01-05T10:15:00.000Z',
    payment: {
      evidenceFileName: 'slip_somchai_9000.png',
      submittedAt: '2024-01-05T10:20:00.000Z',
      verifiedBy: 'เจ้าหน้าที่ฝ่ายขาย (สมศรี วงศ์สว่าง)',
      verifiedAt: '2024-01-05T10:30:00.000Z',
    },
    tickets: [
      {
        code: 'TKT-BK1001-01',
        seatLabel: 'A1-01',
        issuedAt: '2024-01-05T10:30:00.000Z',
        qrCodeUrl: buildQrCodeUrl('TKT-BK1001-01'),
      },
      {
        code: 'TKT-BK1001-02',
        seatLabel: 'A1-02',
        issuedAt: '2024-01-05T10:30:00.000Z',
        qrCodeUrl: buildQrCodeUrl('TKT-BK1001-02'),
      },
    ],
  },
  {
    id: 'BK-1002',
    concertId: 'neon-pulse',
    concertTitle: 'Neon Pulse',
    eventDate: '28 ก.พ. 2024',
    location: 'The Mall Korat, นครราชสีมา',
    zoneId: 'B2',
    tierName: 'Standard',
    seats: ['B2-05'],
    quantity: 1,
    unitPrice: 2000,
    discountAmount: 0,
    totalPrice: 2000,
    customerName: 'สุดา รักดี',
    customerEmail: 'suda.r@example.com',
    customerPhone: '0898765432',
    status: 'under_review',
    createdAt: '2024-02-01T14:30:00.000Z',
    payment: {
      evidenceFileName: 'transfer_slip_2000.jpg',
      submittedAt: '2024-02-01T14:35:00.000Z',
    },
  },
  {
    id: 'BK-1003',
    concertId: 'celestial-sounds',
    concertTitle: 'Celestial Sounds',
    eventDate: '26 มี.ค. 2024',
    location: 'Chiang Mai Hall, เชียงใหม่',
    zoneId: 'C1',
    tierName: 'Economy',
    seats: ['C1-12'],
    quantity: 1,
    unitPrice: 1200,
    discountAmount: 0,
    totalPrice: 1200,
    customerName: 'ปรีชา มั่นคง',
    customerEmail: 'preecha.m@example.com',
    customerPhone: '0823456789',
    status: 'rejected',
    createdAt: '2024-02-22T09:05:00.000Z',
    payment: {
      evidenceFileName: 'slip_blurry.jpg',
      submittedAt: '2024-02-22T09:10:00.000Z',
      verifiedBy: 'เจ้าหน้าที่ฝ่ายขาย (อนันต์ ภักดี)',
      verifiedAt: '2024-02-22T09:40:00.000Z',
      rejectReason: 'ภาพสลิปไม่ชัดเจน ไม่สามารถตรวจสอบวันเวลาและเลขที่บัญชีปลายทางได้ กรุณาแนบภาพสลิปใหม่อีกครั้ง',
    },
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
  input: Omit<BookingRecord, 'id' | 'createdAt'>,
): BookingRecord {
  load()
  const nextNumber = Math.floor(1000 + Math.random() * 9000)
  const record: BookingRecord = {
    ...input,
    id: `BK-${nextNumber}`,
    createdAt: new Date().toISOString(),
  }
  writeToStorage([record, ...cache])
  emit()
  return record
}

export function getBookingById(bookingId: string): BookingRecord | null {
  load()
  return cache.find((booking) => booking.id === bookingId) ?? null
}

function updateBooking(
  bookingId: string,
  mutate: (booking: BookingRecord) => BookingRecord,
): BookingRecord | null {
  load()
  const index = cache.findIndex((booking) => booking.id === bookingId)
  if (index === -1) return null

  const updated = mutate(cache[index])
  const next = [...cache]
  next[index] = updated
  writeToStorage(next)
  emit()
  return updated
}

// UP1: ลูกค้าอัปโหลดหลักฐานการชำระเงิน (สลิป)
export function submitPaymentEvidence(
  bookingId: string,
  evidenceFileName: string,
  evidenceDataUrl?: string,
): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null) return null
  if (current.status !== 'pending_payment' && current.status !== 'rejected') return null

  return updateBooking(bookingId, (booking) => ({
    ...booking,
    status: 'under_review',
    payment: {
      evidenceFileName,
      evidenceDataUrl,
      submittedAt: new Date().toISOString(),
      rejectReason: undefined,
    },
  }))
}

// UP2 & UP3: เจ้าหน้าที่ตรวจสอบและอนุมัติการชำระเงิน -> ระบบออกบัตรอัตโนมัติพร้อม QR Code
export function approvePayment(bookingId: string, verifiedBy: string): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'under_review') return null

  return updateBooking(bookingId, (booking) => {
    const verifiedAt = new Date().toISOString()
    const payment: PaymentEvidence = {
      ...(booking.payment ?? { evidenceFileName: '', submittedAt: verifiedAt }),
      verifiedBy,
      verifiedAt,
      rejectReason: undefined,
    }

    const tickets: Ticket[] = Array.from({ length: booking.quantity }, (_, index) => {
      const code = buildTicketCode(booking.id, index)
      const seatLabel = buildSeatLabel(booking.zoneId, index, booking.seats)
      return {
        code,
        seatLabel,
        issuedAt: verifiedAt,
        qrCodeUrl: buildQrCodeUrl(code),
      }
    })

    return { ...booking, status: 'issued', payment, tickets }
  })
}

// UP2: เจ้าหน้าที่ปฏิเสธการชำระเงิน พร้อมระบุเหตุผล
export function rejectPayment(
  bookingId: string,
  verifiedBy: string,
  rejectReason: string,
): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'under_review') return null

  return updateBooking(bookingId, (booking) => {
    const verifiedAt = new Date().toISOString()
    const payment: PaymentEvidence = {
      ...(booking.payment ?? { evidenceFileName: '', submittedAt: verifiedAt }),
      verifiedBy,
      verifiedAt,
      rejectReason,
    }
    return { ...booking, status: 'rejected', payment }
  })
}

// UP5: ขอส่งบัตรใบเดิมซ้ำทางอีเมล (QR Code เดิม)
export function resendTicket(bookingId: string): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'issued') return null

  return updateBooking(bookingId, (booking) => ({
    ...booking,
    resendLog: [...(booking.resendLog ?? []), new Date().toISOString()],
  }))
}

// U2: ปล่อยที่นั่งคืนอัตโนมัติเมื่อหมดเวลา
export function cancelExpiredBooking(bookingId: string): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'pending_payment') return null

  return updateBooking(bookingId, (booking) => ({
    ...booking,
    status: 'expired',
  }))
}

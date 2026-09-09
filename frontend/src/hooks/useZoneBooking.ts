import { useEffect, useMemo, useState } from 'react'
import { getZoneMap } from '@/utils/mockZones'
import { addBooking, countSeatsForZone } from '@/utils/bookingStore'
import { useBookings } from '@/hooks/useBookings'
import type { Zone } from '@/interface/IZoneInterface'
import type { BookingRecord } from '@/interface/IBookingInterface'
import type { Concert } from '@/interface/IConcertInterface'

export const ZONE_LOCK_SECONDS = 60
export const MAX_TICKETS_PER_BOOKING = 4

export type BookingPhase = 'idle' | 'locked' | 'confirmed' | 'expired'

export interface ZoneWithAvailability extends Zone {
  remaining: number
}

export interface ZoneBookingState {
  zones: ZoneWithAvailability[]
  selectedZone: ZoneWithAvailability | null
  phase: BookingPhase
  remainingSeconds: number
  errorMessage: string | null
  quantity: number
  maxQuantity: number
  customerName: string
  unitPrice: number
  totalPrice: number
  lastBooking: BookingRecord | null
  selectZone: (zoneId: string) => void
  setQuantity: (next: number) => void
  setCustomerName: (name: string) => void
  confirmBooking: () => void
}

export function useZoneBooking(concert: Concert | null): ZoneBookingState {
  const concertId = concert?.id ?? ''
  const baseZones = useMemo(() => getZoneMap(concertId), [concertId])
  const { bookings } = useBookings()

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [phase, setPhase] = useState<BookingPhase>('idle')
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [quantity, setQuantityState] = useState(1)
  const [customerName, setCustomerName] = useState('')
  const [lastBooking, setLastBooking] = useState<BookingRecord | null>(null)

  useEffect(() => {
    if (phase !== 'locked' || lockExpiresAt === null) return
    const expiresAt = lockExpiresAt

    function tick() {
      const secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft === 0) {
        setSelectedZoneId(null)
        setLockExpiresAt(null)
        setQuantityState(1)
        setPhase('expired')
        setErrorMessage('หมดเวลา โซนที่เลือกถูกปล่อยคืนอัตโนมัติ กรุณาเลือกโซนใหม่')
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [phase, lockExpiresAt])

  const zones: ZoneWithAvailability[] = baseZones.map((zone) => {
    const booked = zone.booked + countSeatsForZone(bookings, concertId, zone.id)
    const heldByMe = zone.id === selectedZoneId && phase === 'locked' ? quantity : 0
    return { ...zone, booked, remaining: zone.capacity - booked - heldByMe }
  })

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null

  const maxQuantity = selectedZone
    ? Math.min(MAX_TICKETS_PER_BOOKING, selectedZone.capacity - selectedZone.booked)
    : MAX_TICKETS_PER_BOOKING

  const unitPrice = selectedZone
    ? (concert?.tiers.find((t) => t.name === selectedZone.tierName)?.price ?? 0)
    : 0
  const totalPrice = unitPrice * quantity

  function selectZone(zoneId: string) {
    if (phase === 'confirmed') return
    if (phase === 'locked' && zoneId === selectedZoneId) return

    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return

    const availableToMe = zone.capacity - zone.booked
    if (availableToMe <= 0) {
      setErrorMessage('โซนนี้เต็มแล้ว กรุณาเลือกโซนอื่น')
      return
    }

    // เปลี่ยนโซนระหว่างที่ยังจับจองอยู่ได้ ที่ที่กันไว้ของโซนเดิมถูกคืนเองอัตโนมัติ
    // เพราะ heldByMe ผูกกับ selectedZoneId ปัจจุบันเท่านั้น ไม่ได้เก็บแยกไว้
    setErrorMessage(null)
    setSelectedZoneId(zoneId)
    setQuantityState(1)
    setLockExpiresAt(Date.now() + ZONE_LOCK_SECONDS * 1000)
    setRemainingSeconds(ZONE_LOCK_SECONDS)
    setPhase('locked')
  }

  function setQuantity(next: number) {
    if (phase !== 'locked') return
    setQuantityState(Math.min(Math.max(1, next), maxQuantity))
  }

  function confirmBooking() {
    if (phase !== 'locked' || !selectedZone || !concert) return

    if (customerName.trim().length === 0) {
      setErrorMessage('กรุณากรอกชื่อผู้จองก่อนยืนยันรายการ')
      return
    }

    const record = addBooking({
      concertId: concert.id,
      concertTitle: concert.title,
      zoneId: selectedZone.id,
      tierName: selectedZone.tierName,
      quantity,
      totalPrice,
      customerName: customerName.trim(),
    })

    setLastBooking(record)
    setErrorMessage(null)
    setLockExpiresAt(null)
    setPhase('confirmed')
  }

  return {
    zones,
    selectedZone,
    phase,
    remainingSeconds,
    errorMessage,
    quantity,
    maxQuantity,
    customerName,
    unitPrice,
    totalPrice,
    lastBooking,
    selectZone,
    setQuantity,
    setCustomerName,
    confirmBooking,
  }
}

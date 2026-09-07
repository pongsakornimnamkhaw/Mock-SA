import { useSyncExternalStore } from 'react'
import {
  getBookingsSnapshot,
  getLastUpdatedAt,
  getLoadError,
  subscribeBookings,
} from '@/utils/bookingStore'
import type { BookingRecord } from '@/interface/IBookingInterface'

export interface BookingsView {
  bookings: BookingRecord[]
  lastUpdatedAt: string
  loadError: string | null
}

export function useBookings(): BookingsView {
  const bookings = useSyncExternalStore(subscribeBookings, getBookingsSnapshot)
  return {
    bookings,
    lastUpdatedAt: getLastUpdatedAt(),
    loadError: getLoadError(),
  }
}

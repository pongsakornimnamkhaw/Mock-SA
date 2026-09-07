export type BookingStatus = 'pending_payment' | 'paid' | 'cancelled'

export interface BookingRecord {
  id: string
  concertId: string
  concertTitle: string
  zoneId: string
  tierName: string
  quantity: number
  totalPrice: number
  customerName: string
  status: BookingStatus
  /** ISO timestamp */
  createdAt: string
}

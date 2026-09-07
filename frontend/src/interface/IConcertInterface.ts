export type SaleStatus = 'on_sale' | 'sold_out' | 'coming_soon'

export interface TicketTier {
  name: string
  price: number
}

export interface Concert {
  id: string
  title: string
  posterUrl: string
  bannerUrl: string
  featured: boolean
  /** ISO date, YYYY-MM-DD */
  showStartDate: string
  /** ISO date, YYYY-MM-DD — เท่ากับ showStartDate ถ้างานจัดวันเดียว */
  showEndDate: string
  showTimeLabel: string
  saleStartDate: string
  saleEndDate: string
  venue: string
  venueFloor: string
  province: string
  tiers: TicketTier[]
  saleStatus: SaleStatus
  description: string
}

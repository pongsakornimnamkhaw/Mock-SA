import type { Concert, SaleStatus, TicketTier } from '@/interface/IConcertInterface'

const SHORT_MONTH = new Intl.DateTimeFormat('th-TH-u-ca-gregory', { month: 'short' })
const LONG_MONTH = new Intl.DateTimeFormat('th-TH-u-ca-gregory', { month: 'long' })

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatRange(
  startISO: string,
  endISO: string,
  monthFormat: Intl.DateTimeFormat,
): string {
  const start = parseISODate(startISO)
  const end = parseISODate(endISO)
  const month = monthFormat.format(end)
  const year = end.getFullYear()
  const dayPart =
    startISO === endISO ? `${start.getDate()}` : `${start.getDate()}-${end.getDate()}`
  return `${dayPart} ${month} ${year}`
}

export function formatShowDateShort(concert: Concert): string {
  if (concert.saleStatus === 'coming_soon') return 'รอประกาศ'
  return formatRange(concert.showStartDate, concert.showEndDate, SHORT_MONTH)
}

export function formatShowDateLong(concert: Concert): string {
  if (concert.saleStatus === 'coming_soon') return 'รอประกาศ'
  return formatRange(concert.showStartDate, concert.showEndDate, LONG_MONTH)
}

export function formatSalePeriod(concert: Concert): string {
  return formatRange(concert.saleStartDate, concert.saleEndDate, LONG_MONTH)
}

export function formatPriceTiers(tiers: TicketTier[]): string {
  return [...tiers]
    .sort((a, b) => b.price - a.price)
    .map((tier) => tier.price.toLocaleString('en-US'))
    .join(' / ')
}

export function formatVenue(concert: Concert): string {
  return `${concert.venueFloor} ${concert.venue} ${concert.province}`
}

export function saleStatusLabel(status: SaleStatus): string {
  switch (status) {
    case 'on_sale':
      return 'เปิดจำหน่ายแล้ว'
    case 'sold_out':
      return 'บัตรหมด'
    case 'coming_soon':
      return 'เร็ว ๆ นี้'
  }
}

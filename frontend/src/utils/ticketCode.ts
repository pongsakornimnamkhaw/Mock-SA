export function buildTicketCode(bookingId: string, index: number): string {
  const cleanId = bookingId.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const seq = String(index + 1).padStart(2, '0')
  return `TKT-${cleanId}-${seq}`
}

export function buildSeatLabel(zoneId: string, index: number, seatNames?: string[]): string {
  if (seatNames && seatNames[index]) {
    return seatNames[index]
  }
  const seq = String(index + 1).padStart(2, '0')
  return `${zoneId}-${seq}`
}

export function buildQrCodeUrl(code: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(code)}`
}

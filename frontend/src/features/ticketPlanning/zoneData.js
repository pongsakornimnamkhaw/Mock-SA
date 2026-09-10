export const seatKey = seat => seat?.clientKey || (Number(seat?.id) > 0 ? `seat-${seat.id}` : '')

const normalizeSeat = (seat, index) => {
  const numericID = typeof seat?.id === 'number' && Number.isInteger(seat.id) && seat.id > 0
    ? seat.id
    : undefined
  return {
    ...seat,
    id: numericID,
    clientKey: seat?.clientKey || (numericID ? `seat-${numericID}` : String(seat?.id || `new-seat-${index + 1}`)),
  }
}

export const normalizeZoneForEditor = zone => ({
  ...zone,
  zonePrice: Number(zone?.zonePrice ?? zone?.price ?? 0),
  seatItems: Array.isArray(zone?.seatItems) ? zone.seatItems.map(normalizeSeat) : [],
})

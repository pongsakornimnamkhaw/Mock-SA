export const STATUS_EXAMPLES = [
  {
    key: 'success',
    tone: 'success',
    symbol: '✓',
    title: 'ผ่านการตรวจสอบ',
    description: 'บัตรถูกต้องและบันทึกเข้างานสำเร็จ',
    ticketStatus: 'VALID',
  },
  {
    key: 'used',
    tone: 'warning',
    symbol: '!',
    title: 'บัตรถูกใช้แล้ว',
    description: 'พบการเช็คอินของบัตรใบนี้ก่อนหน้า',
    ticketStatus: 'USED',
  },
  {
    key: 'not-found',
    tone: 'danger',
    symbol: '×',
    title: 'ไม่พบบัตรในระบบ',
    description: 'รหัสบัตรหรือ QR Code ไม่ถูกต้อง',
    ticketStatus: 'NOT FOUND',
  },
  {
    key: 'unavailable',
    tone: 'unavailable',
    symbol: '!',
    title: 'บัตรยังใช้ไม่ได้',
    description: 'บัตรมีสถานะที่ยังไม่อนุญาตให้ลงทะเบียนเข้างาน',
    ticketStatus: 'PENDING',
  },
] as const

type LookupTicket = {
  checkedIn?: boolean
  ticketStatus?: string
}

export function classifyLookupConflict(ticket: LookupTicket): 'warning' | 'unavailable' {
  return ticket.checkedIn || ticket.ticketStatus?.trim().toUpperCase() === 'USED'
    ? 'warning'
    : 'unavailable'
}

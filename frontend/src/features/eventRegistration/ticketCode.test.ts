import { describe, expect, it } from 'vitest'

import { formatTicketCode, normalizeTicketCode } from './ticketCode'

describe('normalizeTicketCode', () => {
  it('extracts the ticket ID from booking QR payloads', () => {
    expect(normalizeTicketCode('OCTAVIA|TK-000123|Concert|ZONE-A|A1|Customer')).toBe('TK-000123')
  })

  it('continues to support manually entered ticket IDs', () => {
    expect(normalizeTicketCode(' #TK-000123 ')).toBe('TK-000123')
  })
})

describe('formatTicketCode', () => {
  it('formats numeric API IDs for people without changing an existing TK code', () => {
    expect(formatTicketCode(45)).toBe('TK-45')
    expect(formatTicketCode('TK-000123')).toBe('TK-000123')
    expect(formatTicketCode(undefined)).toBe('-')
  })
})

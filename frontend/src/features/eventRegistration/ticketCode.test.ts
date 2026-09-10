import { describe, expect, it } from 'vitest'

import { normalizeTicketCode } from './ticketCode'

describe('normalizeTicketCode', () => {
  it('extracts the ticket ID from booking QR payloads', () => {
    expect(normalizeTicketCode('OCTAVIA|TK-000123|Concert|ZONE-A|A1|Customer')).toBe('TK-000123')
  })

  it('continues to support manually entered ticket IDs', () => {
    expect(normalizeTicketCode(' #TK-000123 ')).toBe('TK-000123')
  })
})

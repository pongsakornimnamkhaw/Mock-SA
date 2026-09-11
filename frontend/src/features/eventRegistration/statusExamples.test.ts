import { describe, expect, it } from 'vitest'

import { classifyLookupConflict, STATUS_EXAMPLES } from './statusExamples'

describe('event registration status examples', () => {
  it('shows every backend outcome without writing a check-in', () => {
    expect(STATUS_EXAMPLES.map(example => example.key)).toEqual([
      'success',
      'used',
      'not-found',
      'unavailable',
    ])
  })

  it('distinguishes an already-used ticket from an unavailable ticket', () => {
    expect(classifyLookupConflict({ checkedIn: true, ticketStatus: 'USED' })).toBe('warning')
    expect(classifyLookupConflict({ checkedIn: false, ticketStatus: 'PENDING' })).toBe('unavailable')
  })
})

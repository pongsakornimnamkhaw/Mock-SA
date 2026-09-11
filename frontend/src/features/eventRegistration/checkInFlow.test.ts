import { describe, expect, it, vi } from 'vitest';

import { runAutomaticCheckIn } from './checkInFlow';

const apiError = (status: number, code?: string, data: Record<string, unknown> = {}) =>
  Object.assign(new Error('request failed'), { status, data: { ...data, code } });

describe('runAutomaticCheckIn', () => {
  it('looks up and immediately checks in a ready ticket', async () => {
    const ticket = { ticketId: 45, ticketStatus: 'READY', concertName: 'Concert A' };
    const api = {
      lookupTicket: vi.fn().mockResolvedValue(ticket),
      checkIn: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    };

    await expect(runAutomaticCheckIn('OCTAVIA|45|Concert A', 'CONCERT_A', 2, api)).resolves.toEqual({
      tone: 'success', ticket,
    });
    expect(api.lookupTicket).toHaveBeenCalledWith('45', 'CONCERT_A');
    expect(api.checkIn).toHaveBeenCalledWith(45, 2, 'CONCERT_A');
  });

  it('maps an already-used lookup without writing another check-in', async () => {
    const ticket = { ticketId: 45, ticketStatus: 'USED', checkedIn: true };
    const api = {
      lookupTicket: vi.fn().mockRejectedValue(apiError(409, 'TICKET_USED', ticket)),
      checkIn: vi.fn(),
    };

    await expect(runAutomaticCheckIn('TK-45', 'CONCERT_A', 1, api)).resolves.toEqual({ tone: 'warning', ticket: expect.objectContaining(ticket) });
    expect(api.checkIn).not.toHaveBeenCalled();
  });

  it('maps a wrong-concert ticket to unavailable with an explicit message', async () => {
    const api = {
      lookupTicket: vi.fn().mockRejectedValue(apiError(409, 'WRONG_CONCERT', { ticketId: 45 })),
      checkIn: vi.fn(),
    };

    await expect(runAutomaticCheckIn('45', 'CONCERT_A', 1, api)).resolves.toEqual({
      tone: 'unavailable',
      ticket: expect.objectContaining({ ticketId: 45 }),
      message: 'บัตรนี้เป็นของคอนเสิร์ตอื่น',
    });
  });

  it('maps a race lost during check-in to used', async () => {
    const ticket = { ticketId: 45, ticketStatus: 'READY' };
    const api = {
      lookupTicket: vi.fn().mockResolvedValue(ticket),
      checkIn: vi.fn().mockRejectedValue(apiError(409, 'TICKET_USED')),
    };

    await expect(runAutomaticCheckIn('45', 'CONCERT_A', 1, api)).resolves.toEqual({ tone: 'warning', ticket });
  });

  it('keeps network failures on the scanner instead of calling them not-found', async () => {
    const api = {
      lookupTicket: vi.fn().mockRejectedValue(new Error('network down')),
      checkIn: vi.fn(),
    };

    await expect(runAutomaticCheckIn('45', 'CONCERT_A', 1, api)).rejects.toThrow('network down');
  });
});

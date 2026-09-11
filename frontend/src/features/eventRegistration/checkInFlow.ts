import { normalizeTicketCode } from './ticketCode';

type RegistrationAPI = {
  lookupTicket: (ticketId: string, concertId: string) => Promise<Record<string, unknown>>;
  checkIn: (ticketId: unknown, gateId: number, concertId: string) => Promise<unknown>;
};

type RegistrationError = Error & {
  status?: number;
  data?: Record<string, unknown>;
};

export type CheckInTone = 'success' | 'warning' | 'danger' | 'unavailable';

export type CheckInResult = {
  tone: CheckInTone;
  ticket: Record<string, unknown>;
  message?: string;
};

const resultForAPIError = (
  error: RegistrationError,
  fallbackTicket: Record<string, unknown>,
): CheckInResult | null => {
  const code = String(error.data?.code || '');
  const ticket = error.data?.ticketId ? error.data : fallbackTicket;
  if (code === 'TICKET_USED') return { tone: 'warning', ticket };
  if (code === 'WRONG_CONCERT') {
    return { tone: 'unavailable', ticket, message: 'บัตรนี้เป็นของคอนเสิร์ตอื่น' };
  }
  if (code === 'TICKET_UNAVAILABLE') return { tone: 'unavailable', ticket };
  if (code === 'TICKET_NOT_FOUND' || error.status === 404 || error.status === 400) {
    return { tone: 'danger', ticket };
  }
  return null;
};

export async function runAutomaticCheckIn(
  rawCode: string,
  concertId: string,
  gateId: number,
  api: RegistrationAPI,
): Promise<CheckInResult> {
  const code = normalizeTicketCode(rawCode);
  if (!code) return { tone: 'danger', ticket: { ticketId: rawCode } };

  let ticket: Record<string, unknown>;
  try {
    ticket = await api.lookupTicket(code, concertId);
  } catch (error) {
    const mapped = resultForAPIError(error as RegistrationError, { ticketId: code });
    if (mapped) return mapped;
    throw error;
  }

  try {
    await api.checkIn(ticket.ticketId, gateId, concertId);
    return { tone: 'success', ticket };
  } catch (error) {
    const mapped = resultForAPIError(error as RegistrationError, ticket);
    if (mapped) return mapped;
    throw error;
  }
}

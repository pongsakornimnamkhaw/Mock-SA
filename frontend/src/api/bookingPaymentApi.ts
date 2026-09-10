import type { BookingRecord, BookingStatus, Ticket } from '@/types/booking';
import {
  getBookingsSnapshot,
  addBooking as addLocalBooking,
  approvePayment as approveLocalPayment,
  rejectPayment as rejectLocalPayment,
  resendTicket as resendLocalTicket,
  submitPaymentEvidence as submitLocalPaymentEvidence,
} from '@/utils/bookingStore';
import { buildQrCodeUrl } from '@/utils/ticketCode';

/** เซิร์ฟเวอร์ปฏิเสธการจอง (เช่น ที่นั่งถูกคนอื่นชิงไปแล้ว) — ต่างจาก "ต่อเซิร์ฟเวอร์ไม่ติด" */
export class BookingRejectedError extends Error {
  readonly unavailableSeats: string[];

  constructor(message: string, unavailableSeats: string[] = []) {
    super(message);
    this.name = 'BookingRejectedError';
    this.unavailableSeats = unavailableSeats;
  }
}

type BackendBookingWire = {
  booking_id: string;
  concert_id: string;
  concert_title: string;
  zone_id: string;
  tier_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  booking_date: string;
  reject_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  tickets?: Array<{
    ticket_id: string;
    name_concert: string;
    seat_label: string;
    status_ticket: string;
    ticket_datetime: string;
    qr_code_data?: string;
  }>;
  payments?: Array<{
    payment_id: string;
    file_name?: string;
    payment_status: string;
    created_at?: string;
  }>;
};

const mapWireToBooking = (b: BackendBookingWire): BookingRecord => {
  const latestPayment = b.payments && b.payments.length > 0 ? b.payments[b.payments.length - 1] : undefined;
  let tickets: Ticket[] | undefined = b.tickets?.map((t) => ({
    code: t.ticket_id,
    seatLabel: t.seat_label || 'A1',
    issuedAt: t.ticket_datetime,
    qrCodeUrl: t.qr_code_data ? buildQrCodeUrl(t.qr_code_data) : buildQrCodeUrl(t.ticket_id),
  }));

  // หากรายการจองออกบัตรแล้ว (issued) แต่ยังไม่มีรายการ tickets ให้สร้างตั๋วพร้อม QR Code ให้อัตโนมัติ
  if (b.status === 'issued' && (!tickets || tickets.length === 0)) {
    const qty = b.quantity || 1;
    tickets = Array.from({ length: qty }, (_, index) => {
      const seatLabel = `${b.zone_id || 'A'}-${String(index + 1).padStart(2, '0')}`;
      const code = `TCK-${(b.concert_id || 'CONCERT').toUpperCase()}-${b.zone_id || 'A'}-${index + 1}-${b.booking_id.replace(/[^0-9]/g, '').slice(-4) || '0001'}`;
      return {
        code,
        seatLabel,
        issuedAt: b.reviewed_at || b.booking_date || new Date().toISOString(),
        qrCodeUrl: buildQrCodeUrl(code),
      };
    });
  }

  return {
    id: b.booking_id,
    concertId: b.concert_id,
    concertTitle: b.concert_title || 'Octavia Concert',
    zoneId: b.zone_id,
    tierName: b.tier_name,
    quantity: b.quantity || 1,
    unitPrice: b.unit_price || 0,
    discountAmount: b.discount_amount || 0,
    totalPrice: b.total_price || 0,
    customerName: b.customer_name,
    customerEmail: b.customer_email,
    customerPhone: b.customer_phone,
    status: (b.status as BookingStatus) || 'under_review',
    createdAt: b.booking_date,
    tickets,
    payment: latestPayment
      ? {
          evidenceFileName: latestPayment.file_name || 'payment_slip.jpg',
          evidenceDataUrl: `/api/bookings/${encodeURIComponent(b.booking_id)}/slip`,
          submittedAt: latestPayment.created_at || b.booking_date,
          verifiedBy: b.reviewed_by,
          verifiedAt: b.reviewed_at,
          rejectReason: b.reject_reason,
        }
      : undefined,
  };
};

export const bookingPaymentApi = {
  async createBooking(data: {
    concertId: string;
    concertTitle: string;
    eventDate?: string;
    location?: string;
    zoneId: string;
    tierName: string;
    seats: string[];
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    totalPrice: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    userId?: string;
    slipFileName?: string;
    slipDataUrl?: string;
  }): Promise<BookingRecord> {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concert_id: data.concertId,
          concert_title: data.concertTitle,
          event_date: data.eventDate,
          location: data.location,
          zone_id: data.zoneId,
          tier_name: data.tierName,
          seats: data.seats,
          quantity: data.quantity,
          unit_price: data.unitPrice,
          discount_amount: data.discountAmount,
          total_price: data.totalPrice,
          customer_name: data.customerName,
          customer_email: data.customerEmail,
          customer_phone: data.customerPhone,
          user_id: data.userId,
          slip_file_name: data.slipFileName,
          slip_data_url: data.slipDataUrl,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new BookingRejectedError(
          body?.error || 'บันทึกการจองไม่สำเร็จ',
          body?.unavailable_seats ?? [],
        );
      }

      const json = await res.json();
      const mapped = mapWireToBooking(json.data);
      // Keep local sync in case user switches views
      addLocalBooking(mapped);
      return mapped;
    } catch (error) {
      // เซิร์ฟเวอร์ตอบว่าไม่ผ่าน → ต้องให้ผู้ใช้เห็น ห้ามกลืนแล้วบอกว่าจองสำเร็จ
      if (error instanceof BookingRejectedError) {
        throw error;
      }
      // Local Fallback
      return addLocalBooking({
        concertId: data.concertId,
        concertTitle: data.concertTitle,
        eventDate: data.eventDate,
        location: data.location,
        zoneId: data.zoneId,
        tierName: data.tierName,
        seats: data.seats,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        discountAmount: data.discountAmount,
        totalPrice: data.totalPrice,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        status: data.slipFileName ? 'under_review' : 'pending_payment',
        payment: data.slipFileName
          ? {
              evidenceFileName: data.slipFileName,
              evidenceDataUrl: data.slipDataUrl,
              submittedAt: new Date().toISOString(),
            }
          : undefined,
      });
    }
  },

  async getCustomerBookings(userId?: string, email?: string): Promise<BookingRecord[]> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (email) params.append('email', email);

      const res = await fetch(`/api/customer/account/bookings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load bookings');
      const json = await res.json();
      return (json.data as BackendBookingWire[]).map(mapWireToBooking);
    } catch {
      // Filter from local store
      const local = getBookingsSnapshot();
      if (!email && !userId) return local;
      return local.filter((b) => (email && b.customerEmail === email) || true);
    }
  },

  async getSalesBookings(query?: string, status?: string): Promise<BookingRecord[]> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (status && status !== 'all') params.append('status', status);

      const res = await fetch(`/api/sales/bookings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load sales bookings');
      const json = await res.json();
      return (json.data as BackendBookingWire[]).map(mapWireToBooking);
    } catch {
      let items = getBookingsSnapshot();
      if (status && status !== 'all') {
        items = items.filter((b) => b.status === status);
      }
      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        items = items.filter(
          (b) =>
            b.id.toLowerCase().includes(q) ||
            b.customerName.toLowerCase().includes(q) ||
            (b.customerPhone && b.customerPhone.includes(q)) ||
            b.concertTitle.toLowerCase().includes(q)
        );
      }
      return items;
    }
  },

  async approveBooking(bookingId: string, officerName?: string): Promise<BookingRecord | null> {
    const verifier = officerName || 'เจ้าหน้าที่ฝ่ายขาย (B6728786)';
    try {
      const res = await fetch(`/api/sales/bookings/${encodeURIComponent(bookingId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officer_name: verifier }),
      });
      if (res.ok) {
        const json = await res.json();
        const mapped = mapWireToBooking(json.data);
        approveLocalPayment(bookingId, verifier);
        return mapped;
      }
    } catch {
      // Fallback
    }
    return approveLocalPayment(bookingId, verifier);
  },

  async rejectBooking(bookingId: string, reason: string, officerName?: string): Promise<BookingRecord | null> {
    const verifier = officerName || 'เจ้าหน้าที่ฝ่ายขาย (B6728786)';
    try {
      const res = await fetch(`/api/sales/bookings/${encodeURIComponent(bookingId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, officer_name: verifier }),
      });
      if (res.ok) {
        const json = await res.json();
        const mapped = mapWireToBooking(json.data);
        rejectLocalPayment(bookingId, verifier, reason);
        return mapped;
      }
    } catch {
      // Fallback
    }
    return rejectLocalPayment(bookingId, verifier, reason);
  },

  async reuploadSlip(bookingId: string, fileName: string, dataUrl?: string): Promise<BookingRecord | null> {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/reupload-slip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slip_file_name: fileName, slip_data_url: dataUrl }),
      });
      if (res.ok) {
        const json = await res.json();
        const mapped = mapWireToBooking(json.data);
        submitLocalPaymentEvidence(bookingId, fileName, dataUrl);
        return mapped;
      }
    } catch {
      // Fallback
    }
    return submitLocalPaymentEvidence(bookingId, fileName, dataUrl);
  },

  async resendTickets(bookingId: string): Promise<BookingRecord | null> {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/resend-tickets`, {
        method: 'POST',
      });
      if (res.ok) {
        return resendLocalTicket(bookingId);
      }
    } catch {
      // Fallback
    }
    return resendLocalTicket(bookingId);
  },
};

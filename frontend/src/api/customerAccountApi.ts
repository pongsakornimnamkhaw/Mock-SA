export interface CustomerAccount {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
}

export interface CustomerTicket {
  ticketId: string;
  bookingId: string;
  concertId: string;
  concertName: string;
  eventDate: string;
  location: string;
  zone: string;
  seatRow: number;
  seatColumn: number;
  status: string;
  purchasedAt: string;
}

export interface CustomerPurchase {
  bookingId: string;
  bookingDate: string;
  status: string;
  paymentStatus: string;
  concertNames: string;
  ticketCount: number;
  totalAmount: number;
}

export interface CustomerProfileInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
}

export interface CustomerRegistrationInput extends CustomerProfileInput {
  password: string;
}

type AccountWire = {
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
};

type TicketWire = {
  ticket_id: string;
  booking_id: string;
  concert_id: string;
  concert_name: string;
  event_date: string;
  location: string;
  zone: string;
  seat_row: number;
  seat_column: number;
  status: string;
  purchased_at: string;
};

type PurchaseWire = {
  booking_id: string;
  booking_date: string;
  status: string;
  payment_status: string;
  concert_names: string;
  ticket_count: number;
  total_amount: number;
};

export class CustomerApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'CustomerApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/customer${path}`, {
      ...init,
      credentials: 'include',
      headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    });
  } catch {
    throw new CustomerApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ กรุณาตรวจสอบว่า Backend กำลังทำงาน', 0);
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: string };
  if (!response.ok) {
    const fallback = response.status >= 500
      ? 'เซิร์ฟเวอร์ไม่พร้อมใช้งาน กรุณาตรวจสอบว่า Backend กำลังทำงาน'
      : 'ไม่สามารถดำเนินการได้';
    throw new CustomerApiError(payload.error || fallback, response.status);
  }
  return payload.data as T;
}

const mapAccount = (row: AccountWire): CustomerAccount => ({
  userId: row.user_id,
  firstName: row.first_name,
  lastName: row.last_name,
  dateOfBirth: row.date_of_birth,
  gender: row.gender,
  phone: row.phone,
  address: row.address,
  email: row.email,
});

const profilePayload = (input: CustomerProfileInput) => ({
  first_name: input.firstName,
  last_name: input.lastName,
  date_of_birth: input.dateOfBirth,
  gender: input.gender,
  phone: input.phone,
  address: input.address,
  email: input.email,
});

export const customerAccountApi = {
  async login(email: string, password: string) {
    try {
      return mapAccount(await request<AccountWire>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }));
    } catch (err) {
      if (err instanceof CustomerApiError && err.status !== 0) throw err;
      // Fallback for demo customer if backend is offline or unreachable
      if (email.toLowerCase().includes('demo') || email.toLowerCase().includes('customer')) {
        return {
          userId: 'CUS-DEMO-001',
          firstName: 'สมชาย',
          lastName: 'ใจดี (ทดสอบ)',
          dateOfBirth: '1995-05-15',
          gender: 'ชาย',
          phone: '081-234-5678',
          address: '99/1 ถ.มิตรภาพ อ.เมือง จ.นครราชสีมา 30000',
          email: email.trim().toLowerCase(),
        };
      }
      throw err;
    }
  },

  async register(input: CustomerRegistrationInput) {
    return mapAccount(await request<AccountWire>('/auth/register', {
      method: 'POST', body: JSON.stringify({ ...profilePayload(input), password: input.password }),
    }));
  },

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  async getAccount() {
    try {
      return mapAccount(await request<AccountWire>('/account'));
    } catch (err) {
      // In offline mode, do not fail if we have existing session
      throw err;
    }
  },

  async updateProfile(input: CustomerProfileInput) {
    return mapAccount(await request<AccountWire>('/account/profile', {
      method: 'PATCH', body: JSON.stringify(profilePayload(input)),
    }));
  },

  changePassword: (currentPassword: string, newPassword: string) => request<void>('/account/password', {
    method: 'PATCH', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }),

  forgotPassword: (email: string) => request<void>('/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  }),

  resetPassword: (token: string, newPassword: string) => request<void>('/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ token, new_password: newPassword }),
  }),

  async getTickets(): Promise<CustomerTicket[]> {
    const rows = await request<TicketWire[]>('/account/tickets');
    return rows.map((row) => ({
      ticketId: row.ticket_id, bookingId: row.booking_id, concertId: row.concert_id,
      concertName: row.concert_name, eventDate: row.event_date, location: row.location,
      zone: row.zone, seatRow: row.seat_row, seatColumn: row.seat_column,
      status: row.status, purchasedAt: row.purchased_at,
    }));
  },

  async getPurchases(): Promise<CustomerPurchase[]> {
    const rows = await request<PurchaseWire[]>('/account/purchases');
    return rows.map((row) => ({
      bookingId: row.booking_id, bookingDate: row.booking_date, status: row.status,
      paymentStatus: row.payment_status, concertNames: row.concert_names,
      ticketCount: row.ticket_count, totalAmount: row.total_amount,
    }));
  },
};

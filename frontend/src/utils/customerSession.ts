import type { CustomerAccount } from '@/api/customerAccountApi';

export interface CustomerSession extends CustomerAccount {
  name: string;
}

const CUSTOMER_SESSION_KEY = 'octavia-customer-session-ui-v1';
export const CUSTOMER_SESSION_EVENT = 'octavia-customer-session-change';

export function getCustomerSession(): CustomerSession | null {
  try {
    const rawValue = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!rawValue) return null;

    const session = JSON.parse(rawValue) as Partial<CustomerSession>;
    if (!session.email || !session.name || !session.userId) return null;
    return session as CustomerSession;
  } catch {
    return null;
  }
}

export function saveCustomerSession(account: CustomerAccount) {
  const session: CustomerSession = { ...account, name: `${account.firstName} ${account.lastName}`.trim() };
  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

export function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

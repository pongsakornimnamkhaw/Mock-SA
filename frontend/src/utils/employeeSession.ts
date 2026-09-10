import type { PersonnelType } from '@/types/promotion';

export interface EmployeeSession {
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  name: string;
  department: string;
  role: string;
  email: string;
  phone?: string;
  userType?: string;
  personnelType?: PersonnelType;
  lastLoginAt?: string;
}

const EMPLOYEE_SESSION_KEY = 'octavia-employee-session-ui-v1';
export const EMPLOYEE_SESSION_EVENT = 'octavia-employee-session-change';

export function getEmployeeSession(): EmployeeSession | null {
  try {
    const rawValue = localStorage.getItem(EMPLOYEE_SESSION_KEY);
    if (!rawValue) return null;

    const session = JSON.parse(rawValue) as Partial<EmployeeSession>;
    if (!session.name || !session.userId) return null;
    return session as EmployeeSession;
  } catch {
    return null;
  }
}

export function saveEmployeeSession(session: EmployeeSession) {
  localStorage.setItem(EMPLOYEE_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(EMPLOYEE_SESSION_EVENT));
}

export function clearEmployeeSession() {
  localStorage.removeItem(EMPLOYEE_SESSION_KEY);
  window.dispatchEvent(new Event(EMPLOYEE_SESSION_EVENT));
}

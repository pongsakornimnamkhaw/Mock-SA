const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export function resolveApiAssetUrl(value?: string): string {
  if (!value || /^https?:\/\//i.test(value) || !API_BASE.startsWith('http')) return value || '';
  try {
    return new URL(value, new URL(API_BASE).origin).toString();
  } catch {
    return value;
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include', ...options });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      const body = await response.text();
      if (body) message = body;
    }
    throw new Error(message);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

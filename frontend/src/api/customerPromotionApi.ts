import type { CustomerPromotion, CustomerPromotionConcert } from '@/types/customerPromotion';

async function request<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/customer${path}`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('ไม่พบ API โปรโมชั่น กรุณารีสตาร์ต Backend ให้เป็นเวอร์ชันล่าสุด');
        }
        throw new Error(`ไม่สามารถโหลดข้อมูลได้ (${response.status})`);
      }
      throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง');
    }
    if (!response.ok) {
      const error = data as { message?: string; error?: string } | null;
      throw new Error(error?.message || error?.error || `ไม่สามารถโหลดข้อมูลได้ (${response.status})`);
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('การเชื่อมต่อหมดเวลา กรุณาลองใหม่');
    }
    if (error instanceof TypeError) {
      throw new Error('เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export const customerPromotionApi = {
  list: async (concertId?: string) => {
    const query = concertId ? `?concert_id=${encodeURIComponent(concertId)}` : '';
    return request<{ data: CustomerPromotion[] }>(`/promotions${query}`);
  },
  get: (id: string) => request<{ data: CustomerPromotion }>(`/promotions/${encodeURIComponent(id)}`),
  getConcert: (id: string) => request<{ data: CustomerPromotionConcert }>(`/concerts/${encodeURIComponent(id)}`),
};

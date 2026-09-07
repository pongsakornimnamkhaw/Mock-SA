import type { ActivityLog, Concert, Employee, Promotion, PromotionApproval, Zone } from '../types/promotion';

export interface PromotionPayload {
  promotion_name: string;
  concert_id: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_discount_amount: number;
  promo_code: string;
  terms_detail: string;
  max_usage_per_user: number;
  min_order_amount: number;
  start_date: string;
  end_date: string;
  total_quota: number;
  selected_zones: string[];
  banner_image_url: string;
  remove_banner?: boolean;
}

// Scoped to management pages. The existing Vite /api proxy handles the backend.
// Never retry mutations automatically or replace a failed request with demo data.
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    if ([502, 503, 504].includes(response.status)) {
      throw new Error(`ติดต่อ Backend ไม่ได้หรือเซิร์ฟเวอร์ไม่พร้อม (${response.status}) กรุณาเปิด Backend ที่พอร์ต 8080 แล้วตรวจสอบข้อมูลก่อนลองบันทึกอีกครั้ง`);
    }
    const raw = await response.text();
    let data: unknown;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาตรวจสอบ Backend'); }
    if (!response.ok) {
      const error = data as { message?: string; error?: string } | null;
      throw new Error(error?.message || error?.error || `ไม่สามารถดำเนินการได้ (${response.status})`);
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('การเชื่อมต่อหมดเวลา กรุณาโหลดข้อมูลเพื่อตรวจสอบผลก่อนส่งซ้ำ');
    }
    if (error instanceof TypeError) throw new Error('เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่');
    throw error;
  } finally { clearTimeout(timer); }
}

const encoded = encodeURIComponent;
export const managementApi = {
  listPromotions: () => request<{ data: Promotion[]; summary: { active_promotion_count: number; total_revenue: number; total_redemptions: number } }>('/promotions'),
  getPromotion: (id: string) => request<Promotion>(`/promotions/${encoded(id)}`),
  promotionOptions: () => request<{ concerts: Concert[]; zones: Zone[] }>('/promotions/options'),
  savePromotion: (payload: PromotionPayload, id?: string) => request<Promotion>(id ? `/promotions/${encoded(id)}` : '/promotions', id ? 'PUT' : 'POST', payload),
  deletePromotion: (id: string) => request<void>(`/promotions/${encoded(id)}`, 'DELETE'),
  listApprovals: () => request<{ data: { approval: PromotionApproval; promotion: Promotion }[] }>('/promotion-approvals'),
  decideApproval: (id: string, status: 'approved' | 'rejected', remark: string) => request<void>(`/promotion-approvals/${encoded(id)}`, 'PATCH', { status, remark }),
  listEmployees: () => request<{ data: Employee[]; summary: { employee_count: number; admin_count: number; customer_count: number } }>('/employees'),
  getEmployee: (id: string) => request<Employee>(`/employees/${encoded(id)}`),
  saveEmployee: (payload: Omit<Employee, 'employee_id'>, id?: string) => request<Employee>(id ? `/employees/${encoded(id)}` : '/employees', id ? 'PUT' : 'POST', payload),
  deleteEmployee: (id: string) => request<void>(`/employees/${encoded(id)}`, 'DELETE'),
  activityLogs: (type: 'staff' | 'user') => request<{ data: (ActivityLog & { target_id?: string })[] }>(`/activity-logs?type=${type}`),
};

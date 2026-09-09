import type { CustomerPromotion } from '@/types/customerPromotion';

export function formatThaiDate(value: string) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** ช่วงวันจัดงาน ถ้าจบวันเดียวกับที่เริ่ม (หรือไม่มีวันจบ) แสดงวันเดียว */
export function formatThaiDateRange(startDate: string, endDate: string) {
  if (!endDate || endDate === startDate) return formatThaiDate(startDate);
  return `${formatThaiDate(startDate)} – ${formatThaiDate(endDate)}`;
}

export function discountLabel(promotion: CustomerPromotion) {
  const { type, value } = promotion.discount;
  return type === 'percent' ? `ลด ${value.toLocaleString()}%` : `ลด ${value.toLocaleString()} บาท`;
}

export function isExpiringSoon(promotion: CustomerPromotion) {
  const end = new Date(`${promotion.validity.end_date}T23:59:59`).getTime();
  const remaining = end - Date.now();
  return remaining >= 0 && remaining <= 7 * 24 * 60 * 60 * 1000;
}


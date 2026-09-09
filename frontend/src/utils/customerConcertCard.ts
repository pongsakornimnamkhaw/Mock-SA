import { celestial, flux, pulse, starlight } from '@/assets/Poster';
import type { CustomerEvent } from '@/data/customerEvents';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import { formatThaiDateRange } from '@/utils/customerPromotion';

// คอนเสิร์ตในฐานข้อมูลยังไม่มีรูปโปสเตอร์ ถ้าใช้รูปสำรองรูปเดียวทุกใบ การ์ดจะ
// เหมือนกันหมดจนดูเหมือนหน้าเว็บพัง จึงกระจายรูปตาม id แบบคงที่ (คอนเสิร์ตเดิม
// ได้รูปเดิมเสมอ ไม่สลับไปมาเวลารีเฟรช)
const fallbackPosters = [flux, pulse, celestial, starlight];

export function posterForConcert(concert: CustomerPromotionConcert) {
  if (concert.poster_data) return concert.poster_data;
  let checksum = 0;
  for (const character of concert.concert_id) {
    checksum += character.codePointAt(0) ?? 0;
  }
  return fallbackPosters[checksum % fallbackPosters.length];
}

export function toCustomerEvent(concert: CustomerPromotionConcert): CustomerEvent {
  return {
    id: concert.concert_id,
    image: posterForConcert(concert),
    title: concert.concert_name,
    date: formatThaiDateRange(concert.start_date, concert.end_date),
    location: concert.location,
    announcement: concert.more_info || 'ติดตามรายละเอียดเพิ่มเติมของคอนเสิร์ตนี้ได้ที่ Octavia',
  };
}

import type { CustomerPromotion } from '@/types/customerPromotion';

/** ออเดอร์ที่กำลังเลือกที่นั่งอยู่ ใช้ตัดสินว่าโปรโมชั่นไหนใช้ได้ */
export interface PromotionOrder {
    concertId: string;
    concertName: string;
    zoneId: string;
    zoneLabel: string;
    total: number;
}

export const normalizeMatchText = (value: string) => value
    .toLocaleLowerCase('th-TH')
    .replace(/[^a-z0-9ก-๙]+/g, ' ')
    .trim();

export const calculateDiscount = (promotion: CustomerPromotion, total: number) => {
    const rawDiscount = promotion.discount.type === 'percent'
        ? total * promotion.discount.value / 100
        : promotion.discount.value;
    const cappedDiscount = promotion.discount.max_discount_amount > 0
        ? Math.min(rawDiscount, promotion.discount.max_discount_amount)
        : rawDiscount;
    return Math.max(0, Math.min(total, Math.round(cappedDiscount * 100) / 100));
};

export const matchesConcert = (promotion: CustomerPromotion, order: PromotionOrder) => {
    if (order.concertId && promotion.concert.concert_id === order.concertId) return true;
    const orderedName = normalizeMatchText(order.concertName);
    const promotedName = normalizeMatchText(promotion.concert.concert_name);
    // ถ้าฝั่งใดฝั่งหนึ่งไม่มีชื่อ อย่าถือว่าตรง มิฉะนั้น includes('') จะจับคู่ทุกอย่าง
    if (!orderedName || !promotedName) return false;
    return orderedName.includes(promotedName) || promotedName.includes(orderedName);
};

export const matchesZone = (promotion: CustomerPromotion, order: PromotionOrder) => {
    if (promotion.zones.length === 0) return true;
    const zoneId = order.zoneId.toLocaleLowerCase('th-TH');
    const zoneRow = zoneId.charAt(0);
    const zoneLabel = normalizeMatchText(order.zoneLabel);
    return promotion.zones.some((zone) => {
        const promotionZoneId = zone.zone_id.toLocaleLowerCase('th-TH');
        const promotionZoneName = normalizeMatchText(zone.zone_name);
        return promotionZoneId === zoneId
            || (zoneRow !== '' && promotionZoneId.endsWith(`_${zoneRow}`))
            || (promotionZoneName !== '' && promotionZoneName === zoneLabel)
            || (zoneRow !== '' && promotionZoneName.includes(`โซน ${zoneRow}`));
    });
};

export const filterEligiblePromotions = (promotions: CustomerPromotion[], order: PromotionOrder) => promotions
    .filter((promotion) => matchesConcert(promotion, order)
        && matchesZone(promotion, order)
        && order.total >= promotion.discount.minimum_order
        && promotion.validity.remaining_quota > 0)
    .sort((left, right) => calculateDiscount(right, order.total) - calculateDiscount(left, order.total));

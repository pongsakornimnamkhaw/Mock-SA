import { describe, expect, it } from 'vitest';
import type { CustomerPromotion } from '@/types/customerPromotion';
import {
    calculateDiscount,
    filterEligiblePromotions,
    matchesConcert,
    matchesZone,
    normalizeMatchText,
    type PromotionOrder,
} from '@/utils/seatPromotion';

const makePromotion = (overrides: Partial<CustomerPromotion> = {}): CustomerPromotion => ({
    promotion_id: 'PROMO_1',
    promotion_name: 'ลด 15%',
    description: '',
    banner_image_url: '',
    terms: '',
    discount: { type: 'percent', value: 15, max_discount_amount: 300, minimum_order: 1000, promo_code: 'SAVE15' },
    validity: { start_date: '2026-09-01', end_date: '2026-12-31', total_quota: 100, used_quota: 25, remaining_quota: 75 },
    zones: [{ zone_id: 'ZONE_B', zone_name: 'โซน B' }],
    concert: {
        concert_id: 'CONCERT_1', concert_name: 'Riverside Sound Festival',
        start_date: '2026-10-16', end_date: '2026-10-18', start_time: '18:00:00',
        location: 'กรุงเทพฯ', status: 'ยืนยันแล้ว',
    },
    ...overrides,
});

const order: PromotionOrder = {
    concertId: 'CONCERT_1',
    concertName: 'Riverside Sound Festival',
    zoneId: 'B4',
    zoneLabel: 'โซน B',
    total: 4500,
};

describe('normalizeMatchText', () => {
    it('lowercases, strips punctuation and collapses whitespace', () => {
        expect(normalizeMatchText('Riverside Sound Festival')).toBe('riverside sound festival');
        expect(normalizeMatchText('  โซน  B4!! ')).toBe('โซน b4');
        expect(normalizeMatchText('Neon-Pulse (2026)')).toBe('neon pulse 2026');
    });
});

describe('calculateDiscount', () => {
    it('caps a percent discount at max_discount_amount', () => {
        expect(calculateDiscount(makePromotion(), 4500)).toBe(300);
    });

    it('computes an uncapped percent discount', () => {
        const promotion = makePromotion({
            discount: { type: 'percent', value: 10, max_discount_amount: 0, minimum_order: 0, promo_code: 'TEN' },
        });
        expect(calculateDiscount(promotion, 1234)).toBe(123.4);
    });

    it('never discounts more than the order total', () => {
        const promotion = makePromotion({
            discount: { type: 'fixed', value: 500, max_discount_amount: 0, minimum_order: 0, promo_code: 'FIX500' },
        });
        expect(calculateDiscount(promotion, 300)).toBe(300);
    });
});

describe('matchesConcert', () => {
    it('matches on exact concert id', () => {
        expect(matchesConcert(makePromotion(), order)).toBe(true);
    });

    it('matches fuzzily on concert name when the id differs', () => {
        expect(matchesConcert(makePromotion(), { ...order, concertId: '2' })).toBe(true);
    });

    it('rejects an unrelated concert', () => {
        expect(matchesConcert(makePromotion(), { ...order, concertId: '2', concertName: 'Starlight Festival' })).toBe(false);
    });

    it('rejects instead of matching everything when the promotion has no concert name', () => {
        const promotion = makePromotion({ concert: { ...makePromotion().concert, concert_id: 'X', concert_name: '' } });
        expect(matchesConcert(promotion, { ...order, concertId: '2' })).toBe(false);
    });
});

describe('matchesZone', () => {
    it('matches a zone row suffix such as ZONE_B against seat zone B4', () => {
        expect(matchesZone(makePromotion(), order)).toBe(true);
    });

    it('matches on the zone label', () => {
        const promotion = makePromotion({ zones: [{ zone_id: 'Z9', zone_name: 'โซน B' }] });
        expect(matchesZone(promotion, order)).toBe(true);
    });

    it('rejects a zone the promotion does not cover', () => {
        expect(matchesZone(makePromotion(), { ...order, zoneId: 'C3', zoneLabel: 'โซน C' })).toBe(false);
    });

    it('applies to every zone when the promotion lists none', () => {
        expect(matchesZone(makePromotion({ zones: [] }), { ...order, zoneId: 'C3', zoneLabel: 'โซน C' })).toBe(true);
    });
});

describe('filterEligiblePromotions', () => {
    it('drops promotions below the minimum order, without quota, or in another zone', () => {
        const promotions = [
            makePromotion({ promotion_id: 'OK' }),
            makePromotion({
                promotion_id: 'TOO_HIGH_MINIMUM',
                discount: { type: 'fixed', value: 100, max_discount_amount: 0, minimum_order: 9000, promo_code: 'BIG' },
            }),
            makePromotion({
                promotion_id: 'NO_QUOTA',
                validity: { start_date: '2026-09-01', end_date: '2026-12-31', total_quota: 10, used_quota: 10, remaining_quota: 0 },
            }),
            makePromotion({ promotion_id: 'OTHER_ZONE', zones: [{ zone_id: 'ZONE_C', zone_name: 'โซน C' }] }),
        ];
        expect(filterEligiblePromotions(promotions, order).map((p) => p.promotion_id)).toEqual(['OK']);
    });

    it('sorts the biggest discount first', () => {
        const promotions = [
            makePromotion({ promotion_id: 'SMALL' }), // capped at 300
            makePromotion({
                promotion_id: 'BIG',
                discount: { type: 'fixed', value: 800, max_discount_amount: 0, minimum_order: 0, promo_code: 'BIG800' },
            }),
        ];
        expect(filterEligiblePromotions(promotions, order).map((p) => p.promotion_id)).toEqual(['BIG', 'SMALL']);
    });
});

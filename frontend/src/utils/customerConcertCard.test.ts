import { describe, expect, it } from 'vitest';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import { formatThaiDateRange } from '@/utils/customerPromotion';
import { posterForConcert, toCustomerEvent } from '@/utils/customerConcertCard';

const makeConcert = (overrides: Partial<CustomerPromotionConcert> = {}): CustomerPromotionConcert => ({
    concert_id: 'CC0001',
    concert_name: 'Riverside Sound Festival',
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    start_time: '18:00:00',
    location: 'ธันเดอร์โดม เมืองทองธานี',
    status: 'ยืนยันแล้ว',
    more_info: 'เทศกาลดนตริมแม่น้ำ',
    ...overrides,
});

describe('posterForConcert', () => {
    it('uses the poster stored on the concert when there is one', () => {
        const concert = makeConcert({ poster_data: 'data:image/png;base64,AAAA' });
        expect(posterForConcert(concert)).toBe('data:image/png;base64,AAAA');
    });

    it('always gives the same fallback poster to the same concert', () => {
        const concert = makeConcert();
        expect(posterForConcert(concert)).toBe(posterForConcert(concert));
    });

    it('gives different concerts a spread of fallback posters', () => {
        const posters = new Set(
            ['CC0001', 'CC0002', 'CC0003', 'CC0004', 'CC0005', 'CC0006'].map(
                (concertId) => posterForConcert(makeConcert({ concert_id: concertId })),
            ),
        );
        expect(posters.size).toBeGreaterThan(1);
    });

    it('still returns a usable image when the concert id is empty', () => {
        expect(posterForConcert(makeConcert({ concert_id: '' }))).toBeTruthy();
    });
});

describe('toCustomerEvent', () => {
    it('maps a concert onto the card shape the listing already renders', () => {
        const event = toCustomerEvent(makeConcert());

        expect(event.id).toBe('CC0001');
        expect(event.title).toBe('Riverside Sound Festival');
        expect(event.location).toBe('ธันเดอร์โดม เมืองทองธานี');
        expect(event.date).toBe(formatThaiDateRange('2026-10-16', '2026-10-18'));
        expect(event.image).toBeTruthy();
    });

    it('carries the concert blurb into the announcement field', () => {
        expect(toCustomerEvent(makeConcert()).announcement).toBe('เทศกาลดนตริมแม่น้ำ');
    });

    it('falls back to a generic blurb when the concert has no extra info', () => {
        const event = toCustomerEvent(makeConcert({ more_info: undefined }));
        expect(event.announcement).not.toBe('');
    });

    it('never marks a database concert as new', () => {
        // ฟิลด์ isNew ใช้กับข้อมูลประกาศจำลองเท่านั้น ฐานข้อมูลไม่มีแนวคิดนี้
        expect(toCustomerEvent(makeConcert()).isNew).toBeUndefined();
    });
});

import { describe, expect, it } from 'vitest';
import { POSTER_THEMES, posterIndexForConcertId, ticketThemeForConcertId } from '@/utils/posterPalette';

describe('ticketThemeForConcertId', () => {
    it('always gives the same concert the same colours', () => {
        expect(ticketThemeForConcertId('CC0001')).toBe(ticketThemeForConcertId('CC0001'));
    });

    it('spreads different concerts across more than one colour set', () => {
        const accents = new Set(
            ['CC0001', 'CC0002', 'CC0003', 'CC0004', 'CC0005', 'CC0006'].map(
                (concertId) => ticketThemeForConcertId(concertId).accent,
            ),
        );
        expect(accents.size).toBeGreaterThan(1);
    });

    it('still returns a usable theme when the concert id is empty', () => {
        const theme = ticketThemeForConcertId('');
        expect(theme.base).toBeTruthy();
        expect(theme.accent).toBeTruthy();
    });

    it('gives every theme a dark base so the neon accent stays readable', () => {
        for (const theme of POSTER_THEMES) {
            // พื้นตั๋วต้องเข้มจริง ไม่งั้นตัวอักษรสีอ่อนบนตั๋วจะอ่านไม่ออก
            const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(theme.base.slice(offset, offset + 2), 16));
            expect(Math.max(red, green, blue)).toBeLessThan(80);
        }
    });

    it('uses a hex colour for every field so it can be composed with alpha suffixes', () => {
        for (const theme of POSTER_THEMES) {
            expect(theme.base).toMatch(/^#[0-9A-F]{6}$/i);
            expect(theme.stub).toMatch(/^#[0-9A-F]{6}$/i);
            expect(theme.accent).toMatch(/^#[0-9A-F]{6}$/i);
        }
    });
});

describe('posterIndexForConcertId', () => {
    it('stays inside the theme list', () => {
        for (const concertId of ['', 'CC0001', 'ยาวมากกกกกก', 'X']) {
            const index = posterIndexForConcertId(concertId);
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(POSTER_THEMES.length);
        }
    });

    it('keeps the checksum behaviour the concert cards already rely on', () => {
        // ผลรวม code point ของ "CC0001" = 67+67+48+48+48+49 = 327 → 327 % 4 = 3
        expect(posterIndexForConcertId('CC0001')).toBe(3);
    });
});

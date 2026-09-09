import { describe, expect, it } from 'vitest';
import { formatThaiDate, formatThaiDateRange } from '@/utils/customerPromotion';

describe('formatThaiDateRange', () => {
    it('shows a single date when the concert starts and ends on the same day', () => {
        expect(formatThaiDateRange('2026-10-16', '2026-10-16')).toBe(formatThaiDate('2026-10-16'));
    });

    it('shows a single date when there is no end date', () => {
        expect(formatThaiDateRange('2026-10-16', '')).toBe(formatThaiDate('2026-10-16'));
    });

    it('joins both dates with an en dash when they differ', () => {
        expect(formatThaiDateRange('2026-10-16', '2026-10-18'))
            .toBe(`${formatThaiDate('2026-10-16')} – ${formatThaiDate('2026-10-18')}`);
    });
});

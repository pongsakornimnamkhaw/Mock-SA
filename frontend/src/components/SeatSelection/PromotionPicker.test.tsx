import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CustomerPromotion } from '@/types/customerPromotion';
import PromotionPicker, { type PromotionPickerProps } from '@/components/SeatSelection/PromotionPicker';

const promotion = (id: string, code: string): CustomerPromotion => ({
    promotion_id: id,
    promotion_name: `โปร ${id}`,
    description: '',
    banner_image_url: '',
    terms: '',
    discount: { type: 'percent', value: 15, max_discount_amount: 300, minimum_order: 0, promo_code: code },
    validity: { start_date: '2026-09-01', end_date: '2026-12-31', total_quota: 10, used_quota: 0, remaining_quota: 10 },
    zones: [],
    concert: {
        concert_id: 'CONCERT_1', concert_name: 'Riverside Sound Festival',
        start_date: '2026-10-16', end_date: '2026-10-18', start_time: '18:00:00',
        location: 'กรุงเทพฯ', status: 'ยืนยันแล้ว',
    },
});

const setup = (overrides: Partial<PromotionPickerProps> = {}) => {
    const props: PromotionPickerProps = {
        eligiblePromotions: [],
        redeemedPromotions: [],
        selectedPromotionId: '',
        autoSelected: false,
        loading: false,
        loadError: '',
        codeValue: '',
        codeError: '',
        codeSuccess: '',
        codeSubmitting: false,
        disabled: false,
        onSelect: vi.fn(),
        onCodeChange: vi.fn(),
        onCodeSubmit: vi.fn(),
        ...overrides,
    };
    render(<PromotionPicker {...props} />);
    return props;
};

describe('PromotionPicker', () => {
    it('shows the dropdown and the code field even when nothing is eligible', () => {
        setup();
        expect(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' })).toBeInTheDocument();
        expect(screen.getByLabelText('รหัสโปรโมชั่น')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'ใช้โค้ด' })).toBeInTheDocument();
        expect(screen.getByText(/ยังไม่มีโปรโมชั่นที่ตรงกับยอดและโซนที่เลือก/)).toBeInTheDocument();
    });

    it('lists eligible and redeemed promotions without duplicates', async () => {
        const shared = promotion('PROMO_1', 'SAVE15');
        setup({ eligiblePromotions: [shared], redeemedPromotions: [shared, promotion('PROMO_2', 'EXTRA')] });

        await userEvent.click(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' }));

        expect(screen.getAllByRole('option')).toHaveLength(3); // ไม่ใช้โปรโมชั่น + PROMO_1 + PROMO_2
        expect(screen.getByRole('option', { name: /SAVE15/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /EXTRA/ })).toBeInTheDocument();
    });

    it('reports the chosen promotion id', async () => {
        const props = setup({ eligiblePromotions: [promotion('PROMO_1', 'SAVE15')] });

        await userEvent.click(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' }));
        await userEvent.click(screen.getByRole('option', { name: /SAVE15/ }));

        expect(props.onSelect).toHaveBeenCalledWith('PROMO_1');
    });

    it('submits the typed code', async () => {
        const props = setup({ codeValue: 'SAVE15' });
        await userEvent.click(screen.getByRole('button', { name: 'ใช้โค้ด' }));
        expect(props.onCodeSubmit).toHaveBeenCalledTimes(1);
    });

    it('reports each keystroke in the code field', async () => {
        const props = setup();
        await userEvent.type(screen.getByLabelText('รหัสโปรโมชั่น'), 'A');
        expect(props.onCodeChange).toHaveBeenCalledWith('A');
    });

    it('does not submit a blank code', async () => {
        const props = setup({ codeValue: '   ' });
        expect(screen.getByRole('button', { name: 'ใช้โค้ด' })).toBeDisabled();
        expect(props.onCodeSubmit).not.toHaveBeenCalled();
    });

    it('shows the rejection reason from the server', () => {
        setup({ codeError: 'ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท' });
        expect(screen.getByText('ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท')).toBeInTheDocument();
    });

    it('shows a success message after a code is applied', () => {
        setup({ codeSuccess: 'ใช้โค้ด SAVE15 แล้ว' });
        expect(screen.getByText('ใช้โค้ด SAVE15 แล้ว')).toBeInTheDocument();
    });

    it('locks every control once the seats are locked', () => {
        setup({ disabled: true, codeValue: 'SAVE15', eligiblePromotions: [promotion('PROMO_1', 'SAVE15')] });
        expect(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByLabelText('รหัสโปรโมชั่น')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'ใช้โค้ด' })).toBeDisabled();
    });

    it('shows a loading state while promotions are being fetched', () => {
        setup({ loading: true });
        expect(screen.getByText('กำลังตรวจสอบโปรโมชั่น...')).toBeInTheDocument();
    });

    it('still offers the code field when the promotion list fails to load', () => {
        setup({ loadError: 'เชื่อมต่อ Backend ไม่ได้' });
        expect(screen.getByText(/โหลดรายการโปรโมชั่นไม่ได้/)).toBeInTheDocument();
        expect(screen.getByLabelText('รหัสโปรโมชั่น')).toBeEnabled();
    });
});

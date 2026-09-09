import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketStub from '@/components/tickets/TicketStub';
import { ticketThemeForConcertId } from '@/utils/posterPalette';

const ticketProps = {
    concertId: 'CC0001',
    concertTitle: 'Neon Flux Festival 2024',
    eventDate: '16 ตุลาคม 2569',
    location: 'ธันเดอร์โดม เมืองทองธานี',
    zoneLabel: 'โซน A1 (โซน A)',
    code: 'TCK-NEON-A1-01-4280',
    seatLabel: 'A1-01',
    qrCodeUrl: 'https://example.test/qr.png',
    onOpenQr: () => {},
};

describe('TicketStub', () => {
    it('shows everything the customer needs at the gate', () => {
        render(<TicketStub {...ticketProps} />);

        expect(screen.getByText('Neon Flux Festival 2024')).toBeInTheDocument();
        expect(screen.getByText('16 ตุลาคม 2569')).toBeInTheDocument();
        expect(screen.getByText('ธันเดอร์โดม เมืองทองธานี')).toBeInTheDocument();
        expect(screen.getByText('โซน A1 (โซน A)')).toBeInTheDocument();
        expect(screen.getByText('TCK-NEON-A1-01-4280')).toBeInTheDocument();
        // ต้องจับด้วยข้อความเต็ม ไม่ใช่ /A1-01/ เพราะรหัสตั๋วก็มี "A1-01" อยู่ข้างในจะชนกันสองที่
        expect(screen.getByText('ที่นั่ง A1-01')).toBeInTheDocument();
    });

    it('renders the QR code image of that ticket', () => {
        render(<TicketStub {...ticketProps} />);

        const qr = screen.getByRole('img', { name: /TCK-NEON-A1-01-4280/ });
        expect(qr).toHaveAttribute('src', 'https://example.test/qr.png');
    });

    it('marks the stub as admitting one person', () => {
        render(<TicketStub {...ticketProps} />);

        expect(screen.getByText('ADMIT ONE')).toBeInTheDocument();
    });

    it('paints the ticket with the accent colour of that concert poster', () => {
        render(<TicketStub {...ticketProps} />);

        expect(screen.getByTestId('ticket-stub')).toHaveAttribute(
            'data-accent',
            ticketThemeForConcertId('CC0001').accent,
        );
    });

    it('gives concerts with different posters different accent colours', () => {
        const { unmount } = render(<TicketStub {...ticketProps} concertId="CC0001" />);
        const first = screen.getByTestId('ticket-stub').getAttribute('data-accent');
        unmount();

        render(<TicketStub {...ticketProps} concertId="CC0002" />);
        const second = screen.getByTestId('ticket-stub').getAttribute('data-accent');

        expect(first).not.toBe(second);
    });

    it('opens the enlarged QR code when the customer clicks the ticket', async () => {
        const onOpenQr = vi.fn();
        render(<TicketStub {...ticketProps} onOpenQr={onOpenQr} />);

        await userEvent.click(screen.getByRole('button', { name: /TCK-NEON-A1-01-4280/ }));

        expect(onOpenQr).toHaveBeenCalledTimes(1);
    });
});

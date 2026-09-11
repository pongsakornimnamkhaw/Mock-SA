import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CustomerTicketCard from '@/components/tickets/CustomerTicketCard';
import { clearTicketDesignCache } from '@/components/tickets/TicketDesignRenderer';

const props = {
  concertId: 'CC0002',
  concertTitle: 'Neon Nights Vol.3',
  customerName: 'สมชาย ใจดี',
  eventDate: '16 พฤศจิกายน 2569',
  location: 'MCC Hall',
  zoneLabel: 'โซน A',
  code: '45',
  seatLabel: 'A12',
  qrCodeUrl: 'data:image/png;base64,REAL_QR',
  onOpen: vi.fn(),
};

describe('CustomerTicketCard', () => {
  beforeEach(() => {
    clearTicketDesignCache();
    props.onOpen.mockReset();
  });

  it('loads and displays the saved ticket design from Ticket Planning', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects: [
        { id: 'title', kind: 'text', name: '{ชื่อคอนเสิร์ต}', x: 50, y: 50, width: 80, height: 30, z: 1, side: 'FRONT' },
        { id: 'qr', kind: 'qr', name: 'QR', x: 80, y: 50, width: 20, height: 40, z: 2, side: 'FRONT' },
      ] }),
    }));

    render(<CustomerTicketCard {...props} />);

    expect(await screen.findByText('Neon Nights Vol.3')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR Code ตั๋ว 45' })).toHaveAttribute('src', props.qrCodeUrl);
    await userEvent.click(screen.getByRole('button', { name: 'เปิดบัตร 45' }));
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ objects: expect.any(Array), data: expect.objectContaining({ code: '45' }) }));
    vi.unstubAllGlobals();
  });

  it('keeps the original ticket stub when no template exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ objects: [] }) }));

    render(<CustomerTicketCard {...props} />);

    expect(await screen.findByTestId('ticket-stub')).toBeInTheDocument();
    expect(screen.getByText('OCTAVIA E-TICKET')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

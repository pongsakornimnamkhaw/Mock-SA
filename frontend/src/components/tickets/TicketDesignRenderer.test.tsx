import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TicketDesignRenderer,
  clearTicketDesignCache,
  loadCachedTicketDesign,
} from '@/components/tickets/TicketDesignRenderer';

const objects = [
  { id: 'shape', kind: 'shape', shape: 'rectangle', name: '', color: '#071033', textColor: '#fff', x: 50, y: 50, width: 100, height: 100, rotation: 0, z: 1, side: 'FRONT' },
  { id: 'title', kind: 'text', shape: 'rectangle', name: '{ชื่อคอนเสิร์ต}', color: 'transparent', textColor: '#ffffff', x: 25, y: 30, width: 40, height: 20, rotation: 3, z: 2, side: 'FRONT', fontSize: 24 },
  { id: 'holder', kind: 'text', shape: 'rectangle', name: '{ชื่อผู้ถือบัตร}', color: 'transparent', textColor: '#ffffff', x: 25, y: 60, width: 40, height: 10, rotation: 0, z: 3, side: 'FRONT' },
  { id: 'qr', kind: 'qr', shape: 'rectangle', name: 'QR CODE', color: '#ffffff', textColor: '#000000', x: 78, y: 50, width: 20, height: 40, rotation: 0, z: 4, side: 'FRONT' },
  { id: 'back-seat', kind: 'text', shape: 'rectangle', name: 'Seat {ที่นั่ง}', color: 'transparent', textColor: '#ffffff', x: 50, y: 50, width: 40, height: 20, rotation: 0, z: 1, side: 'BACK' },
];

const data = {
  concertTitle: 'Neon Nights Vol.3',
  code: '45',
  customerName: 'สมชาย ใจดี',
  zoneLabel: 'โซน A',
  seatLabel: 'A12',
  qrCodeUrl: 'data:image/png;base64,REAL_QR',
};

describe('TicketDesignRenderer', () => {
  beforeEach(() => clearTicketDesignCache());

  it('renders the saved front design with real placeholders and QR', () => {
    render(<TicketDesignRenderer objects={objects} side="FRONT" data={data} />);

    expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.queryByText('Seat A12')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR Code ตั๋ว 45' })).toHaveAttribute('src', data.qrCodeUrl);
    expect(screen.queryByText(/TK-2026-0459/)).not.toBeInTheDocument();
  });

  it('renders the saved back separately', () => {
    render(<TicketDesignRenderer objects={objects} side="BACK" data={data} />);

    expect(screen.getByText('Seat A12')).toBeInTheDocument();
    expect(screen.queryByText('Neon Nights Vol.3')).not.toBeInTheDocument();
  });

  it('caches one ticket design request per concert', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = loadCachedTicketDesign('CC0002');
    const second = loadCachedTicketDesign('CC0002');

    await expect(first).resolves.toEqual(objects);
    await expect(second).resolves.toEqual(objects);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/ticket-planning/concerts/CC0002/ticket-design');
    vi.unstubAllGlobals();
  });
});

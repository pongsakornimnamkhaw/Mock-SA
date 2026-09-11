import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PromotionFormPage from './PromotionFormPage';

const { promotionOptions, getPromotion } = vi.hoisted(() => ({
  promotionOptions: vi.fn(),
  getPromotion: vi.fn(),
}));

vi.mock('../../../../api/managementApi', () => ({
  managementApi: {
    promotionOptions,
    getPromotion,
    savePromotion: vi.fn(),
    deletePromotion: vi.fn(),
  },
}));

vi.mock('../../../../access/useModuleAccess', () => ({
  useModuleAccess: () => ({ canEdit: true }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

describe('PromotionFormPage concert zones', () => {
  beforeEach(() => {
    promotionOptions.mockReset();
    getPromotion.mockReset();
    promotionOptions.mockResolvedValue({
      concerts: [
        { concert_id: 'CONCERT_A', concert_name: 'Concert A', event_date: '', venue: '' },
        { concert_id: 'CONCERT_B', concert_name: 'Concert B', event_date: '', venue: '' },
      ],
      zones: [
        { zone_id: 'ZONE_A', zone_name: 'Zone A', concert_id: 'CONCERT_A' },
        { zone_id: 'ZONE_B', zone_name: 'Zone B', concert_id: 'CONCERT_B' },
      ],
    });
  });

  it('shows only zones owned by the selected concert and clears them when concert changes', async () => {
    const user = userEvent.setup();
    render(<PromotionFormPage />);

    expect(await screen.findByText('กรุณาเลือกคอนเสิร์ตก่อน')).toBeInTheDocument();
    expect(screen.queryByText('Zone A')).not.toBeInTheDocument();
    expect(screen.queryByText('Zone B')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Concert A' }));

    expect(await screen.findByText('Zone A')).toBeInTheDocument();
    expect(screen.queryByText('Zone B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Zone A' }));
    expect(screen.getByRole('checkbox', { name: 'Zone A' })).toBeChecked();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Concert B' }));

    expect(await screen.findByText('Zone B')).toBeInTheDocument();
    expect(screen.queryByText('Zone A')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Zone B' })).not.toBeChecked());
  }, 10_000);
});

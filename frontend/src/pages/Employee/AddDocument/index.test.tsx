import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { saveEmployeeSession } from '@/utils/employeeSession';
import DocumentsPage from './index';

vi.mock('@/api/concertApi', () => ({
  concertApi: {
    getConcerts: vi.fn().mockResolvedValue([
      { concert_id: 'C1', concert_name: 'Concert One' },
      { concert_id: 'C2', concert_name: 'Concert Two' },
    ]),
    getDocuments: vi.fn().mockResolvedValue([{ document_id: 'D1', document_name: 'สัญญา.pdf', category: 'สัญญา', file_url: '/file/D1' }]),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

describe('DocumentsPage permissions', () => {
  beforeEach(() => {
    localStorage.clear();
    saveEmployeeSession({
      userId: 'SEED_EMP_010', employeeCode: 'OCT-EMP-010', firstName: 'ภาคภูมิ', lastName: 'รัตนชัย',
      name: 'ภาคภูมิ รัตนชัย', department: 'ฝ่ายการเงิน', role: 'view_only', jobRole: 'staff',
      email: 'phakphum.viewer@octavia.test', modulePermissions: { concerts: 'view' },
    });
  });

  it('shows concert and document browsing without mutation controls for a view-only employee', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/documents', state: { concert: { title: 'Concert Two' } } }]}><DocumentsPage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'บันทึกเอกสาร' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('โปรดระบุหัวข้อเอกสาร')).not.toBeInTheDocument();
    expect(screen.getByText(/รายการเอกสารที่แนบไว้/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Concert Two'));
    await waitFor(() => expect(screen.getByRole('button', { name: /เปิดดูไฟล์/ })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'ลบ' })).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveEmployeeSession } from '@/utils/employeeSession';
import ConcertSearchPage from './index';

describe('ConcertSearchPage permissions', () => {
  beforeEach(() => {
    localStorage.clear();
    saveEmployeeSession({
      userId: 'SEED_EMP_010', employeeCode: 'OCT-EMP-010', firstName: 'ภาคภูมิ', lastName: 'รัตนชัย',
      name: 'ภาคภูมิ รัตนชัย', department: 'ฝ่ายการเงิน', role: 'view_only', jobRole: 'staff',
      email: 'phakphum.viewer@octavia.test', modulePermissions: { concerts: 'view' },
    });
  });

  it('does not render concert mutation actions for a view-only employee', () => {
    render(<MemoryRouter><ConcertSearchPage /></MemoryRouter>);
    expect(screen.queryByLabelText(/แก้ไข Neon Flux/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ลบ Neon Flux/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/เพิ่มผู้รับผิดชอบ Neon Flux/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/เอกสาร Neon Flux/i)).toBeInTheDocument();
  });
});

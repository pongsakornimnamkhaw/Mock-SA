import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import EmployeeLoginPage from '@/pages/Employee/Login';

describe('EmployeeLoginPage', () => {
    it('does not expose demo employee credentials', () => {
        render(
            <MemoryRouter>
                <EmployeeLoginPage />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('button', { name: /B6728786/ })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('');
    });
});

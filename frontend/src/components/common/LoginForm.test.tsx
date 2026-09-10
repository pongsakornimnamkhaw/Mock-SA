import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import LoginForm from '@/components/common/LoginForm';

describe('LoginForm', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('does not expose demo customer credentials', () => {
        render(
            <MemoryRouter>
                <LoginForm />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('button', { name: /Demo Customer/i })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('');
    });
});

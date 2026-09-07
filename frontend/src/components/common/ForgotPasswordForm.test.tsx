import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customerAccountApi } from '@/api/customerAccountApi';
import ForgotPasswordForm from '@/components/common/ForgotPasswordForm';

afterEach(() => {
    vi.restoreAllMocks();
});

const typeEmail = async (value: string) => {
    await userEvent.type(screen.getByLabelText('อีเมล'), value);
};

describe('ForgotPasswordForm', () => {
    it('sends the typed email and then shows a neutral confirmation', async () => {
        const forgotPassword = vi.spyOn(customerAccountApi, 'forgotPassword').mockResolvedValue(undefined);
        render(<ForgotPasswordForm />);

        await typeEmail('user@example.test');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        expect(forgotPassword).toHaveBeenCalledWith('user@example.test');
        expect(await screen.findByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/)).toBeInTheDocument();
    });

    it('keeps the confirmation neutral so it never reveals whether the account exists', async () => {
        vi.spyOn(customerAccountApi, 'forgotPassword').mockResolvedValue(undefined);
        render(<ForgotPasswordForm />);

        await typeEmail('nobody@example.test');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        const confirmation = await screen.findByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/);
        expect(confirmation.textContent).toMatch(/ถ้ามีบัญชี/);
    });

    it('shows the server error message when the email is malformed', async () => {
        vi.spyOn(customerAccountApi, 'forgotPassword').mockRejectedValue(new Error('รูปแบบอีเมลไม่ถูกต้อง'));
        render(<ForgotPasswordForm />);

        await typeEmail('nope');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        expect(await screen.findByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeInTheDocument();
        expect(screen.queryByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/)).not.toBeInTheDocument();
    });

    it('does not submit an empty email', async () => {
        const forgotPassword = vi.spyOn(customerAccountApi, 'forgotPassword').mockResolvedValue(undefined);
        render(<ForgotPasswordForm />);

        expect(screen.getByRole('button', { name: 'ยืนยันอีเมล' })).toBeDisabled();
        expect(forgotPassword).not.toHaveBeenCalled();
    });

    it('disables the field and the button while the request is in flight', async () => {
        let release: () => void = () => {};
        vi.spyOn(customerAccountApi, 'forgotPassword').mockReturnValue(
            new Promise<void>((resolve) => { release = () => resolve(); }),
        );
        render(<ForgotPasswordForm />);

        await typeEmail('user@example.test');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        await waitFor(() => expect(screen.getByLabelText('อีเมล')).toBeDisabled());
        release();
        await screen.findByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/);
    });
});

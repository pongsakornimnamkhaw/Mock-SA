import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import ResetPasswordForm from '@/components/common/ResetPasswordForm';

afterEach(() => {
    vi.restoreAllMocks();
});

const renderAt = (search: string) => render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <Routes>
            <Route path="/reset-password" element={<ResetPasswordForm />} />
            <Route path="/login" element={<div>หน้าเข้าสู่ระบบ</div>} />
        </Routes>
    </MemoryRouter>,
);

const fillPasswords = async (password: string, confirmation: string) => {
    await userEvent.type(screen.getByLabelText('รหัสผ่านใหม่'), password);
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), confirmation);
};

describe('ResetPasswordForm', () => {
    it('sends the token from the query string with the new password', async () => {
        const resetPassword = vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('BrandNewPass456!', 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(resetPassword).toHaveBeenCalledWith('abc123', 'BrandNewPass456!');
    });

    it('redirects to the login page after a successful reset', async () => {
        vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('BrandNewPass456!', 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('หน้าเข้าสู่ระบบ')).toBeInTheDocument();
    });

    it('rejects a mismatched confirmation without calling the server', async () => {
        const resetPassword = vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('BrandNewPass456!', 'DifferentPass789!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument();
        expect(resetPassword).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 8 characters without calling the server', async () => {
        const resetPassword = vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('sh0rt', 'sh0rt');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')).toBeInTheDocument();
        expect(resetPassword).not.toHaveBeenCalled();
    });

    it('shows the server message when the link is expired', async () => {
        vi.spyOn(customerAccountApi, 'resetPassword').mockRejectedValue(
            new Error('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'),
        );
        renderAt('?token=stale');

        await fillPasswords('BrandNewPass456!', 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว')).toBeInTheDocument();
    });

    it('explains that the link is broken when the token is missing entirely', () => {
        renderAt('');

        expect(screen.getByText(/ลิงก์รีเซ็ตรหัสผ่านไม่สมบูรณ์/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'ตั้งรหัสผ่านใหม่' })).not.toBeInTheDocument();
    });
});

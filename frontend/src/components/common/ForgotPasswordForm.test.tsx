import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import ForgotPasswordForm from '@/components/common/ForgotPasswordForm';

afterEach(() => {
    vi.restoreAllMocks();
});

const renderForm = () => render(
    <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
            <Route path="/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/login" element={<div>หน้าเข้าสู่ระบบ</div>} />
        </Routes>
    </MemoryRouter>,
);

const moveToPhoneStep = async () => {
    await userEvent.type(screen.getByLabelText('อีเมล'), 'user@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));
};

const moveToPasswordStep = async () => {
    await moveToPhoneStep();
    await userEvent.type(screen.getByLabelText('เบอร์โทรศัพท์'), '081-234-5678');
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยันเบอร์โทรศัพท์' }));
};

describe('ForgotPasswordForm', () => {
    it('moves from the registered email to phone-number verification', async () => {
        renderForm();

        await moveToPhoneStep();

        expect(await screen.findByLabelText('เบอร์โทรศัพท์')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'ยืนยันเบอร์โทรศัพท์' })).toBeInTheDocument();
    });

    it('moves to the new-password step only after the phone-number step', async () => {
        renderForm();

        await moveToPasswordStep();

        expect(await screen.findByLabelText('รหัสผ่านใหม่')).toBeInTheDocument();
        expect(screen.getByLabelText('ยืนยันรหัสผ่านใหม่')).toBeInTheDocument();
    });

    it('rejects mismatched passwords without submitting the recovery request', async () => {
        const recoverPassword = vi.spyOn(customerAccountApi, 'recoverPassword').mockResolvedValue(undefined);
        renderForm();

        await moveToPasswordStep();
        await userEvent.type(screen.getByLabelText('รหัสผ่านใหม่'), 'BrandNewPass456!');
        await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), 'DifferentPass789!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument();
        expect(recoverPassword).not.toHaveBeenCalled();
    });

    it('submits the registered email, phone number, and new password before returning to login', async () => {
        const recoverPassword = vi.spyOn(customerAccountApi, 'recoverPassword').mockResolvedValue(undefined);
        renderForm();

        await moveToPasswordStep();
        await userEvent.type(screen.getByLabelText('รหัสผ่านใหม่'), 'BrandNewPass456!');
        await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(recoverPassword).toHaveBeenCalledWith('user@example.test', '081-234-5678', 'BrandNewPass456!');
        expect(await screen.findByText('หน้าเข้าสู่ระบบ')).toBeInTheDocument();
    });
});

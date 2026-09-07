import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerApiError, customerAccountApi } from '@/api/customerAccountApi';

const noContent = () => new Response(null, { status: 204 });

const errorResponse = (status: number, message: string) => new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } },
);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('customerAccountApi.forgotPassword', () => {
    it('posts the email to the forgot-password endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent());

        await expect(customerAccountApi.forgotPassword('  User@Example.test ')).resolves.toBeUndefined();

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('/api/customer/auth/forgot-password');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ email: '  User@Example.test ' });
    });

    it('surfaces a malformed-email rejection from the server', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(400, 'รูปแบบอีเมลไม่ถูกต้อง'));

        await expect(customerAccountApi.forgotPassword('nope')).rejects.toThrow('รูปแบบอีเมลไม่ถูกต้อง');
    });
});

describe('customerAccountApi.resetPassword', () => {
    it('posts the token and the new password', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent());

        await expect(customerAccountApi.resetPassword('abc123', 'BrandNewPass456!')).resolves.toBeUndefined();

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('/api/customer/auth/reset-password');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ token: 'abc123', new_password: 'BrandNewPass456!' });
    });

    it('surfaces an expired-link rejection with its status', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            errorResponse(400, 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'),
        );

        await expect(customerAccountApi.resetPassword('stale', 'BrandNewPass456!'))
            .rejects.toMatchObject({ message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว', status: 400 });
    });

    it('reports an unreachable backend as a CustomerApiError with status 0', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed to fetch'));

        await expect(customerAccountApi.resetPassword('abc123', 'BrandNewPass456!'))
            .rejects.toBeInstanceOf(CustomerApiError);
    });
});

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import { customerAccountApi } from '@/api/customerAccountApi'

const ResetPasswordForm = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = (searchParams.get('token') || '').trim()

    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    if (token === '') {
        return (
            <Alert severity="error" sx={{ borderRadius: '15px' }}>
                ลิงก์รีเซ็ตรหัสผ่านไม่สมบูรณ์ กรุณากดลิงก์จากอีเมลอีกครั้ง หรือขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน
            </Alert>
        )
    }

    const canSubmit = password !== '' && confirmation !== '' && !submitting

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return
        // ตรวจฝั่ง client ก่อน เพื่อไม่ต้องยิงเซิร์ฟเวอร์สำหรับความผิดพลาดที่เห็นได้ทันที
        if (password.length < 8) {
            setErrorMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
            return
        }
        if (password !== confirmation) {
            setErrorMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
            return
        }
        setSubmitting(true)
        setErrorMessage('')
        try {
            await customerAccountApi.resetPassword(token, password)
            navigate('/login', { replace: true })
        } catch (reason) {
            setErrorMessage(reason instanceof Error ? reason.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้')
            setSubmitting(false)
        }
    }

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <LockIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="รหัสผ่านใหม่"
                    type="password"
                    value={password}
                    disabled={submitting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <LockIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="ยืนยันรหัสผ่านใหม่"
                    type="password"
                    value={confirmation}
                    disabled={submitting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmation(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                />
            </Box>

            {errorMessage !== '' && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '15px' }}>
                    {errorMessage}
                </Alert>
            )}

            <Button variant="contained" type="submit" disabled={!canSubmit}
                sx={{
                    bgcolor: '#FF5A57',
                    borderRadius: '15px',
                    fontSize: '18px',
                    py: 1.5,
                    width: '80%',
                    display: 'flex',
                    justifyContent: 'center',
                    mx: 'auto',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#050C38' }
                }}
            >
                {submitting ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'ตั้งรหัสผ่านใหม่'}
            </Button>
        </Box>
    );
};

export default ResetPasswordForm

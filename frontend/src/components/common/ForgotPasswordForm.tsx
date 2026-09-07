import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import { customerAccountApi } from '@/api/customerAccountApi'

const ForgotPasswordForm = () => {
    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [sent, setSent] = useState(false)

    const canSubmit = email.trim() !== '' && !submitting

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return
        setSubmitting(true)
        setErrorMessage('')
        try {
            await customerAccountApi.forgotPassword(email)
            setSent(true)
        } catch (reason) {
            setErrorMessage(reason instanceof Error ? reason.message : 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                }}
            >
                <EmailIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="อีเมล"
                    type="email"
                    value={email}
                    disabled={submitting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f5f5f5',
                                borderRadius: '15px',
                            },
                        }}
                />
            </Box>

            {/* ข้อความยืนยันต้องเป็นกลาง ไม่บอกว่าอีเมลนี้มีบัญชีอยู่จริงหรือไม่ */}
            {sent && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: '15px' }}>
                    ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว กรุณาตรวจสอบกล่องจดหมาย (ลิงก์ใช้ได้ 30 นาที)
                </Alert>
            )}

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
                {submitting ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'ยืนยันอีเมล'}
            </Button>
        </Box>
    );
};

export default ForgotPasswordForm

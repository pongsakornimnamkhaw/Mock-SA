import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import LockIcon from '@mui/icons-material/Lock'
import PhoneIcon from '@mui/icons-material/Phone'
import { useNavigate } from 'react-router-dom'
import { customerAccountApi } from '@/api/customerAccountApi'

type RecoveryStep = 'email' | 'phone' | 'password'

const ForgotPasswordForm = () => {
    const navigate = useNavigate()
    const [step, setStep] = useState<RecoveryStep>('email')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const canSubmit = !submitting && (
        (step === 'email' && email.trim() !== '') ||
        (step === 'phone' && phone.trim() !== '') ||
        (step === 'password' && password !== '' && confirmation !== '')
    )

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        setErrorMessage('')
        if (step === 'email') {
            setStep('phone')
            return
        }
        if (step === 'phone') {
            setStep('password')
            return
        }
        if (password.length < 8) {
            setErrorMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
            return
        }
        if (password !== confirmation) {
            setErrorMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
            return
        }
        setSubmitting(true)
        try {
            await customerAccountApi.recoverPassword(email.trim(), phone.trim(), password)
            navigate('/login', { replace: true })
        } catch (reason) {
            setErrorMessage(reason instanceof Error ? reason.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้')
            setSubmitting(false)
        }
    }

    const fieldSx = { '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }
    const buttonLabel = step === 'email'
        ? 'ยืนยันอีเมล'
        : step === 'phone'
            ? 'ยืนยันเบอร์โทรศัพท์'
            : 'ตั้งรหัสผ่านใหม่'

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            {step === 'email' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <EmailIcon sx={{ color: '#333' }} />
                    <TextField fullWidth label="อีเมล" type="email" value={email} disabled={submitting}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} sx={fieldSx} />
                </Box>
            )}

            {step === 'phone' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <PhoneIcon sx={{ color: '#333' }} />
                    <TextField fullWidth label="เบอร์โทรศัพท์" type="tel" value={phone} disabled={submitting}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPhone(event.target.value)} sx={fieldSx} />
                </Box>
            )}

            {step === 'password' && (
                <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <LockIcon sx={{ color: '#333' }} />
                        <TextField fullWidth label="รหัสผ่านใหม่" type="password" value={password} disabled={submitting}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} sx={fieldSx} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <LockIcon sx={{ color: '#333' }} />
                        <TextField fullWidth label="ยืนยันรหัสผ่านใหม่" type="password" value={confirmation} disabled={submitting}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfirmation(event.target.value)} sx={fieldSx} />
                    </Box>
                </>
            )}

            {errorMessage !== '' && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '15px' }}>{errorMessage}</Alert>
            )}

            <Button variant="contained" type="submit" disabled={!canSubmit}
                sx={{ bgcolor: '#FF5A57', borderRadius: '15px', fontSize: '18px', py: 1.5, width: '80%', display: 'flex', justifyContent: 'center', mx: 'auto', fontWeight: 'bold', '&:hover': { bgcolor: '#050C38' } }}>
                {submitting ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : buttonLabel}
            </Button>
        </Box>
    )
}

export default ForgotPasswordForm

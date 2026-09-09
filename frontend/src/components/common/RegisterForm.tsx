import { useEffect, useState } from 'react';
import { Alert, Box, TextField, Button, IconButton, InputAdornment, MenuItem } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import { getCustomerSession, saveCustomerSession } from '@/utils/customerSession';

const RegisterForm = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (getCustomerSession()) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        gender: '',
        address: '',
        password: '',
        confirmPassword: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [field]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const account = await customerAccountApi.register({
                firstName: form.firstName.trim(), lastName: form.lastName.trim(),
                phone: form.phone.trim(), email: form.email.trim(), dateOfBirth: form.dateOfBirth,
                gender: form.gender, address: form.address.trim(), password: form.password,
            });
            saveCustomerSession(account);
            navigate('/home');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถสมัครสมาชิกได้');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {/* ชื่อ + นามสกุล (อยู่บรรทัดเดียวกัน) */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <PersonIcon sx={{ color: '#333' }} />
                <TextField
                    label="ชื่อ"
                    value={form.firstName}
                    onChange={handleChange('firstName')}
                    required
                    sx={{
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
                />
                <TextField
                    label="นามสกุล"
                    value={form.lastName}
                    onChange={handleChange('lastName')}
                    required
                    sx={{
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
                />
            </Box>

            {/* โทรศัพท์ */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <PhoneIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="โทรศัพท์"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
                />
            </Box>

            {/* อีเมล */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <EmailIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="อีเมล"
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
                />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2, ml: { sm: 5 } }}>
                <TextField
                    label="วันเกิด"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleChange('dateOfBirth')}
                    required
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                />
                <TextField
                    select
                    label="เพศ"
                    value={form.gender}
                    onChange={handleChange('gender')}
                    required
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                >
                    <MenuItem value="หญิง">หญิง</MenuItem>
                    <MenuItem value="ชาย">ชาย</MenuItem>
                    <MenuItem value="ไม่ระบุ">ไม่ระบุ</MenuItem>
                </TextField>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <PersonIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="ที่อยู่ (ไม่บังคับ)"
                    value={form.address}
                    onChange={handleChange('address')}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                />
            </Box>

            {/* รหัสผ่าน */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <LockIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="รหัสผ่าน"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange('password')}
                    required
                    helperText="อย่างน้อย 8 ตัวอักษร"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </Box>

            {/* ยืนยันรหัสผ่าน */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                <LockIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="ยืนยันรหัสผ่าน"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </Box>

            {/* ปุ่มลงทะเบียน */}
            <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                    bgcolor: '#FF5A57',
                    borderRadius: '30px',
                    py: 1.5,
                    fontSize: '18px',
                    textTransform: 'none',
                    width: '80%',
                    '&:hover': { bgcolor: '#050C38' },
                    display: 'flex',
                    justifyContent: 'center',
                    mx: 'auto',
                    fontWeight: 'bold',
                }}
            >
                {loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
            </Button>
        </Box>
    );
};

export default RegisterForm;

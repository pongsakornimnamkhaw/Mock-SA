import { useState } from 'react';
import { Box, TextField, Button, IconButton, InputAdornment } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';

const RegisterForm = () => {
    const [form, setForm] = useState({
        username: '',
        lastname: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [field]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Register:', form);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            {/* ชื่อ + นามสกุล (อยู่บรรทัดเดียวกัน) */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <PersonIcon sx={{ color: '#333' }} />
                <TextField
                    label="ชื่อผู้ใช้"
                    value={form.username}
                    onChange={handleChange('username')}
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
                    value={form.lastname}
                    onChange={handleChange('lastname')}
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
                    value={form.email}
                    onChange={handleChange('email')}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#f5f5f5',
                            borderRadius: '15px',
                        }
                    }}
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
                ลงทะเบียน
            </Button>
        </Box>
    );
};

export default RegisterForm;

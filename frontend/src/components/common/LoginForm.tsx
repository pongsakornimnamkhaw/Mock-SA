import { useState, useEffect } from 'react'
import { Alert, Box, Button, TextField, IconButton, InputAdornment, Link} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import { getCustomerSession, saveCustomerSession } from '@/utils/customerSession';

const LoginForm = () => { //React.FC || () =>  identify that this is a functional component
    const navigate = useNavigate();
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // หากลูกค้าล็อกอินอยู่แล้ว ให้ไปที่หน้า /home ทันที
        if (getCustomerSession()) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();  //no refresh page
        setLoading(true);
        setError('');
        try {
            const account = await customerAccountApi.login(email.trim(), password);
            saveCustomerSession(account);
            navigate('/home', { replace: true });
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถเข้าสู่ระบบได้');
        } finally {
            setLoading(false);
        }
    };

    return (
        // component="form" is form for send data to backend
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
                fullWidth  //input field take full width
                label = "อีเมล"
                type="email"
                required
                autoComplete="email"
                value = {email} //value is the value of the input field
                onChange = { (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value) } //onChange is the event that is triggered when the value of the input field changes
                sx = {{mb: 2, '& .MuiOutlinedInput-root' : {
                    bgcolor: '#f5f5f5',
                    borderRadius: '15px',
                },
            }}
            />

            <TextField
                fullWidth
                label = "รหัสผ่าน"
                required
                autoComplete="current-password"
                type = {showPassword ? 'text' : 'password'} //show password or hide password
                value = {password}
                onChange = { (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value) }
                sx = {{'& .MuiOutlinedInput-root' : {
                    bgcolor: '#f5f5f5',
                    borderRadius: '15px',
                    },
                }}
                slotProps = {{
                    input: {
                        //endAdornment is the icon that is displayed at the end of the input field
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

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3, mt: 1 , fontSize: '16px'}}>
                <Link component={RouterLink} to="/forgot-password" underline="hover" sx={{ color: '#000000'}}>
                    ลืมรหัสผ่าน
                </Link>
            </Box>

            <Button type="submit" variant="contained" disabled={loading}
                    sx={{ 
                        bgcolor: '#FF5A57', 
                        borderRadius: '15px', 
                        width: '80%',
                        py: 1.5, 
                        display: 'flex',
                        fontWeight: 'bold', 
                        fontSize: '18px',
                        justifyContent: 'center',
                        mx: 'auto',
                        '&:hover': { bgcolor: '#050C38' }
                    }}
                >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed #e0e0e0', textAlign: 'center' }}>
                <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                        setEmail('customer.demo@octavia.test');
                        setPassword('Demo1234!');
                        setError('');
                    }}
                    sx={{ color: '#11366b', textTransform: 'none', fontSize: '0.85rem' }}
                >
                    กรอกข้อมูลบัญชีทดสอบลูกค้า (Demo Customer)
                </Button>
            </Box>

            <Box sx={{ mt: 1, textAlign: 'center' }}>
                <Link
                    component={RouterLink}
                    to="/employee/login"
                    sx={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'underline' }}
                >
                    เข้าสู่ระบบสำหรับพนักงาน (Staff Portal)
                </Link>
            </Box>
        </Box>
    );
};
export default LoginForm;

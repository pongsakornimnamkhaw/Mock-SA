import { Box, Paper, Typography, Link, Stack } from '@mui/material'
import Logo from '@/components/common/Logo'
import LoginForm from '@/components/common/LoginForm'
import { Link as RouterLink } from 'react-router-dom'

const LoginPage = () => {
    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: '#050C38', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
        }}>
            <Paper elevation={3} 
                sx={{ 
                    width: '500px', 
                    maxWidth: '600px', 
                    borderRadius: 5, 
                    p: 5, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center' 
                }}
            >
                <Stack spacing={3} sx={{ width: '100%', alignItems: 'center' }}>
                    <Logo variant="OC1" width={200} />
                    
                    <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '32px' }}>
                        เข้าสู่ระบบ
                    </Typography>
                    
                    <LoginForm />

                    <Typography sx={{ fontSize: '18px', textAlign: 'center', color: '#000000' }}>
                        หากยังไม่ได้สมัครสมาชิก
                        <br />
                        <Link component={RouterLink} to="/register" underline="always" sx={{ fontSize: '18px', color: '#FF5A57' }}>
                            กรุณาสมัครสมาชิก
                        </Link>
                    </Typography>
                </Stack>
            </Paper>
        </Box>
    );
};

export default LoginPage;
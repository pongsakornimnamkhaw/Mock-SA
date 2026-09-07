import { Box, Paper, Typography } from '@mui/material'
import Logo from '@/components/common/Logo'
import RegisterForm from '@/components/common/RegisterForm'

const RegisterPage = () => {
    return (
        <Box sx={{ 
                minHeight : '100vh', 
                bgcolor : '#050C38', 
                display : 'flex', 
                justifyContent : 'center', 
                alignItems : 'center'
                }}
            >
            {/* elevation เงา */}
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
                <Logo variant="OC1" width={200} />
                
                <Typography variant="h5" sx={{fontWeight: 'bold', mt: 2, mb: 3, fontSize: '32px'}}>
                    สมัครสมาชิก
                </Typography>

                <RegisterForm/>
            </Paper>
        </Box>
    );
};

export default RegisterPage;
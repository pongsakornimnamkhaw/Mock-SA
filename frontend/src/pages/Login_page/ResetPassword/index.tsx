import { Box, Paper, Typography } from '@mui/material'
import Logo from '@/components/common/Logo'
import ResetPasswordForm from '@/components/common/ResetPasswordForm'

const ResetPasswordPage = () => {
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
                    flexDirection: 'column'
                }}
            >
                    <Logo variant="OC1" width={200} />

                    <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '32px', color: '#000000', textAlign: 'center' }}>
                        ตั้งรหัสผ่านใหม่
                    </Typography>

                    <Typography sx={{ fontSize: '18px', textAlign: 'center', color: '#000000', mb: 2 }}>
                        กรอกรหัสผ่านใหม่ที่ต้องการใช้
                    </Typography>

                    <ResetPasswordForm />

            </Paper>
        </Box>
    );
};

export default ResetPasswordPage;
